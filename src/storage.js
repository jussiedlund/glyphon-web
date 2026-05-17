/* global PFM */

PFM.storage = (() => {
  const AUTOSAVE_KEY    = 'pfm-autosave';
  const LIBRARY_IDX_KEY = 'pfm-library-index';
  const LIBRARY_ITEM_PREFIX = 'pfm-font-';
  let _autoSaveTimer;

  // ── Auto-save ──────────────────────────────────────────────────────────────

  function autoSave(project) {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(PFM.serializeProject(project)));
      } catch (e) {
        console.warn('Auto-save failed:', e);
      }
    }, 1000);
  }

  function loadAutoSave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;
      return PFM.deserializeProject(JSON.parse(raw));
    } catch (e) {
      console.warn('Could not load auto-save:', e);
      return null;
    }
  }

  // ── Font Library ───────────────────────────────────────────────────────────

  function _loadIndex() {
    try {
      return JSON.parse(localStorage.getItem(LIBRARY_IDX_KEY) || '[]');
    } catch { return []; }
  }

  function _saveIndex(index) {
    localStorage.setItem(LIBRARY_IDX_KEY, JSON.stringify(index));
  }

  function listFonts() {
    return _loadIndex().sort((a, b) => b.lastModified - a.lastModified);
  }

  function saveFont(project) {
    const id = project._libraryId || _uuid();
    const name = project.meta.name || 'Untitled';
    const index = _loadIndex();
    const existing = index.findIndex(e => e.id === id);
    const entry = { id, name, lastModified: Date.now(), glyphCount: Object.keys(project.glyphs).length };

    if (existing >= 0) index[existing] = entry;
    else index.push(entry);

    _saveIndex(index);
    localStorage.setItem(LIBRARY_ITEM_PREFIX + id, JSON.stringify(PFM.serializeProject(project)));

    // Attach id to project so future saves update the same slot
    project._libraryId = id;
    return id;
  }

  function loadFont(id) {
    try {
      const raw = localStorage.getItem(LIBRARY_ITEM_PREFIX + id);
      if (!raw) return null;
      const project = PFM.deserializeProject(JSON.parse(raw));
      project._libraryId = id;
      return project;
    } catch (e) {
      console.warn('Could not load font:', e);
      return null;
    }
  }

  function deleteFont(id) {
    const index = _loadIndex().filter(e => e.id !== id);
    _saveIndex(index);
    localStorage.removeItem(LIBRARY_ITEM_PREFIX + id);
  }

  function renameFont(id, newName) {
    const index = _loadIndex();
    const entry = index.find(e => e.id === id);
    if (entry) {
      entry.name = newName;
      _saveIndex(index);
    }
  }

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  return { autoSave, loadAutoSave, listFonts, saveFont, loadFont, deleteFont, renameFont };
})();

// ── Font Library Panel ─────────────────────────────────────────────────────

PFM.libraryPanel = (() => {
  let _overlay;

  function open() {
    if (_overlay) { close(); return; }

    _overlay = document.createElement('div');
    _overlay.id = 'library-overlay';
    _overlay.className = 'modal-overlay';
    _overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">Font Library</span>
          <button class="icon-btn modal-close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="library-actions">
            <button class="btn-primary" id="lib-save-btn">Save current font</button>
            <button class="btn-secondary" id="lib-new-btn">New font</button>
          </div>
          <div id="library-list"></div>
        </div>
      </div>
    `;

    _overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
    _overlay.querySelector('#lib-save-btn').addEventListener('click', _saveCurrentFont);
    _overlay.querySelector('#lib-new-btn').addEventListener('click', _newFont);

    document.body.appendChild(_overlay);
    _renderList();
  }

  function close() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
  }

  function _renderList() {
    const list = document.getElementById('library-list');
    if (!list) return;
    const fonts = PFM.storage.listFonts();

    if (!fonts.length) {
      list.innerHTML = '<div class="library-empty">No saved fonts yet.</div>';
      return;
    }

    list.innerHTML = fonts.map(f => `
      <div class="library-item" data-id="${f.id}">
        <div class="library-item-info">
          <span class="library-item-name">${_esc(f.name)}</span>
          <span class="library-item-meta">${f.glyphCount} glyphs · ${_fmtDate(f.lastModified)}</span>
        </div>
        <div class="library-item-actions">
          <button class="btn-secondary lib-load-btn" data-id="${f.id}">Load</button>
          <button class="btn-danger lib-delete-btn" data-id="${f.id}">✕</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.lib-load-btn').forEach(btn => {
      btn.addEventListener('click', () => _loadFont(btn.dataset.id));
    });
    list.querySelectorAll('.lib-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => _deleteFont(btn.dataset.id));
    });
  }

  function _saveCurrentFont() {
    const state = PFM.state.getState();
    PFM.storage.saveFont(state);
    _renderList();
    _showToast(`"${state.meta.name || 'Untitled'}" saved to library`);
  }

  function _loadFont(id) {
    const project = PFM.storage.loadFont(id);
    if (!project) return;
    if (confirm(`Load "${project.meta.name || 'Untitled'}"? Unsaved changes will be lost.`)) {
      PFM.state.dispatch({ type: 'LOAD_PROJECT', project });
      close();
    }
  }

  function _deleteFont(id) {
    const fonts = PFM.storage.listFonts();
    const font = fonts.find(f => f.id === id);
    if (!font) return;
    if (confirm(`Delete "${font.name}"? This cannot be undone.`)) {
      PFM.storage.deleteFont(id);
      _renderList();
    }
  }

  function _newFont() {
    if (confirm('Start a new font? Unsaved changes will be lost.')) {
      PFM.state.dispatch({ type: 'LOAD_PROJECT', project: PFM.createFontProject() });
      close();
    }
  }

  function _fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { open, close };
})();

function _showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-visible'), 10);
  setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(() => t.remove(), 300); }, 2500);
}
