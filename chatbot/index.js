const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

function loadCampaignData() {
    const dataPath = '/app/data';
    try {
        return {
            npcs: JSON.parse(fs.readFileSync(path.join(dataPath, 'npcs.json'), 'utf8')),
            locations: JSON.parse(fs.readFileSync(path.join(dataPath, 'locations.json'), 'utf8')),
            factions: JSON.parse(fs.readFileSync(path.join(dataPath, 'factions.json'), 'utf8')),
            sessions: JSON.parse(fs.readFileSync(path.join(dataPath, 'sessions.json'), 'utf8')),
            items: JSON.parse(fs.readFileSync(path.join(dataPath, 'items.json'), 'utf8')),
            lore: fs.readFileSync(path.join(dataPath, 'lore.txt'), 'utf8'),
            rules: fs.readFileSync(path.join(dataPath, 'house-rules.txt'), 'utf8'),
        };
    } catch (error) {
        console.error('Error loading campaign data:', error);
        return null;
    }
}

app.post('/api/chat', async (req, res) => {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Invalid message' });
    }

    const campaignData = loadCampaignData();
    if (!campaignData) {
        return res.status(500).json({ error: 'Campaign data not available' });
    }

    const systemPrompt = `You are the Lore Master, a knowledgeable guide to the Valley of Shadows campaign — a long-term D&D 5e campaign set in the masked city of Venturia and the fog-bound valley of Vallombrosa.

Your role is to help players understand the campaign world, recall past events, and clarify rules. You have access to the complete campaign knowledge base including NPCs, locations, factions, session recaps, items, lore, and house rules.

CAMPAIGN KNOWLEDGE BASE:

NPCs:
${JSON.stringify(campaignData.npcs, null, 2)}

Locations:
${JSON.stringify(campaignData.locations, null, 2)}

Factions:
${JSON.stringify(campaignData.factions, null, 2)}

Recent Sessions:
${JSON.stringify(campaignData.sessions, null, 2)}

Magic Items:
${JSON.stringify(campaignData.items, null, 2)}

Campaign Lore:
${campaignData.lore}

House Rules:
${campaignData.rules}

GUIDELINES:
- Answer questions concisely but with flavor appropriate to the campaign setting
- If you don't know something, be honest and suggest checking the wiki
- For rules questions, cite the specific house rule or refer to standard D&D 5e rules
- When discussing NPCs, include their current status and relevant relationships
- For session recaps, be specific about what happened and who was involved
- If asked about future events or DM secrets, politely decline with in-character flavor

Keep responses focused and helpful. You're here to enhance the player experience, not replace the DM.`;

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
