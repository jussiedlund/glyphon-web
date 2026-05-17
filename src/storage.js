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

