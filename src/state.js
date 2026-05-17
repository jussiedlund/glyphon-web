/* global PFM */

PFM.state = (() => {
  const MAX_HISTORY = 50;

  let _state = PFM.createFontProject();
  let _undoStack = [];
  let _redoStack = [];
  const _listeners = new Set();

  function getState() { return _state; }

  function subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }

  function _notify(action) {
    for (const fn of _listeners) fn(_state, action);
  }

  function dispatch(action) {
    // Non-undoable navigation
    if (action.type === 'SET_ACTIVE_GLYPH') {
      _state.activeCodePoint = action.codePoint;
      _notify(action);
      return;
    }

    // Undo/redo
    if (action.type === 'UNDO') {
      if (!_undoStack.length) return;
      _redoStack.push(structuredClone(_state));
      _state = _undoStack.pop();
      _notify(action);
      return;
    }
    if (action.type === 'REDO') {
      if (!_redoStack.length) return;
      _undoStack.push(structuredClone(_state));
      _state = _redoStack.pop();
      _notify(action);
      return;
    }

    // Full project replace (no history)
    if (action.type === 'LOAD_PROJECT') {
      _state = PFM.deserializeProject(action.project);
      _undoStack = [];
      _redoStack = [];
      _notify(action);
      return;
    }

    // All other actions are undoable
    _undoStack.push(structuredClone(_state));
    if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
    _redoStack = [];

    const { meta, glyphs } = _state;

    switch (action.type) {
      case 'PAINT_PIXELS': {
        const g = glyphs[action.codePoint];
        if (g) g.pixels = new Uint8Array(action.pixels);
        break;
      }

      case 'SET_META': {
        Object.assign(meta, action.meta);
        break;
      }

      case 'ADD_GLYPH': {
        if (!glyphs[action.codePoint]) {
          glyphs[action.codePoint] = PFM.createGlyph(action.codePoint, meta.glyphWidth, meta.glyphHeight);
        }
        break;
      }

      case 'ADD_GLYPH_RANGE': {
        for (let cp = action.start; cp <= action.end; cp++) {
          if (!glyphs[cp]) {
            glyphs[cp] = PFM.createGlyph(cp, meta.glyphWidth, meta.glyphHeight);
          }
        }
        break;
      }

      case 'REMOVE_GLYPH': {
        delete glyphs[action.codePoint];
        break;
      }

      case 'CLEAR_GLYPH': {
        const g = glyphs[action.codePoint];
        if (g) g.pixels = new Uint8Array(g.pixels.length);
        break;
      }

      case 'RESIZE_GRID': {
        const { newWidth: nw, newHeight: nh } = action;
        const { glyphWidth: ow, glyphHeight: oh } = meta;
        for (const cp of Object.keys(glyphs)) {
          const g = glyphs[cp];
          const np = new Uint8Array(nw * nh);
          for (let r = 0; r < Math.min(oh, nh); r++) {
            for (let c = 0; c < Math.min(ow, nw); c++) {
              np[r * nw + c] = g.pixels[r * ow + c];
            }
          }
          g.pixels = np;
        }
        meta.glyphWidth = nw;
        meta.glyphHeight = nh;
        break;
      }

      case 'FLIP_H': {
        const g = glyphs[action.codePoint];
        if (!g) break;
        const { glyphWidth: w, glyphHeight: h } = meta;
        const ox = meta.originX ?? 0;
        const np = new Uint8Array(w * h);
        for (let r = 0; r < h; r++)
          for (let c = 0; c < w; c++) {
            // Bearing columns (< originX) stay in place.
            // Active area [originX, w-1] flips around its own centre axis.
            const fc = c < ox ? c : ox + (w - 1 - c);
            np[r * w + fc] = g.pixels[r * w + c];
          }
        g.pixels = np;
        break;
      }

      case 'SET_GLYPH_ADVANCE': {
        const g = glyphs[action.codePoint];
        if (g) g.advanceWidth = action.value; // null = revert to font default
        break;
      }

      case 'FLIP_V': {
        const g = glyphs[action.codePoint];
        if (!g) break;
        const { glyphWidth: w, glyphHeight: h } = meta;
        const np = new Uint8Array(w * h);
        for (let r = 0; r < h; r++)
          for (let c = 0; c < w; c++)
            np[r * w + c] = g.pixels[(h - 1 - r) * w + c];
        g.pixels = np;
        break;
      }

      case 'SHIFT_PIXELS': {
        const g = glyphs[action.codePoint];
        if (!g) break;
        const { glyphWidth: w, glyphHeight: h } = meta;
        const { dx = 0, dy = 0 } = action;
        const np = new Uint8Array(w * h);
        for (let r = 0; r < h; r++) {
          const nr = r + dy;
          if (nr < 0 || nr >= h) continue;
          for (let c = 0; c < w; c++) {
            const nc = c + dx;
            if (nc < 0 || nc >= w) continue;
            np[nr * w + nc] = g.pixels[r * w + c];
          }
        }
        g.pixels = np;
        break;
      }

      case 'GROW_LEFT': {
        // Expand grid left by action.cols columns, shifting all pixel content right
        const expand = action.cols || 1;
        const { glyphWidth: ow, glyphHeight: oh } = meta;
        const nw = ow + expand;
        for (const cp of Object.keys(glyphs)) {
          const g = glyphs[cp];
          const np = new Uint8Array(nw * oh);
          for (let r = 0; r < oh; r++)
            for (let c = 0; c < ow; c++)
              np[r * nw + (c + expand)] = g.pixels[r * ow + c];
          g.pixels = np;
        }
        meta.glyphWidth = nw;
        // Shift advance/metric references right by expand
        meta.advanceWidth += expand;
        meta.ascender     += 0; // row indices unchanged (vertical only)
        // Shift the canvas offset so the origin line stays in place visually
        // (canvas-editor handles this via _lastGridKey re-centre logic)
        break;
      }

      case 'FLOOD_FILL': {
        const g = glyphs[action.codePoint];
        if (!g) break;
        const { row, col, value } = action;
        const { glyphWidth: w, glyphHeight: h } = meta;
        const pixels = new Uint8Array(g.pixels);
        const target = pixels[row * w + col];
        if (target === value) break;
        const stack = [[row, col]];
        while (stack.length) {
          const [r, c] = stack.pop();
          if (r < 0 || r >= h || c < 0 || c >= w) continue;
          if (pixels[r * w + c] !== target) continue;
          pixels[r * w + c] = value;
          stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
        }
        g.pixels = pixels;
        break;
      }
    }

    _notify(action);
  }

  function canUndo() { return _undoStack.length > 0; }
  function canRedo() { return _redoStack.length > 0; }

  return { getState, subscribe, dispatch, canUndo, canRedo };
})();
