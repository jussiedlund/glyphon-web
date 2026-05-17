/* global PFM */

PFM.metricsPanel = (() => {
  let _container;
  let _debounceTimer;

  const META_FIELDS = [
    { key: 'name',        label: 'Font Name',   type: 'text' },
    { key: 'author',      label: 'Author',       type: 'text' },
    { key: 'version',     label: 'Version',      type: 'text' },
    { key: 'description', label: 'Description',  type: 'text' },
  ];

  // Row-index guide fields (shown under "Metrics" section with drag hint)
  const GUIDE_FIELDS = [
    { key: 'ascender',  label: 'Ascender',   type: 'number', min: 0, max: 255 },
    { key: 'capHeight', label: 'Cap height',  type: 'number', min: 0, max: 255 },
    { key: 'xHeight',   label: 'x-height',   type: 'number', min: 0, max: 255 },
    { key: 'baseline',  label: 'Baseline',   type: 'number', min: 0, max: 255 },
    { key: 'descender', label: 'Descender',  type: 'number', min: 0, max: 255 },
  ];

  // Spacing/advance fields
  const SPACING_FIELDS = [
    { key: 'advanceWidth', label: 'Advance',    type: 'number', min: 1, max: 128 },
    { key: 'spaceWidth',   label: 'Space',      type: 'number', min: 1, max: 128 },
    { key: 'unitsPerEm',   label: 'Units/em',   type: 'number', min: 256, max: 4096 },
  ];

  function init(containerEl) {
    _container = containerEl;
    _render();
    PFM.state.subscribe((state, action) => {
      if (action.type === 'LOAD_PROJECT' || action.type === 'SET_META') {
        _syncValues();
      }
      if (action.type === 'PAINT_PIXELS' || action.type === 'SET_ACTIVE_GLYPH' || action.type === 'SET_GLYPH_ADVANCE') {
        _updateGlyphInfo();
      }
    });
  }

  function _render() {
    const state = PFM.state.getState();
    const { meta } = state;

    _container.innerHTML = `
      <div class="panel-section">
        <div class="panel-title">Font Info</div>
        ${META_FIELDS.map(f => `
          <div class="field-row">
            <label class="field-label">${f.label}</label>
            <input class="field-input" type="${f.type}" data-key="${f.key}" value="${_esc(meta[f.key] || '')}">
          </div>
        `).join('')}
      </div>

      <div class="panel-section">
        <div class="panel-title">Canvas</div>
        <div class="grid-size-row">
          <div class="field-row">
            <label class="field-label">Width</label>
            <input class="field-input" type="number" id="grid-width" min="1" max="128" value="${meta.glyphWidth}">
          </div>
          <div class="field-row">
            <label class="field-label">Height</label>
            <input class="field-input" type="number" id="grid-height" min="1" max="128" value="${meta.glyphHeight}">
          </div>
          <div class="field-row">
            <label class="field-label">Origin col</label>
            <input class="field-input" type="number" data-key="originX" min="0" max="32" value="${meta.originX ?? 0}">
          </div>
          <button class="btn-secondary" id="resize-btn" style="align-self:flex-start;margin-top:2px">Resize</button>
        </div>
        <div class="hint-text" id="canvas-size-hint">Current: ${meta.glyphWidth} × ${meta.glyphHeight}</div>
      </div>

      <div class="panel-section">
        <div class="panel-title">Metrics</div>
        <div class="hint-text" style="margin-bottom:6px">Drag guide lines on canvas</div>
        ${GUIDE_FIELDS.map(f => `
          <div class="field-row">
            <label class="field-label">${f.label}</label>
            <input class="field-input" type="number" data-key="${f.key}" min="${f.min}" max="${f.max}" value="${meta[f.key] ?? 0}">
          </div>
        `).join('')}
      </div>

      <div class="panel-section">
        <div class="panel-title">Spacing</div>
        ${SPACING_FIELDS.map(f => `
          <div class="field-row">
            <label class="field-label">${f.label}</label>
            <input class="field-input" type="number" data-key="${f.key}" min="${f.min}" max="${f.max}" value="${meta[f.key] ?? 0}">
          </div>
        `).join('')}
      </div>

      <div class="panel-section">
        <div class="panel-title">Glyph</div>
        <div id="glyph-info-content"></div>
      </div>
    `;

    _container.querySelectorAll('input[data-key]').forEach(input => {
      input.addEventListener('input', () => {
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => _onFieldChange(input), 150);
      });
    });

    document.getElementById('resize-btn').addEventListener('click', _onResize);
    _updateGlyphInfo();
  }

  function _onFieldChange(input) {
    const key = input.dataset.key;
    const value = input.type === 'number' ? parseInt(input.value) : input.value;
    if (input.type === 'number' && isNaN(value)) return;
    PFM.state.dispatch({ type: 'SET_META', meta: { [key]: value } });
    if (key === 'name') {
      document.title = `${value || 'Untitled'} – Glyphon`;
    }
  }

  function _onResize() {
    const nw = parseInt(document.getElementById('grid-width').value);
    const nh = parseInt(document.getElementById('grid-height').value);
    const state = PFM.state.getState();
    if (isNaN(nw) || isNaN(nh) || nw < 1 || nh < 1) return;
    if (nw === state.meta.glyphWidth && nh === state.meta.glyphHeight) return;
    if (!confirm(`Resize grid to ${nw}×${nh}? Pixels outside the new bounds will be cropped.`)) return;
    PFM.state.dispatch({ type: 'RESIZE_GRID', newWidth: nw, newHeight: nh });
    _syncValues();
  }

  function _syncValues() {
    const { meta } = PFM.state.getState();
    _container.querySelectorAll('input[data-key]').forEach(input => {
      input.value = meta[input.dataset.key] ?? '';
    });
    const hint = document.getElementById('canvas-size-hint');
    if (hint) hint.textContent = `Current: ${meta.glyphWidth} × ${meta.glyphHeight}`;
    // Also sync grid-width / grid-height (no data-key)
    const gw = document.getElementById('grid-width');
    const gh = document.getElementById('grid-height');
    if (gw) gw.value = meta.glyphWidth;
    if (gh) gh.value = meta.glyphHeight;
  }

  function _updateGlyphInfo() {
    const el = document.getElementById('glyph-info-content');
    if (!el) return;
    const state = PFM.state.getState();
    const cp = state.activeCodePoint;
    const glyph = state.glyphs[cp];
    if (!glyph) { el.innerHTML = ''; return; }
    const pixelCount = Array.from(glyph.pixels).filter(Boolean).length;
    const computedAw = PFM.computeGlyphAdvance(glyph, state.meta);
    const overrideAw = glyph.advanceWidth;
    el.innerHTML = `
      <div class="glyph-info-row"><span>Code point</span><span>U+${cp.toString(16).toUpperCase().padStart(4,'0')}</span></div>
      <div class="glyph-info-row"><span>Character</span><span class="glyph-info-char">${cp >= 32 ? glyph.label : '(ctrl)'}</span></div>
      <div class="glyph-info-row"><span>Pixels set</span><span>${pixelCount}</span></div>
      <div class="glyph-info-row"><span>Computed adv</span><span>${computedAw}</span></div>
      <div class="field-row" style="margin-top:6px">
        <label class="field-label" style="font-size:11px">Override adv</label>
        <input class="field-input" type="number" id="glyph-advance-input"
          min="1" max="128" placeholder="auto"
          value="${overrideAw != null ? overrideAw : ''}"
          title="Leave blank to use computed advance">
        ${overrideAw != null ? `<button class="btn-danger" id="glyph-advance-clear" style="padding:2px 5px;font-size:11px" title="Revert to auto">✕</button>` : ''}
      </div>
    `;

    document.getElementById('glyph-advance-input')?.addEventListener('input', e => {
      const v = e.target.value.trim();
      const n = v === '' ? null : parseInt(v);
      if (n !== null && (isNaN(n) || n < 1)) return;
      PFM.state.dispatch({ type: 'SET_GLYPH_ADVANCE', codePoint: cp, value: n });
    });
    document.getElementById('glyph-advance-clear')?.addEventListener('click', () => {
      PFM.state.dispatch({ type: 'SET_GLYPH_ADVANCE', codePoint: cp, value: null });
    });
  }

  function _esc(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  }

  return { init };
})();
