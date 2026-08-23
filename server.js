import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import {
  buildCardsFromRows,
  generatePracticeSetName,
  normalizeLegacyCards,
  sanitizeSetName
} from './src/logic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

async function ensureDbExists() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ sets: [] }, null, 2), 'utf8');
  }
}

function sanitizeDbData(data = {}) {
  const safeDb = { sets: Array.isArray(data.sets) ? data.sets : [] };
  let changed = false;

  safeDb.sets = safeDb.sets.map((set) => {
    const originalCards = Array.isArray(set?.cards) ? set.cards : [];
    const normalizedCards = normalizeLegacyCards(originalCards).map(({ id, word, reading, meaning }) => ({
      id,
      word,
      reading,
      meaning
    }));

    if (JSON.stringify(originalCards) !== JSON.stringify(normalizedCards)) {
      changed = true;
    }

    return {
      ...set,
      cards: normalizedCards
    };
  });

  return { data: safeDb, changed };
}

async function readDb() {
  await ensureDbExists();
  const content = await fs.readFile(DATA_FILE, 'utf8');
  if (!content.trim()) {
    return { sets: [] };
  }

  const parsed = JSON.parse(content);
  const { data, changed } = sanitizeDbData(parsed);
  if (changed) {
    await writeDb(data);
  }
  return data;
}

async function writeDb(data) {
  await ensureDbExists();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanedKey = String(key).replace(/\uFEFF/g, '').replace(/\s+/g, '').trim();
    if (!cleanedKey) continue;

    if (['語彙', '漢字', 'word', 'front'].includes(cleanedKey)) normalized.語彙 = normalizeCellValue(value);
    if (['読み方', 'かな', 'kana', 'reading'].includes(cleanedKey)) normalized.読み方 = normalizeCellValue(value);
    if (['意味', 'meaning', 'back', 'answer'].includes(cleanedKey)) normalized.意味 = normalizeCellValue(value);
  }

  return normalized;
}

function buildCardFromBody(body, fallback = {}) {
  const word = normalizeCellValue(body.word ?? body.front ?? fallback.word ?? fallback.front ?? '');
  const reading = normalizeCellValue(body.reading ?? fallback.reading ?? '');
  const meaning = normalizeCellValue(
    body.meaning ?? body.back ?? body.answer ?? fallback.meaning ?? fallback.back ?? fallback.answer ?? ''
  );

  return {
    id: body.id || fallback.id || crypto.randomUUID(),
    word,
    reading,
    meaning
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/sets', async (_req, res) => {
  try {
    const db = await readDb();
    res.json(db.sets);
  } catch (error) {
    res.status(500).json({ message: 'Unable to read sets.', error: error.message });
  }
});

app.get('/api/sets/:id', async (req, res) => {
  try {
    const db = await readDb();
    const set = db.sets.find((item) => item.id === req.params.id);
    if (!set) {
      return res.status(404).json({ message: 'Set not found.' });
    }

    const normalizedCards = normalizeLegacyCards(set.cards || []);
    if (normalizedCards.length !== (set.cards || []).length) {
      set.cards = normalizedCards;
      await writeDb(db);
    } else if (normalizedCards.length && set.cards.some((card) => !card.word || !card.meaning)) {
      set.cards = normalizedCards;
      await writeDb(db);
    }

    return res.json(set);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to read set.', error: error.message });
  }
});

app.post('/api/sets/import', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Excel file is required.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ message: 'Excel file has no sheet.' });
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
    const normalizedRows = rows
      .map(normalizeRow)
      .filter((row) => Object.values(row).some((value) => normalizeCellValue(value) !== ''));

    if (!normalizedRows.length) {
      return res.status(400).json({ message: 'No valid data found in the Excel file.' });
    }

    const db = await readDb();
    const baseName = new Date().toISOString().split('T')[0];
    const setName = generatePracticeSetName(baseName, db.sets.map((set) => set.name));

    const newSet = {
      id: crypto.randomUUID(),
      name: setName,
      createdAt: new Date().toISOString(),
      cards: buildCardsFromRows(normalizedRows)
    };

    db.sets.unshift(newSet);
    await writeDb(db);

    return res.status(201).json(newSet);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to import Excel file.', error: error.message });
  }
});

app.post('/api/sets/:id/cards', async (req, res) => {
  try {
    const db = await readDb();
    const set = db.sets.find((item) => item.id === req.params.id);
    if (!set) {
      return res.status(404).json({ message: 'Set not found.' });
    }

    const card = buildCardFromBody(req.body);
    if (!card.word) {
      return res.status(400).json({ message: 'Word text is required.' });
    }

    set.cards.push(card);
    await writeDb(db);
    return res.status(201).json(card);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create flashcard.', error: error.message });
  }
});

app.put('/api/sets/:id/cards/:cardId', async (req, res) => {
  try {
    const db = await readDb();
    const set = db.sets.find((item) => item.id === req.params.id);
    if (!set) {
      return res.status(404).json({ message: 'Set not found.' });
    }

    const cardIndex = set.cards.findIndex((card) => card.id === req.params.cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ message: 'Flashcard not found.' });
    }

    const updatedCard = buildCardFromBody(req.body, set.cards[cardIndex]);
    set.cards[cardIndex] = updatedCard;

    await writeDb(db);
    return res.json(updatedCard);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update flashcard.', error: error.message });
  }
});

app.put('/api/sets/:id', async (req, res) => {
  try {
    const db = await readDb();
    const setIndex = db.sets.findIndex((item) => item.id === req.params.id);
    if (setIndex === -1) {
      return res.status(404).json({ message: 'Set not found.' });
    }

    const currentName = db.sets[setIndex].name || '';
    const incomingName = req.body?.name;
    const candidateName = typeof incomingName === 'string'
      ? sanitizeSetName(incomingName, db.sets.map((set) => set.name), currentName)
      : currentName;

    const updatedSet = {
      ...db.sets[setIndex],
      ...req.body,
      name: candidateName,
      cards: (req.body.cards || db.sets[setIndex].cards || []).map((card) => ({
        id: card.id || crypto.randomUUID(),
        word: normalizeCellValue(card.word ?? card.front ?? ''),
        reading: normalizeCellValue(card.reading ?? ''),
        meaning: normalizeCellValue(card.meaning ?? card.back ?? card.answer ?? '')
      }))
    };

    db.sets[setIndex] = updatedSet;
    await writeDb(db);
    return res.json(updatedSet);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update set.', error: error.message });
  }
});

app.delete('/api/sets/:id/cards/:cardId', async (req, res) => {
  try {
    const db = await readDb();
    const set = db.sets.find((item) => item.id === req.params.id);
    if (!set) {
      return res.status(404).json({ message: 'Set not found.' });
    }

    set.cards = set.cards.filter((card) => card.id !== req.params.cardId);
    await writeDb(db);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete flashcard.', error: error.message });
  }
});

app.delete('/api/sets/:id', async (req, res) => {
  try {
    const db = await readDb();
    const originalLength = db.sets.length;
    db.sets = db.sets.filter((set) => set.id !== req.params.id);

    if (db.sets.length === originalLength) {
      return res.status(404).json({ message: 'Set not found.' });
    }

    await writeDb(db);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete set.', error: error.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Japanese vocabulary app running at http://localhost:${PORT}`);
});
