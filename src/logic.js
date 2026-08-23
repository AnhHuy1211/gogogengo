export function buildCardsFromRows(rows = []) {
  const cards = [];

  rows.forEach((row, index) => {
    const vocab = String(
      row.語彙 ?? row.漢字 ?? row.word ?? row.front ?? ''
    ).trim();
    const reading = String(
      row.読み方 ?? row.かな ?? row.kana ?? row.reading ?? ''
    ).trim();
    const meaning = String(
      row.意味 ?? row.meaning ?? row.back ?? row.answer ?? ''
    ).trim();

    if (!vocab && !reading && !meaning) {
      return;
    }

    cards.push({
      id: `card-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
      word: vocab,
      reading,
      meaning
    });
  });

  return cards;
}

function isLikelyJapaneseText(value = '') {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(String(value));
}

export function normalizeLegacyCards(cards = []) {
  const map = new Map();

  cards.forEach((card) => {
    const originValue = String(card.origin || card.word || card.front || '').trim();
    const key = originValue || String(card.id || '').trim();
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        id: card.id || `legacy-${Math.random().toString(16).slice(2, 10)}`,
        word: originValue || String(card.front || card.word || '').trim(),
        reading: String(card.reading || '').trim(),
        meaning: String(card.meaning || '').trim()
      });
      return;
    }

    const existing = map.get(key);
    const frontValue = String(card.front || card.word || '').trim();
    const meaningValue = String(card.meaning || card.answer || card.back || '').trim();
    const readingValue = String(card.reading || (card.type === '語彙－読み方' || card.prompt === '読み方' ? frontValue : '') || '').trim();

    if (card.type === '意味－語彙' || card.prompt === '語彙') {
      existing.word = existing.word || originValue || String(card.word || frontValue || '').trim();
      if (frontValue && !isLikelyJapaneseText(frontValue)) {
        existing.meaning = frontValue;
      } else if (meaningValue) {
        existing.meaning = meaningValue;
      }
    } else if (card.type === '語彙－意味' || card.prompt === '意味') {
      existing.word = existing.word || originValue || frontValue || '';
      if (frontValue && isLikelyJapaneseText(frontValue)) {
        existing.word = frontValue;
      }
      if (meaningValue && !isLikelyJapaneseText(meaningValue)) {
        existing.meaning = meaningValue;
      }
    } else if (card.type === '語彙－読み方' || card.prompt === '読み方') {
      existing.reading = readingValue || existing.reading || '';
    }

    existing.word = existing.word || originValue || frontValue || '';
    existing.meaning = existing.meaning || meaningValue || '';
    existing.reading = existing.reading || readingValue || '';
  });

  return Array.from(map.values()).map((card) => ({
    id: card.id,
    word: card.word || '',
    reading: card.reading || '',
    meaning: card.meaning || ''
  }));
}

export function generatePracticeSetName(baseName, existingNames = []) {
  const trimmedBase = String(baseName).trim();
  if (!existingNames.includes(trimmedBase)) {
    return trimmedBase;
  }

  let sequence = 1;
  let candidate = `${trimmedBase} ${sequence}`;

  while (existingNames.includes(candidate)) {
    sequence += 1;
    candidate = `${trimmedBase} ${sequence}`;
  }

  return candidate;
}

export function sanitizeSetName(value, existingNames = [], currentName = '') {
  const trimmed = String(value ?? '').trim();
  const safeExisting = (existingNames || [])
    .map((name) => String(name ?? '').trim())
    .filter(Boolean);
  const keepCurrent = currentName ? String(currentName).trim() : '';

  if (!trimmed) {
    if (keepCurrent) {
      return keepCurrent;
    }

    return safeExisting[0] || 'Untitled list';
  }

  const normalized = trimmed;

  if (normalized === keepCurrent) {
    return normalized;
  }

  if (!safeExisting.includes(normalized)) {
    return normalized;
  }

  let sequence = 1;
  let candidate = `${normalized} ${sequence}`;
  while (safeExisting.includes(candidate)) {
    sequence += 1;
    candidate = `${normalized} ${sequence}`;
  }

  return candidate;
}
