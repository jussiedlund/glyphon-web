/* global PFM */

PFM.library = (() => {
  let _page = null;

  // ── Public ─────────────────────────────────────────────────────────────────

  function show() {
    document.getElementById('app').style.display = 'none';
    if (!_page) _build();
    _page.style.display = 'flex';
    _renderMyFonts();
  }

  function hide() {
    if (_page) _page.style.display = 'none';
    document.getElementById('app').style.display = 'flex';
  }

  // ── Build page skeleton (once) ─────────────────────────────────────────────

  function _build() {
    _page = document.createElement('div');
    _page.id = 'library-page';
    _page.innerHTML = `
      <div id="lib-topbar">
        <button class="icon-btn" id="lib-back-btn" title="Back to editor">
          <i data-lucide="arrow-left"></i>
        </button>
        <span class="lib-title">Library</span>
        <button class="btn-primary" id="lib-new-btn">
          <i data-lucide="plus"></i> New Font
        </button>
      </div>
      <div id="lib-body">
        <section class="lib-section">
          <div class="lib-section-header">
            <h2 class="lib-section-title">My Fonts</h2>
            <button class="btn-secondary" id="lib-save-btn">Save current font</button>
          </div>
          <div id="lib-my-grid" class="lib-grid"></div>
        </section>
        <section class="lib-section">
          <div class="lib-section-header">
            <h2 class="lib-section-title">Open Source</h2>
            <span class="lib-section-sub">Load any font as a starting point — all are free to use and modify.</span>
          </div>
          <div id="lib-os-grid" class="lib-grid"></div>
        </section>
      </div>
    `;

    _page.querySelector('#lib-back-btn').addEventListener('click', hide);
    _page.querySelector('#lib-new-btn').addEventListener('click', _newFont);
    _page.querySelector('#lib-save-btn').addEventListener('click', _saveCurrentFont);

    document.body.appendChild(_page);

    if (typeof lucide !== 'undefined') lucide.createIcons({ node: _page });

    _renderOpenSource();
  }

  // ── My Fonts ───────────────────────────────────────────────────────────────

  function _renderMyFonts() {
    const grid = document.getElementById('lib-my-grid');
    if (!grid) return;
    const fonts = PFM.storage.listFonts();

    if (!fonts.length) {
      grid.innerHTML = '<div class="lib-empty">No saved fonts yet. Click <strong>Save current font</strong> to add one.</div>';
      return;
    }

    grid.innerHTML = '';
    fonts.forEach(entry => {
      const project = PFM.storage.loadFont(entry.id);
      const card = _makeCard({
        name: entry.name,
        sub: `${entry.glyphCount} glyphs · ${_fmtDate(entry.lastModified)}`,
        project,
        actions: [
          { label: 'Open', primary: true, handler: () => _loadUserFont(entry.id) },
          { label: '✕', danger: true, handler: () => _deleteUserFont(entry.id) },
        ],
      });
      grid.appendChild(card);
    });
  }

  function _saveCurrentFont() {
    const state = PFM.state.getState();
    PFM.storage.saveFont(state);
    _renderMyFonts();
    _showToast(`"${state.meta.name || 'Untitled'}" saved`);
  }

  function _loadUserFont(id) {
    const project = PFM.storage.loadFont(id);
    if (!project) return;
    PFM.state.dispatch({ type: 'LOAD_PROJECT', project });
    hide();
  }

  function _deleteUserFont(id) {
    const fonts = PFM.storage.listFonts();
    const font = fonts.find(f => f.id === id);
    if (!font) return;
    if (confirm(`Delete "${font.name}"? This cannot be undone.`)) {
      PFM.storage.deleteFont(id);
      _renderMyFonts();
    }
  }

  function _newFont() {
    if (confirm('Start a new font? Unsaved changes will be lost.')) {
      PFM.state.dispatch({ type: 'LOAD_PROJECT', project: PFM.createFontProject() });
      hide();
    }
  }

  // ── Open Source ────────────────────────────────────────────────────────────

  function _renderOpenSource() {
    const grid = document.getElementById('lib-os-grid');
    if (!grid) return;
    grid.innerHTML = '';

    PFM.bundledFonts.forEach(def => {
      const project = _bundledToProject(def);
      const card = _makeCard({
        name: def.name,
        sub: `${def.meta.glyphWidth}×${def.meta.glyphHeight} · ${def.credit}`,
        badge: def.license,
        project,
        actions: [
          { label: 'Open', primary: true, handler: () => {
            if (confirm(`Load "${def.name}" as a starting point? Unsaved changes will be lost.`)) {
              PFM.state.dispatch({ type: 'LOAD_PROJECT', project });
              hide();
            }
          }},
        ],
      });
      grid.appendChild(card);
    });
  }

  function _bundledToProject(def) {
    const { glyphWidth: w, glyphHeight: h } = def.meta;
    const glyphs = {};
    for (const [cpStr, glyph] of Object.entries(def.glyphs)) {
      const cp = parseInt(cpStr);
      const pixels = new Uint8Array(w * h);
      if (Array.isArray(glyph)) {
        // Row-bytes format: [0xF8, 0x20, ...]
        for (let r = 0; r < glyph.length && r < h; r++) {
          const byte = glyph[r];
          for (let c = 0; c < w; c++) {
            pixels[r * w + c] = (byte >> (w - 1 - c)) & 1;
          }
        }
      } else {
        // Flat pixels format from BDF converter: { codePoint, pixels: [0,1,...], advanceWidth }
        const src = glyph.pixels;
        for (let i = 0; i < src.length && i < w * h; i++) pixels[i] = src[i];
      }
      glyphs[cp] = { codePoint: cp, pixels, advanceWidth: null };
    }
    return { meta: { ...def.meta }, glyphs, activeCodePoint: 65, _libraryId: null };
  }

  // ── Card ───────────────────────────────────────────────────────────────────

  function _makeCard({ name, sub, badge, project, actions }) {
    const card = document.createElement('div');
    card.className = 'lib-card';

    const canvas = document.createElement('canvas');
    canvas.className = 'lib-thumb';
    canvas.width = 160;
    canvas.height = 56;
    card.appendChild(canvas);

    if (project) _drawThumbnail(canvas, project);

    const info = document.createElement('div');
    info.className = 'lib-card-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'lib-card-name-row';
    const nameEl = document.createElement('span');
    nameEl.className = 'lib-card-name';
    nameEl.textContent = name;
    nameRow.appendChild(nameEl);
    if (badge) {
      const b = document.createElement('span');
      b.className = 'lib-badge';
      b.textContent = badge;
      nameRow.appendChild(b);
    }

    const subEl = document.createElement('span');
    subEl.className = 'lib-card-sub';
    subEl.textContent = sub;

    const actRow = document.createElement('div');
    actRow.className = 'lib-card-actions';

    actions.forEach(({ label, primary, danger, handler }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = primary ? 'btn-primary' : danger ? 'btn-danger' : 'btn-secondary';
      btn.addEventListener('click', handler);
      actRow.appendChild(btn);
    });

    info.appendChild(nameRow);
    info.appendChild(subEl);
    info.appendChild(actRow);
    card.appendChild(info);
    return card;
  }

  // ── Thumbnail ──────────────────────────────────────────────────────────────

  function _drawThumbnail(canvas, project) {
    const ctx = canvas.getContext('2d');
    const { meta, glyphs } = project;
    const { glyphWidth: gw, glyphHeight: gh } = meta;

    const PREVIEW = [65, 66, 67, 97, 98, 99, 49, 50, 51]; // ABCabc123
    const chars = PREVIEW.filter(cp => glyphs[cp]);
    if (!chars.length) return;

    const scale = Math.min(
      Math.floor((canvas.height - 4) / gh),
      Math.floor((canvas.width - 4) / (gw * chars.length)),
    );
    if (scale < 1) return;

    const totalW = gw * chars.length * scale;
    const totalH = gh * scale;
    const ox = Math.floor((canvas.width  - totalW) / 2);
    const oy = Math.floor((canvas.height - totalH) / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4f7bff';

    chars.forEach((cp, ci) => {
      const g = glyphs[cp];
      if (!g) return;
      for (let r = 0; r < gh; r++) {
        for (let c = 0; c < gw; c++) {
          if (g.pixels[r * gw + c]) {
            ctx.fillRect(ox + (ci * gw + c) * scale, oy + r * scale, scale, scale);
          }
        }
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return { show, hide };
})();

function _showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-visible'), 10);
  setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(() => t.remove(), 300); }, 2500);
}
