import fs from 'node:fs';
import { normalizeLegacyCards } from '../src/logic.js';

const dbPath = new URL('../data/db.json', import.meta.url);
const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const sets = Array.isArray(raw.sets) ? raw.sets : [];

const next = {
  ...raw,
  sets: sets.map((set) => ({
    ...set,
    cards: normalizeLegacyCards(Array.isArray(set.cards) ? set.cards : []).map((card) => ({
      id: card.id,
      word: card.word,
      reading: card.reading,
      meaning: card.meaning
    }))
  }))
};

fs.writeFileSync(dbPath, JSON.stringify(next, null, 2));
console.log('Updated DB to minimal schema');
console.log('Sets:', next.sets.length);
console.log('Sample:', JSON.stringify(next.sets[0]?.cards?.[0] ?? null));
