import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCardsFromRows,
  generatePracticeSetName,
  normalizeLegacyCards,
  sanitizeSetName
} from '../src/logic.js';

test('buildCardsFromRows creates one item per vocabulary entry', () => {
  const rows = [
    { 語彙: '勉強', 読み方: 'べんきょう', 意味: 'học' },
    { 語彙: '食べる', 読み方: 'たべる', 意味: 'ăn' }
  ];

  const cards = buildCardsFromRows(rows);

  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], {
    id: cards[0].id,
    word: '勉強',
    reading: 'べんきょう',
    meaning: 'học'
  });
  assert.equal(cards[1].word, '食べる');
  assert.equal(cards[1].reading, 'たべる');
});

test('normalizeLegacyCards rehydrates old duplicated card pairs into one usable item', () => {
  const legacyCards = [
    { id: 'row-1', front: '勉強', type: '語彙－意味', origin: '勉強', prompt: '意味' },
    { id: 'row-1', front: 'học', type: '意味－語彙', origin: '勉強', prompt: '語彙' },
    { id: 'row-1', front: 'べんきょう', type: '語彙－読み方', origin: '勉強', prompt: '読み方' }
  ];

  const normalized = normalizeLegacyCards(legacyCards);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].word, '勉強');
  assert.equal(normalized[0].reading, 'べんきょう');
  assert.equal(normalized[0].meaning, 'học');
  assert.equal(Object.keys(normalized[0]).sort().join(','), 'id,meaning,reading,word');
});

test('buildCardsFromRows supports Excel columns in 漢字 / かな / 意味 format', () => {
  const rows = [
    { 漢字: '家族', かな: 'かぞく', 意味: 'gia đình' },
    { word: '友達', reading: 'ともだち', meaning: 'bạn bè' }
  ];

  const cards = buildCardsFromRows(rows);

  assert.equal(cards.length, 2);
  assert.equal(cards[0].word, '家族');
  assert.equal(cards[0].reading, 'かぞく');
  assert.equal(cards[0].meaning, 'gia đình');
  assert.equal(cards[1].word, '友達');
  assert.equal(cards[1].reading, 'ともだち');
  assert.equal(cards[1].meaning, 'bạn bè');
});

test('generatePracticeSetName appends suffix when duplicate exists', () => {
  const existing = ['2026-08-18', '2026-08-18 1', '2026-08-18 2'];
  assert.equal(generatePracticeSetName('2026-08-18', existing), '2026-08-18 3');
  assert.equal(generatePracticeSetName('2026-08-19', existing), '2026-08-19');
});

test('sanitizeSetName trims blanks and avoids duplicate names during rename', () => {
  assert.equal(sanitizeSetName('   My Set  ', ['My Set', 'My Set 1']), 'My Set 2');
  assert.equal(sanitizeSetName('   ', ['Vocabulary']), 'Vocabulary');
  assert.equal(sanitizeSetName('New Name', ['New Name'], 'New Name'), 'New Name');
  assert.equal(sanitizeSetName('   ', []), 'Untitled list');
});
