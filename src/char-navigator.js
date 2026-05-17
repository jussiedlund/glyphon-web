/* global PFM */

PFM.charNavigator = (() => {
  let _container;      // #char-nav-scroll
  let _footerCp;       // #nav-footer-cp
  let _footerCh;       // #nav-footer-ch
  let _footerAdv;      // #nav-footer-adv
  const THUMB_SIZE = 44;

  function init(containerEl) {
    // containerEl is #char-nav (outer); we render glyphs into #char-nav-scroll
    _container = document.getElementById('char-nav-scroll');
    _footerCp  = document.getElementById('nav-footer-cp');
    _footerCh  = document.getElementById('nav-footer-ch');
    _footerAdv = document.getElementById('nav-footer-adv');
    PFM.state.subscribe(_onStateChange);
    _render();
  }

  function _onStateChange(state, action) {
    if (action.type === 'SET_ACTIVE_GLYPH') {
      _container.querySelectorAll('.glyph-thumb').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.cp) === state.activeCodePoint);
      });
      _updateFooter(state);
      _scrollToActive();
      return;
    }
    if (action.type === 'PAINT_PIXELS' || action.type === 'SET_GLYPH_ADVANCE') {
      _updateFooter(state);
      // Also redraw the affected thumbnail
      const cp = action.codePoint;
      if (cp !== undefined) {
        const cell = _container.querySelector(`.glyph-thumb[data-cp="${cp}"]`);
        if (cell) {
          const canvas = cell.querySelector('canvas');
          if (canvas) _drawThumb(canvas, state.glyphs[cp], state.meta);
        }
      }
      return;
    }
    _render();
  }

  function _render() {
    const state = PFM.state.getState();
    const { glyphs, activeCodePoint, meta } = state;
    const codePoints = Object.keys(glyphs).map(Number).sort((a, b) => a - b);

    _container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'nav-header';
    header.innerHTML = `
      <span class="nav-title">Glyphs <span class="nav-count">${codePoints.length}</span></span>
      <button class="icon-btn" id="add-range-btn" title="Add Unicode range">+</button>
    `;
    _container.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'glyph-grid';

    for (const cp of codePoints) {
      const glyph = glyphs[cp];
      const cell = document.createElement('div');
      cell.className = 'glyph-thumb' + (cp === activeCodePoint ? ' active' : '');
      cell.dataset.cp = cp;
      cell.title = `U+${cp.toString(16).toUpperCase().padStart(4,'0')} ${glyph.label}`;

      const canvas = document.createElement('canvas');
      canvas.width  = THUMB_SIZE;
      canvas.height = THUMB_SIZE;
      _drawThumb(canvas, glyph, meta);
      cell.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'glyph-label';
      label.textContent = cp >= 32 && cp < 127 ? glyph.label : `${cp.toString(16).toUpperCase()}`;
      cell.appendChild(label);

      cell.addEventListener('click', () => {
        PFM.state.dispatch({ type: 'SET_ACTIVE_GLYPH', codePoint: cp });
      });

      grid.appendChild(cell);
    }

    _container.appendChild(grid);

    document.getElementById('add-range-btn').addEventListener('click', _showAddRangeDialog);

    _updateFooter(state);
  }

  function _updateFooter(state) {
    if (!_footerCp) return;
    const cp = state.activeCodePoint;
    const glyph = state.glyphs[cp];
    if (!glyph) return;
    const aw = PFM.computeGlyphAdvance(glyph, state.meta);
    _footerCp.textContent  = `U+${cp.toString(16).toUpperCase().padStart(4,'0')}`;
    _footerCh.textContent  = cp >= 32 ? glyph.label : '';
    _footerAdv.textContent = `adv ${aw}`;
  }

  function _drawThumb(canvas, glyph, meta) {
    const ctx = canvas.getContext('2d');
    const { glyphWidth: gw, glyphHeight: gh } = meta;
    const { pixels } = glyph;

    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

    const ps = Math.min(THUMB_SIZE / gw, THUMB_SIZE / gh);
    const ox = (THUMB_SIZE - gw * ps) / 2;
    const oy = (THUMB_SIZE - gh * ps) / 2;

    ctx.fillStyle = '#f0f0f0';
    for (let r = 0; r < gh; r++) {
      for (let c = 0; c < gw; c++) {
        if (pixels[r * gw + c]) {
          ctx.fillRect(Math.floor(ox + c * ps), Math.floor(oy + r * ps), Math.max(1, Math.floor(ps)), Math.max(1, Math.floor(ps)));
        }
      }
    }
  }

  function navigateDelta(delta) {
    const state = PFM.state.getState();
    const codePoints = Object.keys(state.glyphs).map(Number).sort((a, b) => a - b);
    const idx = codePoints.indexOf(state.activeCodePoint);
    const next = codePoints[Math.max(0, Math.min(codePoints.length - 1, idx + delta))];
    if (next !== undefined && next !== state.activeCodePoint) {
      PFM.state.dispatch({ type: 'SET_ACTIVE_GLYPH', codePoint: next });
    }
  }

  function _scrollToActive() {
    const active = _container.querySelector('.glyph-thumb.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function _showAddRangeDialog() {
    const existing = document.getElementById('add-range-modal');
    if (existing) { existing.remove(); return; }

    const modal = document.createElement('div');
    modal.id = 'add-range-modal';
    modal.className = 'mini-modal';
    modal.innerHTML = `
      <div class="mini-modal-title">Add Unicode Range</div>
      <div class="range-presets">
        ${PFM.UNICODE_RANGES.map(r =>
          `<button class="preset-btn" data-start="${r.start}" data-end="${r.end}">${r.name}</button>`
        ).join('')}
      </div>
      <div class="range-custom">
        <label>Custom: U+<input id="range-start" type="text" value="0020" maxlength="6" size="6"> – U+<input id="range-end" type="text" value="007E" maxlength="6" size="6"></label>
        <button id="range-add-btn">Add</button>
      </div>
      <button class="mini-modal-close icon-btn">✕</button>
    `;

    modal.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const start = parseInt(btn.dataset.start, 16);
        const end   = parseInt(btn.dataset.end,   16);
        _addRange(start, end);
        modal.remove();
      });
    });

    modal.querySelector('#range-add-btn').addEventListener('click', () => {
      const start = parseInt(modal.querySelector('#range-start').value, 16);
      const end   = parseInt(modal.querySelector('#range-end').value,   16);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        _addRange(start, end);
        modal.remove();
      }
    });

    modal.querySelector('.mini-modal-close').addEventListener('click', () => modal.remove());

    // Append to char-nav (outer) so it positions relative to the scroll area header
    document.getElementById('char-nav').appendChild(modal);
  }

  function _addRange(start, end) {
    const MAX_AT_ONCE = 512;
    if (end - start > MAX_AT_ONCE) {
      if (!confirm(`Add ${end - start + 1} glyphs? This may be slow.`)) return;
    }
    PFM.state.dispatch({ type: 'ADD_GLYPH_RANGE', start, end });
  }

  return { init, navigateDelta };
})();
