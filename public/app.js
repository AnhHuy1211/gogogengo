const state = {
  sets: [],
  selectedSetId: null,
  hiddenColumns: {
    kanji: false,
    kana: false,
    meaning: false
  },
  hiddenCells: new Set()
};

const appRoot = document.getElementById('app');

function getSelectedSet() {
  return state.sets.find((set) => set.id === state.selectedSetId) || null;
}

function getPracticeStats(set) {
  const cards = set?.cards || [];
  return {
    total: cards.length
  };
}

function getCellKey(cardId, column) {
  return `${cardId}:${column}`;
}

function isCellHidden(cardId, column) {
  return state.hiddenColumns[column] || state.hiddenCells.has(getCellKey(cardId, column));
}

function toggleColumn(column) {
  state.hiddenColumns[column] = !state.hiddenColumns[column];

  if (state.hiddenColumns[column]) {
    const set = getSelectedSet();
    (set?.cards || []).forEach((card) => {
      state.hiddenCells.add(getCellKey(card.id, column));
    });
  } else {
    const set = getSelectedSet();
    (set?.cards || []).forEach((card) => {
      state.hiddenCells.delete(getCellKey(card.id, column));
    });
  }

  renderSetDetail();
}

function toggleCell(cardId, column) {
  if (state.hiddenColumns[column]) {
    state.hiddenColumns[column] = false;
  }

  const key = getCellKey(cardId, column);
  if (state.hiddenCells.has(key)) {
    state.hiddenCells.delete(key);
  } else {
    state.hiddenCells.add(key);
  }

  renderSetDetail();
}

function renderHomePage() {
  appRoot.innerHTML = `
    <main class="page-shell">
      <header class="hero">
        <div class="hero-badge">Japanese Vocabulary</div>
        <h1>Gogogengo</h1>
        <p class="hero-subtitle">A clean and focused vocabulary workspace for Japanese study.</p>
      </header>

      <section class="panel upload-panel">
        <div class="upload-topline">
          <span class="upload-icon">📥</span>
          <h2>Import Excel file</h2>
        </div>

        <form id="excelForm" class="excel-form">
          <label for="excelFile" class="upload-dropzone">
            <input id="excelFile" name="excelFile" type="file" accept=".xlsx,.xls" required />
            <span class="upload-graphic">📄</span>
            <span class="upload-copy">
              <strong>Choose a spreadsheet</strong>
              <small>.xlsx or .xls</small>
            </span>
            <span class="upload-browse">Browse</span>
          </label>

          <div id="fileNameDisplay" class="file-name">No file selected</div>
          <button type="submit" class="primary">Create vocabulary set</button>
        </form>
      </section>

      <section class="panel">
        <h2>Vocabulary list</h2>
        <ul id="setsList" class="set-list"></ul>
      </section>
    </main>
  `;

  const excelForm = document.getElementById('excelForm');
  const fileInput = document.getElementById('excelFile');
  const fileNameDisplay = document.getElementById('fileNameDisplay');

  excelForm?.addEventListener('submit', handleExcelUpload);
  fileInput?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    fileNameDisplay.textContent = file ? file.name : 'No file selected';
  });

  renderSets();
}

function renderSets() {
  const setsList = document.getElementById('setsList');
  if (!setsList) return;

  setsList.innerHTML = '';
  if (!state.sets.length) {
    setsList.innerHTML = '<li class="empty-state">No vocabulary sets yet.</li>';
    return;
  }

  state.sets.forEach((set) => {
    const item = document.createElement('li');
    item.className = 'set-item';
    const stats = getPracticeStats(set);
    item.innerHTML = `
      <div class="set-meta">
        <span class="stat-mini">${stats.total} words</span>
        <div>
          <span class="set-name">${set.name}</span>
          <span class="set-datetime">${new Date(set.createdAt).toLocaleString('en-US')}</span>
        </div>
      </div>
      <div class="set-actions">
        <button class="primary" data-action="open-set" data-id="${set.id}">View table</button>
        <button class="danger" data-action="delete-set" data-id="${set.id}">Delete</button>
      </div>
    `;
    setsList.appendChild(item);
  });
}

async function fetchSets() {
  const response = await fetch('/api/sets');
  const data = await response.json();
  state.sets = data;
  renderSets();
}

async function openSet(setId) {
  const response = await fetch(`/api/sets/${setId}`);
  const set = await response.json();
  state.selectedSetId = setId;
  renderSetDetail(set);
}

function renderCellValue(card, column) {
  if (column === 'kanji') {
    return card.word || '—';
  }
  if (column === 'kana') {
    return card.reading || '—';
  }
  return card.meaning || '—';
}

function renderCell(card, column) {
  const hidden = isCellHidden(card.id, column);
  const label = hidden ? 'Reveal cell' : 'Hide cell';
  const value = renderCellValue(card, column);
  return `
    <button
      type="button"
      class="cell-button ${hidden ? 'hidden' : ''}"
      data-action="toggle-cell"
      data-card-id="${card.id}"
      data-column="${column}"
      title="${label}"
    >
      ${hidden ? '■' : value}
    </button>
  `;
}

function renderSetDetail(set = getSelectedSet()) {
  if (!set) {
    renderHomePage();
    return;
  }

  const cards = set.cards || [];
  const stats = getPracticeStats(set);

  appRoot.innerHTML = `
    <main class="table-shell">
      <div class="practice-header">
        <div>
          <p class="eyebrow">Vocabulary set</p>
          <h1>${set.name}</h1>
        </div>
        <button class="secondary" id="backHome">Back to list</button>
      </div>

      <section class="panel summary-grid">
        <div class="summary-card">
          <span>Total</span>
          <strong>${stats.total}</strong>
        </div>
      </section>

      <section class="panel table-panel">
        <div class="table-toolbar">
          <h3>Vocabulary table</h3>
          <div class="inline-actions">
            <button class="secondary" data-action="toggle-column" data-column="kanji">
              ${state.hiddenColumns.kanji ? 'Show' : 'Hide'} 漢字
            </button>
            <button class="secondary" data-action="toggle-column" data-column="kana">
              ${state.hiddenColumns.kana ? 'Show' : 'Hide'} かな
            </button>
            <button class="secondary" data-action="toggle-column" data-column="meaning">
              ${state.hiddenColumns.meaning ? 'Show' : 'Hide'} 意味
            </button>
          </div>
        </div>

        <div class="table-wrap">
          <table class="vocab-table">
            <thead>
              <tr>
                <th>漢字</th>
                <th>かな</th>
                <th>意味</th>
              </tr>
            </thead>
            <tbody>
              ${cards.map((card) => `
                <tr>
                  <td>${renderCell(card, 'kanji')}</td>
                  <td>${renderCell(card, 'kana')}</td>
                  <td>${renderCell(card, 'meaning')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `;

  document.getElementById('backHome')?.addEventListener('click', () => {
    state.selectedSetId = null;
    renderHomePage();
  });
}

async function handleExcelUpload(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const file = formData.get('excelFile');
  if (!file || !file.name) {
    alert('Please choose an Excel file.');
    return;
  }

  const response = await fetch('/api/sets/import', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  if (!response.ok) {
    alert(result.message || 'Unable to create the vocabulary set.');
    return;
  }

  event.currentTarget.reset();
  state.selectedSetId = null;
  state.hiddenColumns = { kanji: false, kana: false, meaning: false };
  state.hiddenCells = new Set();

  const createdSet = result;
  state.sets = [createdSet, ...state.sets.filter((set) => set.id !== createdSet.id)];

  renderHomePage();
  await fetchSets();
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchSets();
  renderHomePage();
});

document.addEventListener('click', async (event) => {
  const action = event.target.dataset.action;
  const column = event.target.dataset.column;
  const cardId = event.target.dataset.cardId;

  if (action === 'open-set') {
    const setId = event.target.dataset.id;
    await openSet(setId);
    return;
  }

  if (action === 'delete-set') {
    const setId = event.target.dataset.id;
    const response = await fetch(`/api/sets/${setId}`, { method: 'DELETE' });
    if (!response.ok) {
      alert('Unable to delete the vocabulary set.');
      return;
    }

    state.selectedSetId = null;
    state.hiddenColumns = { kanji: false, kana: false, meaning: false };
    state.hiddenCells = new Set();
    await fetchSets();
    renderHomePage();
    return;
  }

  if (action === 'toggle-column') {
    if (column) {
      toggleColumn(column);
    }
    return;
  }

  if (action === 'toggle-cell') {
    if (column && cardId) {
      toggleCell(cardId, column);
    }
  }
});
