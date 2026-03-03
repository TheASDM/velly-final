const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const LOG_PATH = '/app/logs/chat.log';

// ── Provider selection ────────────────────────────────────────────────────────
// Set AI_PROVIDER=openwebui in .env to use your local Open WebUI instance.
// Defaults to 'anthropic' if not set.
const AI_PROVIDER = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();

let callAI;

if (AI_PROVIDER === 'openwebui') {
    const OpenAI = require('openai');
    const client = new OpenAI({
        baseURL: `${process.env.OPENWEBUI_URL}/api`,
        apiKey: process.env.OPENWEBUI_API_KEY || 'none',
    });
    const model = process.env.OPENWEBUI_MODEL || 'llama3.2';

    callAI = async (systemPrompt, messages) => {
        const res = await client.chat.completions.create({
            model,
            max_tokens: 1024,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
        });
        return res.choices[0].message.content;
    };

    console.log(`AI provider: Open WebUI @ ${process.env.OPENWEBUI_URL} (model: ${model})`);

} else {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

    callAI = async (systemPrompt, messages) => {
        const res = await client.messages.create({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages,
        });
        return res.content[0].text;
    };

    console.log(`AI provider: Anthropic (model: ${model})`);
}
// ─────────────────────────────────────────────────────────────────────────────

function writeLog(role, text) {
    const line = `[${new Date().toISOString()}] ${role.toUpperCase()}: ${text.replace(/\n/g, ' ')}\n`;
    try {
        fs.mkdirSync('/app/logs', { recursive: true });
        fs.appendFileSync(LOG_PATH, line, 'utf8');
    } catch (e) {
        console.error('Log write failed:', e.message);
    }
}

app.use(cors());
app.use(express.json());

function loadTier1() {
    const tierFile = '/app/data/tier1_player.md';
    try {
        return fs.readFileSync(tierFile, 'utf8');
    } catch (error) {
        console.error('Error loading tier1_player.md:', error);
        return null;
    }
}

const SYSTEM_HEADER = `You are the Loremaster, a knowledgeable guide for the Vallombrosa campaign — a D&D 5e game set in a dark romantasy version of Renaissance Venice called Venturia. The city sits at the edge of a fey prison called the Reverie Solenne, whose slow collapse is causing strange phenomena throughout the city.

You are speaking to a PLAYER. Do not reveal plot secrets or DM-only information.

Answer questions about the campaign world, characters, locations, factions, and rules. Be concise but evocative. If you don't know something from the provided context, say so rather than inventing details. Use the tone of a learned Venetian scholar — measured, precise, occasionally lyrical.

---
`;

app.post('/api/chat', async (req, res) => {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message' });
    }

    const tier1 = loadTier1();
    if (!tier1) {
        return res.status(500).json({ error: 'Campaign data not available' });
    }

    const systemPrompt = SYSTEM_HEADER + tier1;

    try {
        const assistantMessage = await callAI(systemPrompt, [
            ...conversationHistory,
            { role: 'user', content: message },
        ]);

        writeLog('user', message);
        writeLog('assistant', assistantMessage);

        res.json({
            response: assistantMessage,
            conversationHistory: [
                ...conversationHistory,
                { role: 'user', content: message },
                { role: 'assistant', content: assistantMessage },
            ],
        });
    } catch (error) {
        console.error('AI call failed:', error);
        res.status(500).json({
            error: 'Failed to get response from Lore Master',
            details: error.message,
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'dnd-chatbot', provider: AI_PROVIDER });
});

app.listen(PORT, () => {
    console.log(`Lore Master chatbot running on port ${PORT}`);
});
