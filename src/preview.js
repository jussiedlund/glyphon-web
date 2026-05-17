/* global PFM */

PFM.preview = (() => {
  let _canvas, _ctx, _input;
  let _scale = 2;

  function init(canvasEl, inputEl) {
    _canvas = canvasEl;
    _ctx = _canvas.getContext('2d');
    _input = inputEl;

    _input.addEventListener('input', render);

    const scaleSelect = document.getElementById('preview-scale');
    if (scaleSelect) {
      scaleSelect.addEventListener('change', () => {
        _scale = parseInt(scaleSelect.value);
        render();
      });
    }

    PFM.state.subscribe(() => render());
    render();
  }

  function render() {
    if (!_ctx) return;
    const state = PFM.state.getState();
    const { meta, glyphs } = state;
    const { glyphWidth: gw, glyphHeight: gh, advanceWidth: aw, spaceWidth: sw } = meta;
    const originX = meta.originX ?? 0;
    const text = _input ? _input.value || 'AaBbCc' : 'AaBbCc';
    const ps = _scale;

    // Effective advance per glyph (from origin), proportional
    function glyphAdvance(g) {
      return (PFM.computeGlyphAdvance(g, meta) - originX) * ps;
    }

    // Measure total width
    let totalWidth = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === 32) { totalWidth += (sw ?? (aw - originX)) * ps; continue; }
      const g = glyphs[cp];
      totalWidth += g ? glyphAdvance(g) : (aw - originX) * ps;
    }
    totalWidth = Math.max(totalWidth, 1);

    _canvas.width  = Math.min(totalWidth + ps * 2, 2000);
    _canvas.height = gh * ps + ps * 2;

    _ctx.fillStyle = '#0d0d1a';
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Baseline guide
    _ctx.strokeStyle = 'rgba(255,80,80,0.3)';
    _ctx.lineWidth = 1;
    _ctx.beginPath();
    const by = ps + meta.baseline * ps + 0.5;
    _ctx.moveTo(0, by);
    _ctx.lineTo(_canvas.width, by);
    _ctx.stroke();

    _ctx.fillStyle = '#e8e8f0';
    let x = ps;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      // Space character uses dedicated spaceWidth (already from origin)
      if (cp === 32) { x += (sw ?? (aw - originX)) * ps; continue; }

      const g = glyphs[cp];
      if (!g) {
        // Missing glyph: draw hollow box
        const boxW = (aw - originX - 1) * ps;
        _ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        _ctx.lineWidth = 1;
        _ctx.strokeRect(x + 0.5, ps + 0.5, boxW, (gh - 1) * ps);
        x += (aw - originX) * ps;
        continue;
      }
      for (let r = 0; r < gh; r++) {
        for (let c = 0; c < gw; c++) {
          if (g.pixels[r * gw + c]) {
            _ctx.fillRect(x + (c - originX) * ps, ps + r * ps, ps, ps);
          }
        }
      }
      x += glyphAdvance(g);  // proportional advance
    }
  }

  return { init, render };
})();
