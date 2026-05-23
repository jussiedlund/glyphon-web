/* global PFM */

// Reference font overlay — mirrors ReferenceFontPanelView + drawReferenceFont (native).
// Transient state only; not saved to project JSON.

PFM.refFont = (() => {
  const _s = {
    enabled:     true,
    fontFamily:  'Georgia',
    capHeightPx: 7,
    opacity:     0.10,
  };

  // Off-screen canvas used only for TextMetrics measurement (never painted to screen)
  const _off    = document.createElement('canvas');
  _off.width    = 400;
  _off.height   = 200;
  const _offCtx = _off.getContext('2d');

  // Cache: fontFamily string → { capH, ascent, xH, descent } measured at size 100
  const _cache = {};

  function _measure(family) {
    if (_cache[family]) return _cache[family];
    _offCtx.font = `100px "${family}"`;
    const mH = _offCtx.measureText('H');
    const mx = _offCtx.measureText('x');
    const mg = _offCtx.measureText('g');
    const r = {
      capH:    mH.actualBoundingBoxAscent,   // cap height  (baseline → top of H)
      ascent:  mH.fontBoundingBoxAscent,     // font ascender
      xH:      mx.actualBoundingBoxAscent,   // x-height    (baseline → top of x)
      descent: mg.fontBoundingBoxDescent,    // font descender (positive, below baseline)
    };
    if (r.capH > 0) _cache[family] = r;
    return r;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  // Called from canvas-editor._drawGrid(), before pixel rendering.
  function draw(ctx, { ox, oy, ps, state }) {
    if (!_s.enabled) return;
    const cp = state.activeCodePoint;
    if (cp < 0x20 || cp === 0x7F) return;

    const m = _measure(_s.fontFamily);
    if (!m || m.capH <= 0) return;

    const fontSize   = 100 * (_s.capHeightPx * ps) / m.capH;
    const baselineY  = oy + state.meta.baseline * ps;
    const originX    = ox + (state.meta.originX ?? 0) * ps;

    ctx.save();
    ctx.globalAlpha  = _s.opacity;
    ctx.font         = `${fontSize}px "${_s.fontFamily}"`;
    ctx.fillStyle    = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String.fromCodePoint(cp), originX, baselineY);
    ctx.restore();
  }

  // ── Metrics derivation ────────────────────────────────────────────────────

  // Returns a meta patch { ascender, capHeight, xHeight, descender } or null.
  function computeMetrics() {
    const { meta } = PFM.state.getState();
    const m        = _measure(_s.fontFamily);
    if (!m || m.capH <= 0) return null;

    const scale = _s.capHeightPx / m.capH;
    const bl    = meta.baseline;
    const gh    = meta.glyphHeight;

    return {
      ascender:  Math.max(0,      Math.round(bl - m.ascent  * scale)),
      capHeight: Math.max(0,      Math.round(bl - m.capH    * scale)),
      xHeight:   Math.max(0,      Math.round(bl - m.xH      * scale)),
      descender: Math.min(gh - 1, Math.round(bl + m.descent * scale)),
    };
  }

  // ── Settings access ───────────────────────────────────────────────────────

  function getSettings() { return { ..._s }; }

  function updateSettings(patch) {
    // Bust cache when font changes so the next measurement is fresh
    if (patch.fontFamily && patch.fontFamily !== _s.fontFamily) {
      delete _cache[patch.fontFamily];
    }
    Object.assign(_s, patch);
  }

  // ── Panel UI ──────────────────────────────────────────────────────────────

  let _section = null;

  function initPanel(containerEl) {
    _section = document.createElement('div');
    _section.className = 'panel-section';
    containerEl.appendChild(_section);
    _renderPanel();

    // Keep the derived-metrics table in sync when project meta changes
    PFM.state.subscribe((_, action) => {
      if (action.type === 'SET_META' || action.type === 'LOAD_PROJECT') {
        _renderMetrics();
      }
    });
  }

  function _renderPanel() {
    if (!_section) return;
    const capPct = Math.round(_s.opacity * 100);
    _section.innerHTML = `
      <div class="ref-header">
        <div class="panel-title" style="margin-bottom:0">Reference Font</div>
        <label class="ref-toggle" title="Enable reference font overlay">
          <input type="checkbox" id="ref-enabled" ${_s.enabled ? 'checked' : ''}>
          <span class="ref-toggle-track"></span>
        </label>
      </div>
      <div id="ref-body"${_s.enabled ? '' : ' style="display:none"'}>
        <div class="field-row" style="margin-top:8px">
          <label class="field-label">Family</label>
          <input class="field-input ref-family-input" type="text" id="ref-family"
            value="${_esc(_s.fontFamily)}" placeholder="e.g. Georgia">
        </div>
        <div class="ref-slider-row">
          <label class="field-label">Cap height</label>
          <input type="range" class="ref-slider" id="ref-cap"
            min="1" max="30" value="${_s.capHeightPx}">
          <span class="ref-val" id="ref-cap-val">${_s.capHeightPx} px</span>
        </div>
        <div class="ref-slider-row">
          <label class="field-label">Opacity</label>
          <input type="range" class="ref-slider" id="ref-opacity"
            min="5" max="60" value="${capPct}">
          <span class="ref-val" id="ref-opacity-val">${capPct}%</span>
        </div>
        <div id="ref-metrics"></div>
      </div>
    `;
    _bindEvents();
    _renderMetrics();
  }

  function _bindEvents() {
    document.getElementById('ref-enabled')?.addEventListener('change', e => {
      updateSettings({ enabled: e.target.checked });
      const body = document.getElementById('ref-body');
      if (body) body.style.display = _s.enabled ? '' : 'none';
      PFM.canvasEditor.render();
      _renderMetrics();
    });

    document.getElementById('ref-family')?.addEventListener('input', e => {
      // Update state immediately for live preview; render on change/blur
      updateSettings({ fontFamily: e.target.value });
    });
    document.getElementById('ref-family')?.addEventListener('change', () => {
      PFM.canvasEditor.render();
      _renderMetrics();
    });

    document.getElementById('ref-cap')?.addEventListener('input', e => {
      const v = parseInt(e.target.value);
      updateSettings({ capHeightPx: v });
      const lbl = document.getElementById('ref-cap-val');
      if (lbl) lbl.textContent = `${v} px`;
      PFM.canvasEditor.render();
      _renderMetrics();
    });

    document.getElementById('ref-opacity')?.addEventListener('input', e => {
      const pct = parseInt(e.target.value);
      updateSettings({ opacity: pct / 100 });
      const lbl = document.getElementById('ref-opacity-val');
      if (lbl) lbl.textContent = `${pct}%`;
      PFM.canvasEditor.render();
    });
  }

  function _renderMetrics() {
    const el = document.getElementById('ref-metrics');
    if (!el) return;
    if (!_s.enabled) { el.innerHTML = ''; return; }

    const proposed = computeMetrics();
    if (!proposed) { el.innerHTML = ''; return; }

    const { meta } = PFM.state.getState();
    const rows = [
      { label: 'Ascender',   cur: meta.ascender,  prop: proposed.ascender  },
      { label: 'Cap height', cur: meta.capHeight, prop: proposed.capHeight },
      { label: 'x-height',   cur: meta.xHeight,   prop: proposed.xHeight   },
      { label: 'Descender',  cur: meta.descender, prop: proposed.descender },
    ];
    const hasChanges = rows.some(r => r.cur !== r.prop);

    el.innerHTML = `
      <div class="ref-divider"></div>
      <div class="panel-title" style="margin-bottom:6px">Derived Metrics</div>
      <div class="ref-metrics-table">
        ${rows.map(r => `
          <div class="ref-metric-row">
            <span class="ref-metric-label">${r.label}</span>
            <span class="ref-metric-num">${r.cur}</span>
            <span class="ref-metric-arrow">→</span>
            <span class="ref-metric-num${r.cur !== r.prop ? ' ref-metric-changed' : ''}">${r.prop}</span>
          </div>
        `).join('')}
      </div>
      <p class="hint-text" style="margin:5px 0 8px">
        Baseline stays at row ${meta.baseline}.
      </p>
      <button class="btn-primary ref-apply-btn" id="ref-apply"${hasChanges ? '' : ' disabled'}>
        ${hasChanges ? 'Apply Metrics' : 'Metrics already match'}
      </button>
    `;

    document.getElementById('ref-apply')?.addEventListener('click', () => {
      PFM.state.dispatch({ type: 'SET_META', meta: proposed });
      const btn = document.getElementById('ref-apply');
      if (btn) { btn.textContent = 'Applied!'; btn.disabled = true; }
      setTimeout(_renderMetrics, 1200);
    });
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  return { draw, computeMetrics, getSettings, updateSettings, initPanel };
})();
