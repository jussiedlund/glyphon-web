/* global PFM */

document.addEventListener('DOMContentLoaded', () => {
  // Render Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Load auto-saved project if available
  const saved = PFM.storage.loadAutoSave();
  if (saved) {
    PFM.state.dispatch({ type: 'LOAD_PROJECT', project: saved });
  }

  // Init modules
  PFM.canvasEditor.init(document.getElementById('grid-canvas'));
  PFM.charNavigator.init(document.getElementById('char-nav'));
  PFM.metricsPanel.init(document.getElementById('metrics-panel'));
  PFM.preview.init(
    document.getElementById('preview-canvas'),
    document.getElementById('preview-input'),
  );
  PFM.shortcuts.init();

  // Auto-save on every state change; keep paste button in sync
  PFM.state.subscribe((state) => {
    PFM.storage.autoSave(state);
    _updateTitle(state);
    _updateUndoButtons();
    _updatePasteButton();
  });

  // ── Toolbar wiring ──────────────────────────────────────────────────────

  // Tool buttons
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      PFM.canvasEditor.setTool(tool);
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    });
  });

  // Zoom buttons
  document.getElementById('zoom-in-btn') ?.addEventListener('click', () => PFM.canvasEditor.zoomIn());
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => PFM.canvasEditor.zoomOut());
  document.getElementById('zoom-fit-btn')?.addEventListener('click', () => PFM.canvasEditor.resetZoom());

  // Library button
  document.getElementById('library-btn')?.addEventListener('click', () => PFM.libraryPanel.open());

  // Undo/redo buttons
  document.getElementById('undo-btn')?.addEventListener('click', () => PFM.state.dispatch({ type: 'UNDO' }));
  document.getElementById('redo-btn')?.addEventListener('click', () => PFM.state.dispatch({ type: 'REDO' }));

  // Export buttons
  document.getElementById('export-ttf-btn')?.addEventListener('click', () => PFM.exportTTF());
  document.getElementById('export-bdf-btn')?.addEventListener('click', () => PFM.exportBDF());
  document.getElementById('export-json-btn')?.addEventListener('click', () => PFM.exportJSON());

  // Import JSON via file input
  const importInput = document.getElementById('import-file-input');
  document.getElementById('import-btn')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const project = await PFM.importJSON(file);
      if (confirm(`Load "${project.meta.name || 'Untitled'}"? Unsaved changes will be lost.`)) {
        PFM.state.dispatch({ type: 'LOAD_PROJECT', project });
      }
    } catch (err) {
      alert(`Could not load file: ${err.message}`);
    }
    importInput.value = '';
  });

  // Drag-and-drop import
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', async e => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.json')) return;
    try {
      const project = await PFM.importJSON(file);
      if (confirm(`Load "${project.meta.name || 'Untitled'}"? Unsaved changes will be lost.`)) {
        PFM.state.dispatch({ type: 'LOAD_PROJECT', project });
      }
    } catch (err) {
      alert(`Could not load file: ${err.message}`);
    }
  });

  // Glyph transform buttons
  document.getElementById('flip-h-btn')?.addEventListener('click', () => {
    PFM.state.dispatch({ type: 'FLIP_H', codePoint: PFM.state.getState().activeCodePoint });
  });
  document.getElementById('flip-v-btn')?.addEventListener('click', () => {
    PFM.state.dispatch({ type: 'FLIP_V', codePoint: PFM.state.getState().activeCodePoint });
  });
  document.getElementById('clear-glyph-btn')?.addEventListener('click', () => {
    const cp = PFM.state.getState().activeCodePoint;
    PFM.state.dispatch({ type: 'CLEAR_GLYPH', codePoint: cp });
  });

  // Copy / Paste glyph pixels
  document.getElementById('copy-glyph-btn')?.addEventListener('click', () => {
    PFM.shortcuts.copyGlyph();
    _updatePasteButton();
  });
  document.getElementById('paste-glyph-btn')?.addEventListener('click', () => {
    PFM.shortcuts.pasteGlyph();
  });

  // Toggle guides
  document.getElementById('toggle-guides-btn')?.addEventListener('click', (e) => {
    const visible = PFM.canvasEditor.toggleGuides();
    e.currentTarget.setAttribute('aria-pressed', visible);
    e.currentTarget.style.color = visible ? '' : 'var(--text-2)';
  });

  // Shift buttons
  [
    { id: 'shift-up-btn',    dx:  0, dy: -1 },
    { id: 'shift-down-btn',  dx:  0, dy:  1 },
    { id: 'shift-left-btn',  dx: -1, dy:  0 },
    { id: 'shift-right-btn', dx:  1, dy:  0 },
  ].forEach(({ id, dx, dy }) => {
    document.getElementById(id)?.addEventListener('click', () => {
      PFM.state.dispatch({ type: 'SHIFT_PIXELS', codePoint: PFM.state.getState().activeCodePoint, dx, dy });
    });
  });

  // Help button
  document.getElementById('help-btn')?.addEventListener('click', () => {
    const evt = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    document.dispatchEvent(evt);
  });

  // ── Preview scale ───────────────────────────────────────────────────────
  // (handled inside preview.js)

  // Initial title
  _updateTitle(PFM.state.getState());
  _updateUndoButtons();
});

function _updateTitle(state) {
  const name = state.meta.name || 'Untitled';
  document.title = `${name} – Glyphon`;
  const el = document.getElementById('current-font-name');
  if (el) el.textContent = name;
}

function _updateUndoButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) undoBtn.disabled = !PFM.state.canUndo();
  if (redoBtn) redoBtn.disabled = !PFM.state.canRedo();
}

function _updatePasteButton() {
  const pasteBtn = document.getElementById('paste-glyph-btn');
  if (pasteBtn) pasteBtn.disabled = !PFM.shortcuts.canPaste();
}
