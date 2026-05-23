/* global PFM */

PFM.canvasEditor = (() => {
  let _canvas, _ctx;
  let _pixelSize = 24;
  let _offsetX = 0, _offsetY = 0;
  let _tool = 'draw'; // 'draw' | 'fill'
  let _showGrid = true;
  let _isDrawing = false;
  let _workingPixels = null;
  let _beforePixels = null;
  let _lastCell = null;
  let _isPanning = false;
  let _panStart = null;
  let _drawValue = 1;
  let _lastGridKey = '';
  let _draggingGuide = null;
  let _guideDragRow  = null;
  let _showGuides    = true;
  let _pillContainer = null;

  const GUIDES = [
    { key: 'ascender',  label: 'Asc',  color: '#5b9cf6' },
    { key: 'capHeight', label: 'Cap',  color: '#4ec9b0' },
    { key: 'xHeight',   label: 'xH',   color: '#6ddc7c' },
    { key: 'baseline',  label: 'BL',   color: '#f5a623' },
    { key: 'descender', label: 'Desc', color: '#ff453a' },
  ];

  function init(canvasEl) {
    _canvas = canvasEl;
    _ctx = _canvas.getContext('2d');

    _canvas.addEventListener('mousedown',   _onMouseDown);
    _canvas.addEventListener('mousemove',   _onMouseMove);
    _canvas.addEventListener('mouseup',     _onMouseUp);
    _canvas.addEventListener('mouseleave',  _onMouseLeave);
    _canvas.addEventListener('contextmenu', e => e.preventDefault());
    _canvas.addEventListener('wheel',       _onWheel, { passive: false });

    _initPills();
    new ResizeObserver(_fitToContainer).observe(_canvas.parentElement);

    PFM.state.subscribe(() => {
      if (!_isDrawing) {
        // Re-centre whenever grid dimensions change (e.g. after import)
        const { glyphWidth: gw, glyphHeight: gh } = PFM.state.getState().meta;
        const key = `${gw}x${gh}`;
        if (key !== _lastGridKey) { _lastGridKey = key; _centerGrid(); }
        render();
      }
    });
  }

  function setTool(tool) {
    _tool = tool;
  }

  function getTool() { return _tool; }

  function toggleGrid() {
    _showGrid = !_showGrid;
    render();
  }

  function toggleGuides() {
    _showGuides = !_showGuides;
    render();
    return _showGuides;
  }

  // ── Guide pill handles ───────────────────────────────────────────────────
  // Pill <div> elements float to the right of the grid canvas, one per guide.
  // They handle all guide-drag interaction so accidental draws can never move
  // a guide line (the guide lines themselves have no hit-test on the canvas).

  function _initPills() {
    _pillContainer = document.getElementById('guide-pills');
    if (!_pillContainer) return;

    for (const g of GUIDES) {
      const pill = document.createElement('div');
      pill.className = 'guide-pill';
      pill.dataset.guide = g.key;
      pill.textContent = g.label;
      pill.style.setProperty('--pill-color', g.color);

      pill.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        pill.setPointerCapture(e.pointerId);
        _draggingGuide = g.key;
        _guideDragRow  = PFM.state.getState().meta[g.key];
        pill.classList.add('dragging');
        render();
      });

      pill.addEventListener('pointermove', e => {
        if (_draggingGuide !== g.key) return;
        const { glyphHeight: gh } = PFM.state.getState().meta;
        const rect = _canvas.getBoundingClientRect();
        _guideDragRow = Math.max(0, Math.min(gh - 1,
          Math.round((e.clientY - rect.top - _offsetY) / _pixelSize)
        ));
        render();
      });

      pill.addEventListener('pointerup', () => {
        if (_draggingGuide !== g.key) return;
        PFM.state.dispatch({ type: 'SET_META', meta: { [g.key]: _guideDragRow } });
        _draggingGuide = null;
        _guideDragRow  = null;
        pill.classList.remove('dragging');
      });

      _pillContainer.appendChild(pill);
    }
  }

  function _updatePills(metaRows) {
    if (!_pillContainer) return;
    _pillContainer.style.display = _showGuides ? '' : 'none';
    if (!_showGuides) return;

    const { glyphWidth: gw } = PFM.state.getState().meta;
    const rightX = _offsetX + gw * _pixelSize + 8;

    // Nudge pills apart so they never overlap (min 22px between centres)
    const PILL_SPACING = 22;
    const items = GUIDES
      .map(g => ({ key: g.key, guideY: _offsetY + metaRows[g.key] * _pixelSize }))
      .sort((a, b) => a.guideY - b.guideY);
    let prevY = -Infinity;
    const displayY = {};
    for (const item of items) {
      const y = Math.max(item.guideY, prevY + PILL_SPACING);
      displayY[item.key] = y;
      prevY = y;
    }

    _pillContainer.querySelectorAll('.guide-pill').forEach(pill => {
      const key  = pill.dataset.guide;
      pill.style.left      = `${rightX}px`;
      pill.style.top       = `${displayY[key]}px`;
      pill.style.transform = 'translateY(-50%)';
    });
  }

  function _fitToContainer() {
    const parent = _canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    _canvas.width  = w;
    _canvas.height = h;
    _centerGrid();
    render();
  }

  function _centerGrid() {
    const state = PFM.state.getState();
    const { glyphWidth: gw, glyphHeight: gh } = state.meta;
    const fitSize = Math.floor(Math.min(
      (_canvas.width  * 0.85) / gw,
      (_canvas.height * 0.85) / gh,
    ));
    _pixelSize = Math.max(4, Math.min(64, fitSize));
    _offsetX = Math.round((_canvas.width  - gw * _pixelSize) / 2);
    _offsetY = Math.round((_canvas.height - gh * _pixelSize) / 2);
  }

  function _cellAt(clientX, clientY) {
    const rect = _canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const state = PFM.state.getState();
    const col = Math.floor((mx - _offsetX) / _pixelSize);
    const row = Math.floor((my - _offsetY) / _pixelSize);
    const { glyphWidth: gw, glyphHeight: gh } = state.meta;
    if (col < 0 || col >= gw || row < 0 || row >= gh) return null;
    return { row, col };
  }

  function _paintCell(pixels, row, col, value, gw) {
    pixels[row * gw + col] = value;
  }

  function _bresenham(pixels, r0, c0, r1, c1, value, gw, gh) {
    let dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
    let sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
    let err = dr - dc;
    for (;;) {
      if (r0 >= 0 && r0 < gh && c0 >= 0 && c0 < gw) _paintCell(pixels, r0, c0, value, gw);
      if (r0 === r1 && c0 === c1) break;
      const e2 = 2 * err;
      if (e2 > -dc) { err -= dc; r0 += sr; }
      if (e2 <  dr) { err += dr; c0 += sc; }
    }
  }

  function _onMouseDown(e) {
    const state = PFM.state.getState();
    const glyph = state.glyphs[state.activeCodePoint];
    if (!glyph) return;

    // Middle mouse or alt+drag = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      _isPanning = true;
      _panStart = { x: e.clientX, y: e.clientY, ox: _offsetX, oy: _offsetY };
      _canvas.style.cursor = 'grabbing';
      return;
    }

    const cell = _cellAt(e.clientX, e.clientY);

    if (_tool === 'fill') {
      if (!cell) return;
      const value = e.button === 2 ? 0 : 1;
      PFM.state.dispatch({ type: 'FLOOD_FILL', codePoint: state.activeCodePoint, row: cell.row, col: cell.col, value });
      return;
    }

    if (!glyph) return;

    _isDrawing = true;
    _beforePixels = new Uint8Array(glyph.pixels);
    _workingPixels = new Uint8Array(glyph.pixels);

    if (cell) {
      const { glyphWidth: gw, glyphHeight: gh } = state.meta;
      // Right-click always erases; left-click toggles based on the pixel under cursor
      if (e.button === 2) {
        _drawValue = 0;
      } else {
        _drawValue = _workingPixels[cell.row * gw + cell.col] ? 0 : 1;
      }
      _bresenham(_workingPixels, cell.row, cell.col, cell.row, cell.col, _drawValue, gw, gh);
      _lastCell = cell;
      _renderWorking();
    }
  }

  function _onMouseMove(e) {
    if (_isPanning) {
      _offsetX = _panStart.ox + (e.clientX - _panStart.x);
      _offsetY = _panStart.oy + (e.clientY - _panStart.y);
      render();
      return;
    }

    if (!_isDrawing) return;

    const state = PFM.state.getState();
    const { glyphWidth: gw, glyphHeight: gh } = state.meta;
    const cell = _cellAt(e.clientX, e.clientY);
    if (!cell || !_lastCell) return;
    if (cell.row === _lastCell.row && cell.col === _lastCell.col) return;
    _bresenham(_workingPixels, _lastCell.row, _lastCell.col, cell.row, cell.col, _drawValue, gw, gh);
    _lastCell = cell;
    _renderWorking();
  }

  function _onMouseUp(e) {
    if (_isPanning) {
      _isPanning = false;
      _canvas.style.cursor = '';
      return;
    }

    if (!_isDrawing) return;
    _isDrawing = false;
    const state = PFM.state.getState();
    if (_workingPixels && !_arraysEqual(_workingPixels, _beforePixels)) {
      PFM.state.dispatch({ type: 'PAINT_PIXELS', codePoint: state.activeCodePoint, pixels: _workingPixels });
    }
    _workingPixels = null;
    _beforePixels = null;
    _lastCell = null;
  }

  function _onMouseLeave(e) {
    _onMouseUp(e);
  }

  function _onWheel(e) {
    e.preventDefault();
    // Pinch gesture (Mac trackpad) sends ctrlKey; CMD+scroll = explicit zoom request
    if (e.ctrlKey || e.metaKey) {
      const rect = _canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldSize = _pixelSize;
      const delta = e.deltaY < 0 ? 1 : -1;
      _pixelSize = Math.max(2, Math.min(64, _pixelSize + delta * Math.max(1, Math.floor(_pixelSize / 8))));
      _offsetX = mx - (_pixelSize / oldSize) * (mx - _offsetX);
      _offsetY = my - (_pixelSize / oldSize) * (my - _offsetY);
    } else {
      // Two-finger scroll = pan
      _offsetX -= e.deltaX;
      _offsetY -= e.deltaY;
    }
    render();
  }

  function _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function _renderWorking() {
    const state = PFM.state.getState();
    _drawGrid(state, _workingPixels);
  }

  function render() {
    const state = PFM.state.getState();
    const glyph = state.glyphs[state.activeCodePoint];
    _drawGrid(state, glyph ? glyph.pixels : null);
  }

  function _drawGrid(state, pixels) {
    if (!_ctx) return;
    const { glyphWidth: gw, glyphHeight: gh, baseline, ascender, descender, capHeight, xHeight } = state.meta;
    const originX = state.meta.originX ?? 0;
    const w = _canvas.width, h = _canvas.height;
    const ps = _pixelSize;
    const ox = _offsetX, oy = _offsetY;

    _ctx.clearRect(0, 0, w, h);

    // Background
    _ctx.fillStyle = '#0a0a0c';
    _ctx.fillRect(0, 0, w, h);

    // Glyph bounding box — slightly lighter than outer canvas
    _ctx.fillStyle = '#111113';
    _ctx.fillRect(ox, oy, gw * ps, gh * ps);

    // Left bearing area (cols 0..originX-1) — faint shade inside the grid
    if (originX > 0) {
      _ctx.fillStyle = 'rgba(255,255,255,0.018)';
      _ctx.fillRect(ox, oy, originX * ps, gh * ps);
    }

    // Build metaRows, substituting live drag preview when a pill is being dragged
    const metaRows = { ascender, capHeight, xHeight, baseline, descender };
    if (_draggingGuide !== null) metaRows[_draggingGuide] = _guideDragRow;

    // Guide lines (only when guides are visible)
    if (_showGuides) {
      // Origin cross-lines: vertical at originX, horizontal at baseline
      const originLineX = Math.round(ox + originX * ps) + 0.5;
      const baselineY   = Math.round(oy + metaRows.baseline * ps) + 0.5;
      _ctx.globalAlpha = 0.45;
      _ctx.strokeStyle = '#f5a623';
      _ctx.lineWidth = 1;
      _ctx.setLineDash([]);
      _ctx.beginPath();
      _ctx.moveTo(0, baselineY);   _ctx.lineTo(w, baselineY);
      _ctx.moveTo(originLineX, 0); _ctx.lineTo(originLineX, h);
      _ctx.stroke();
      _ctx.globalAlpha = 1;

      for (const g of GUIDES) {
        if (g.key === 'baseline') continue; // drawn above as origin cross-line
        const row = metaRows[g.key];
        const gy  = Math.round(oy + row * ps) + 0.5;
        if (gy < oy - 1 || gy > oy + gh * ps + 1) continue;
        const isDragging = g.key === _draggingGuide;
        _ctx.strokeStyle = g.color;
        _ctx.lineWidth = 1;
        _ctx.setLineDash([3, 3]);
        _ctx.globalAlpha = isDragging ? 1.0 : 0.7;
        _ctx.beginPath();
        _ctx.moveTo(ox, gy);
        _ctx.lineTo(ox + gw * ps, gy);
        _ctx.stroke();
        _ctx.setLineDash([]);
        _ctx.globalAlpha = 1;
      }
    }

    // Update pill positions (or hide them)
    _updatePills(metaRows);

    // Reference font overlay — drawn before pixels so user's marks sit on top
    if (typeof PFM.refFont !== 'undefined') {
      PFM.refFont.draw(_ctx, { ox, oy, ps, state });
    }

    // Pixels
    if (pixels) {
      _ctx.fillStyle = '#f0f0f0';
      for (let r = 0; r < gh; r++) {
        for (let c = 0; c < gw; c++) {
          if (pixels[r * gw + c]) {
            _ctx.fillRect(ox + c * ps + 1, oy + r * ps + 1, ps - 1, ps - 1);
          }
        }
      }
    }

    // Grid lines
    if (_showGrid && ps >= 4) {
      _ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      _ctx.lineWidth = 1;
      _ctx.beginPath();
      for (let c = 0; c <= gw; c++) {
        const x = ox + c * ps;
        _ctx.moveTo(x + 0.5, oy); _ctx.lineTo(x + 0.5, oy + gh * ps);
      }
      for (let r = 0; r <= gh; r++) {
        const y = oy + r * ps;
        _ctx.moveTo(ox, y + 0.5); _ctx.lineTo(ox + gw * ps, y + 0.5);
      }
      _ctx.stroke();
    }

    // Grid border
    _ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    _ctx.lineWidth = 1;
    _ctx.strokeRect(ox + 0.5, oy + 0.5, gw * ps, gh * ps);

    // Advance indicator — drawn at the right edge of the last allowed pixel
    // column (same as native app: advX = (computedAw - 1) * ps from grid left).
    const glyph = state.glyphs[state.activeCodePoint];
    const computedAw = glyph ? PFM.computeGlyphAdvance(glyph, state.meta) : state.meta.advanceWidth;
    if (computedAw > 0) {
      const ax = ox + (computedAw - 1) * ps;
      _ctx.strokeStyle = 'rgba(100,200,100,0.6)';
      _ctx.lineWidth = 1.5;
      _ctx.setLineDash([]);
      _ctx.beginPath();
      _ctx.moveTo(ax + 0.5, oy);
      _ctx.lineTo(ax + 0.5, oy + gh * ps);
      _ctx.stroke();
    }
  }

  function resetZoom() {
    _centerGrid();
    render();
  }

  function zoomIn() {
    const cx = _canvas.width / 2, cy = _canvas.height / 2;
    const old = _pixelSize;
    _pixelSize = Math.min(64, _pixelSize + Math.max(1, Math.floor(_pixelSize / 4)));
    _offsetX = cx - (_pixelSize / old) * (cx - _offsetX);
    _offsetY = cy - (_pixelSize / old) * (cy - _offsetY);
    render();
  }

  function zoomOut() {
    const cx = _canvas.width / 2, cy = _canvas.height / 2;
    const old = _pixelSize;
    _pixelSize = Math.max(2, _pixelSize - Math.max(1, Math.floor(_pixelSize / 4)));
    _offsetX = cx - (_pixelSize / old) * (cx - _offsetX);
    _offsetY = cy - (_pixelSize / old) * (cy - _offsetY);
    render();
  }

  return { init, setTool, getTool, toggleGrid, toggleGuides, render, resetZoom, zoomIn, zoomOut };
})();
