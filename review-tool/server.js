const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;
const DATA_PATH = path.resolve(__dirname, '../campaign-data');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Files with {schema_version, category, entries[]} structure
const STRUCTURED_FILES = ['characters.json', 'government.json', 'history.json', 'fey.json'];
// Files with {schema_version, campaign, categories: {name: [...], ...}} structure
const CONSOLIDATED_FILES = ['vallombrosa_knowledge_base.json'];
// Flat key→object files
const FLAT_FILES = ['npcs.json', 'locations.json', 'factions.json', 'sessions.json', 'items.json'];

function readJson(filename) {
    return JSON.parse(fs.readFileSync(path.join(DATA_PATH, filename), 'utf8'));
}

function writeJson(filename, data) {
    fs.writeFileSync(path.join(DATA_PATH, filename), JSON.stringify(data, null, 2), 'utf8');
}

function loadAllEntries() {
    const all = [];

    for (const file of STRUCTURED_FILES) {
        try {
            const raw = readJson(file);
            if (Array.isArray(raw.entries)) {
                for (const e of raw.entries) {
                    all.push({ ...e, _file: file, _fileType: 'structured', _category: raw.category || '' });
                }
            }
        } catch (err) { console.error(`Failed to load ${file}:`, err.message); }
    }

    for (const file of CONSOLIDATED_FILES) {
        try {
            const raw = readJson(file);
            if (raw.categories) {
                for (const [cat, entries] of Object.entries(raw.categories)) {
                    for (const e of entries) {
                        all.push({ ...e, _file: file, _fileType: 'consolidated', _category: cat });
                    }
                }
            }
        } catch (err) { console.error(`Failed to load ${file}:`, err.message); }
    }

    for (const file of FLAT_FILES) {
        try {
            const raw = readJson(file);
            for (const [key, val] of Object.entries(raw)) {
                if (key.startsWith('_') || typeof val !== 'object' || val === null) continue;
                all.push({
                    ...val,
                    _file: file,
                    _fileType: 'flat',
                    _key: key,
                    id: key,
                    name: val.name || val.title || key,
                });
            }
        } catch (err) { console.error(`Failed to load ${file}:`, err.message); }
    }

    return all;
}

function detectIssues(entries) {
    const allIds = new Set(entries.map(e => e.id).filter(Boolean));

    // Conflicts: same name in different files
    const byName = {};
    for (const e of entries) {
        const key = (e.name || '').toLowerCase().trim();
        if (!key || key === 'unknown') continue;
        (byName[key] = byName[key] || []).push(e);
    }
    const conflicts = Object.values(byName)
        .filter(group => new Set(group.map(e => e._file)).size > 1)
        .map(group => ({
            name: group[0].name,
            entries: group.map(e => ({
                _file: e._file,
                _category: e._category,
                id: e.id,
                summary: e.summary
            }))
        }));

    // Orphans: connection target_id not found in any file
    const orphans = [];
    for (const e of entries) {
        if (!Array.isArray(e.connections)) continue;
        for (const c of e.connections) {
            if (c.target_id && !allIds.has(c.target_id)) {
                orphans.push({
                    source_file: e._file,
                    source_id: e.id,
                    source_name: e.name,
                    missing_id: c.target_id,
                    missing_name: c.target_name || c.target_id,
                    relationship: c.relationship || ''
                });
            }
        }
    }

    return { conflicts, orphans };
}

app.get('/api/entries', (_, res) => {
    try { res.json(loadAllEntries()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/issues', (_, res) => {
    try {
        const entries = loadAllEntries();
        res.json(detectIssues(entries));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/save', (req, res) => {
    const { _file, _fileType, _key, _category, id, ...data } = req.body;

    // id is a real field in structured/consolidated entries
    if (_fileType !== 'flat') data.id = id;

    try {
        const raw = readJson(_file);

        if (_fileType === 'flat') {
            // id was generated from the key, not a real field — don't persist it
            raw[_key] = data;

        } else if (_fileType === 'structured') {
            const idx = raw.entries.findIndex(e => e.id === id);
            if (idx < 0) return res.status(404).json({ error: `Entry "${id}" not found in ${_file}` });
            raw.entries[idx] = data;

        } else if (_fileType === 'consolidated') {
            const catArr = raw.categories && raw.categories[_category];
            if (!catArr) return res.status(404).json({ error: `Category "${_category}" not found in ${_file}` });
            const idx = catArr.findIndex(e => e.id === id);
            if (idx < 0) return res.status(404).json({ error: `Entry "${id}" not found in ${_file}/${_category}` });
            catArr[idx] = data;
        }

        writeJson(_file, raw);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n  Valley of Shadows — Campaign Data Review\n  → http://localhost:${PORT}\n`);
});
