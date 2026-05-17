/* global PFM, opentype */

PFM.exportTTF = function() {
  const state = PFM.state.getState();
  const { meta, glyphs } = state;
  const { unitsPerEm: upm, glyphHeight: gh, glyphWidth: gw } = meta;
  const originX = meta.originX ?? 0;
  const scale = upm / gh;

  function gridToOT(row, col) {
    return {
      x: (col - originX) * scale,
      y: (meta.baseline - row) * scale,
    };
  }

  function buildPath(glyph) {
    const path = new opentype.Path();
    const { pixels } = glyph;
    const advance = (PFM.computeGlyphAdvance(glyph, meta) - originX) * scale;

    for (let r = 0; r < gh; r++) {
      for (let c = 0; c < gw; c++) {
        if (!pixels[r * gw + c]) continue;
        // Each pixel → CCW square contour (filled in OTF winding)
        const { x, y } = gridToOT(r, c);
        path.moveTo(x,          y);
        path.lineTo(x + scale,  y);
        path.lineTo(x + scale,  y + scale);
        path.lineTo(x,          y + scale);
        path.close();
      }
    }

    return { path, advance };
  }

  // Space glyph — empty path, spaceWidth advance
  const spaceGlyph = new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: (meta.spaceWidth ?? (meta.advanceWidth - originX)) * scale,
    path: new opentype.Path(),
  });

  // .notdef glyph (hollow box)
  const notdefPath = new opentype.Path();
  const effectiveAw = (meta.advanceWidth - originX) * scale;
  const nw = effectiveAw * 0.8;
  const nh = upm * 0.7;
  const nx = effectiveAw * 0.1;
  const ny = -(meta.descender - meta.baseline) * scale;
  const thick = scale * 0.5;
  // Outer rect
  notdefPath.moveTo(nx, ny);
  notdefPath.lineTo(nx + nw, ny);
  notdefPath.lineTo(nx + nw, ny + nh);
  notdefPath.lineTo(nx, ny + nh);
  notdefPath.close();
  // Inner rect (hole)
  notdefPath.moveTo(nx + thick, ny + thick);
  notdefPath.lineTo(nx + thick, ny + nh - thick);
  notdefPath.lineTo(nx + nw - thick, ny + nh - thick);
  notdefPath.lineTo(nx + nw - thick, ny + thick);
  notdefPath.close();

  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: effectiveAw,
    path: notdefPath,
  });

  const glyphList = [notdefGlyph, spaceGlyph];
  const codePoints = Object.keys(glyphs).map(Number).sort((a, b) => a - b);

  for (const cp of codePoints) {
    if (cp === 32) continue; // space already added above
    const g = glyphs[cp];
    const { path, advance } = buildPath(g);
    const name = cp >= 32 && cp < 127
      ? opentype.glyph_names && opentype.glyph_names[cp]
        ? opentype.glyph_names[cp]
        : `uni${cp.toString(16).toUpperCase().padStart(4,'0')}`
      : `uni${cp.toString(16).toUpperCase().padStart(4,'0')}`;

    glyphList.push(new opentype.Glyph({
      name,
      unicode: cp,
      advanceWidth: advance,
      path,
    }));
  }

  const ascenderVal  = (meta.baseline - meta.ascender)  * scale;
  const descenderVal = -(meta.descender - meta.baseline) * scale;

  const font = new opentype.Font({
    familyName:  meta.name    || 'Untitled',
    styleName:   'Regular',
    unitsPerEm:  upm,
    ascender:    ascenderVal,
    descender:   descenderVal,
    designer:    meta.author  || '',
    version:     meta.version || '1.0',
    glyphs:      glyphList,
  });

  const filename = (meta.name || 'font').replace(/[^a-zA-Z0-9_-]/g, '-') + '.ttf';
  font.download(filename);
};
