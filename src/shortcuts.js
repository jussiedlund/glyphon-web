/* global PFM */

PFM.shortcuts = (() => {
  let _clipboardPixels = null;
  let _clipboardDims   = null; // { w, h }

  function _copyGlyph() {
    const state = PFM.state.getState();
    const g = state.glyphs[state.activeCodePoint];
    if (!g) return;
    _clipboardPixels = new Uint8Array(g.pixels);
    _clipboardDims   = { w: state.meta.glyphWidth, h: state.meta.glyphHeight };
  }

  function _pasteGlyph() {
    if (!_clipboardPixels) return;
    const state = PFM.state.getState();
    const { glyphWidth: gw, glyphHeight: gh } = state.meta;
    const { w: cw, h: ch } = _clipboardDims;
    let pixels;
    if (cw === gw && ch === gh) {
      pixels = new Uint8Array(_clipboardPixels);
    } else {
      pixels = new Uint8Array(gw * gh);
      for (let r = 0; r < Math.min(ch, gh); r++)
        for (let c = 0; c < Math.min(cw, gw); c++)
          pixels[r * gw + c] = _clipboardPixels[r * cw + c];
    }
    PFM.state.dispatch({ type: 'PAINT_PIXELS', codePoint: state.activeCodePoint, pixels });
  }

  const SHORTCUTS = [
    { key: 'z', mod: 'ctrl', label: 'Undo',              action: () => PFM.state.dispatch({ type: 'UNDO' }) },
    { key: 'z', mod: 'ctrl+shift', label: 'Redo',        action: () => PFM.state.dispatch({ type: 'REDO' }) },
    { key: 'y', mod: 'ctrl', label: 'Redo',              action: () => PFM.state.dispatch({ type: 'REDO' }) },
    { key: 's', mod: 'ctrl', label: 'Save (JSON)',        action: () => PFM.exportJSON() },
    { key: 'e', mod: 'ctrl', label: 'Export TTF',         action: () => PFM.exportTTF() },
    { key: 'c', mod: 'ctrl', label: 'Copy glyph',        action: _copyGlyph },
    { key: 'v', mod: 'ctrl', label: 'Paste glyph',       action: _pasteGlyph },

    { key: 'b', label: 'Draw tool',      action: () => { PFM.canvasEditor.setTool('draw'); _syncToolBtns(); } },
    { key: 'f', label: 'Fill tool',      action: () => { PFM.canvasEditor.setTool('fill'); _syncToolBtns(); } },
    { key: 'g', label: 'Toggle grid',    action: () => PFM.canvasEditor.toggleGrid() },

    { key: '+', label: 'Zoom in',        action: () => PFM.canvasEditor.zoomIn() },
    { key: '=', label: 'Zoom in',        action: () => PFM.canvasEditor.zoomIn() },
    { key: '-', label: 'Zoom out',       action: () => PFM.canvasEditor.zoomOut() },
    { key: '0', label: 'Reset zoom',     action: () => PFM.canvasEditor.resetZoom() },

    { key: 'ArrowLeft',  label: 'Prev glyph',   action: () => PFM.charNavigator.navigateDelta(-1) },
    { key: 'ArrowRight', label: 'Next glyph',   action: () => PFM.charNavigator.navigateDelta(1) },
    { key: 'ArrowLeft',  mod: 'alt', label: 'Prev 10', action: () => PFM.charNavigator.navigateDelta(-10) },
    { key: 'ArrowRight', mod: 'alt', label: 'Next 10', action: () => PFM.charNavigator.navigateDelta(10) },

    { key: 'Delete',    label: 'Clear glyph',   action: _clearGlyph },
    { key: 'Backspace', label: 'Clear glyph',   action: _clearGlyph },

    { key: 'h', label: 'Flip horizontal', action: () => _dispatchGlyph('FLIP_H') },
    { key: 'v', label: 'Flip vertical',   action: () => _dispatchGlyph('FLIP_V') },

    { key: 'H', mod: 'shift', label: 'Shift left',  action: () => _dispatchGlyph('SHIFT_PIXELS', { dx: -1 }) },
    { key: 'L', mod: 'shift', label: 'Shift right', action: () => _dispatchGlyph('SHIFT_PIXELS', { dx:  1 }) },
    { key: 'K', mod: 'shift', label: 'Shift up',    action: () => _dispatchGlyph('SHIFT_PIXELS', { dy: -1 }) },
    { key: 'J', mod: 'shift', label: 'Shift down',  action: () => _dispatchGlyph('SHIFT_PIXELS', { dy:  1 }) },

    { key: '?', label: 'Help',            action: _showHelp },
  ];

  function _dispatchGlyph(type, extra = {}) {
    const cp = PFM.state.getState().activeCodePoint;
    PFM.state.dispatch({ type, codePoint: cp, ...extra });
  }

  function _clearGlyph() {
    const cp = PFM.state.getState().activeCodePoint;
    PFM.state.dispatch({ type: 'CLEAR_GLYPH', codePoint: cp });
  }

  function _syncToolBtns() {
    const tool = PFM.canvasEditor.getTool();
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  function _mods(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey)  parts.push('alt');
    return parts.join('+');
  }

  function _onKeyDown(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      // Allow Ctrl+Z/Y/S/E even in inputs
      const mods = _mods(e);
      if (!['ctrl', 'ctrl+shift'].includes(mods)) return;
    }

    const mods = _mods(e);
    const key  = e.key;

    for (const sc of SHORTCUTS) {
      const scMod = sc.mod || '';
      if (sc.key === key && scMod === mods) {
        e.preventDefault();
        sc.action();
        return;
      }
    }
  }

  function init() {
    document.addEventListener('keydown', _onKeyDown);
  }

  function canPaste() { return _clipboardPixels !== null; }

  function _showHelp() {
    const existing = document.getElementById('help-modal');
    if (existing) { existing.remove(); return; }

    const shown = SHORTCUTS.filter((s, i, arr) =>
      arr.findIndex(x => x.label === s.label) === i
    );

    const modal = document.createElement('div');
    modal.id = 'help-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box modal-box--narrow">
        <div class="modal-header">
          <span class="modal-title">Keyboard Shortcuts</span>
          <button class="icon-btn modal-close-btn">✕</button>
        </div>
        <div class="modal-body shortcuts-list">
          ${shown.map(s => `
            <div class="shortcut-row">
              <kbd>${s.mod ? s.mod.replace('ctrl','⌘').replace('shift','⇧').replace('alt','⌥') + '+' : ''}${s.key}</kbd>
              <span>${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  return { init, copyGlyph: _copyGlyph, pasteGlyph: _pasteGlyph, canPaste };
})();
