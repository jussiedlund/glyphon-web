/* global PFM, opentype */

/**
 * Trace the boundary of the union of "on" pixels.
 * Returns an array of closed loops; each loop is an array of [col, row]
 * lattice points (pixel corners, row grows downward).
 *
 * In font space (y up) outer contours run counter-clockwise and holes run
 * clockwise, i.e. the filled area is always on the LEFT of each edge.
 * Where two pixels touch only diagonally, the loop turns left (hugging the
 * pixel it came from), so they become separate contours meeting at a corner
 * rather than a self-intersecting figure-8. Collinear points are removed.
 */
PFM.traceOutlines = function(pixels, w, h) {
  const on = (r, c) => r >= 0 && r < h && c >= 0 && c < w && !!pixels[r * w + c];
  const key = (c, r) => r * (w + 1) + c;
  const edges = [];          // { c0, r0, c1, r1, used }
  const outgoing = new Map(); // vertex key -> [edge, ...]

  function addEdge(c0, r0, c1, r1) {
    const e = { c0, r0, c1, r1, used: false };
    edges.push(e);
    const k = key(c0, r0);
    if (!outgoing.has(k)) outgoing.set(k, []);
    outgoing.get(k).push(e);
  }

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!on(r, c)) continue;
      // Counter-clockwise around the pixel in y-up space
      if (!on(r + 1, c)) addEdge(c,     r + 1, c + 1, r + 1); // bottom, going right
      if (!on(r, c + 1)) addEdge(c + 1, r + 1, c + 1, r);     // right, going up
      if (!on(r - 1, c)) addEdge(c + 1, r,     c,     r);     // top, going left
      if (!on(r, c - 1)) addEdge(c,     r,     c,     r + 1); // left, going down
    }
  }

  // Cross product of two edge directions in y-up space (row axis is flipped)
  const turn = (a, b) => {
    const ax = a.c1 - a.c0, ay = -(a.r1 - a.r0);
    const bx = b.c1 - b.c0, by = -(b.r1 - b.r0);
    return ax * by - ay * bx; // > 0 = left turn
  };

  const loops = [];
  for (const start of edges) {
    if (start.used) continue;
    const pts = [];
    let e = start;
    while (e && !e.used) {
      e.used = true;
      pts.push([e.c0, e.r0]);
      // Leftmost outgoing edge (used or not) keeps in/out pairing consistent,
      // so the loop closes exactly when it reaches its own start edge.
      let best = null;
      for (const n of outgoing.get(key(e.c1, e.r1))) {
        if (!best || turn(e, n) > turn(e, best)) best = n;
      }
      e = best;
    }

    // Split at repeated vertices so every loop is simple (no self-touching)
    const pieces = [];
    const stack = [];
    const seen = new Map(); // vertex key -> index in stack
    for (const pt of pts) {
      const k = key(pt[0], pt[1]);
      if (seen.has(k)) {
        const from = seen.get(k);
        const piece = stack.splice(from);
        for (const q of piece) seen.delete(key(q[0], q[1]));
        pieces.push(piece);
      }
      seen.set(k, stack.length);
      stack.push(pt);
    }
    pieces.push(stack);

    // Drop collinear intermediate points (cyclic) per piece
    for (const loop of pieces) {
      const n = loop.length;
      const out = [];
      for (let i = 0; i < n; i++) {
        const p0 = loop[(i + n - 1) % n], p1 = loop[i], p2 = loop[(i + 1) % n];
        const cross = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]);
        if (cross !== 0) out.push(p1);
      }
      if (out.length >= 3) loops.push(out);
    }
  }
  return loops;
};

// Exports an OpenType/CFF font (.otf); name kept as exportTTF for compatibility.
PFM.exportTTF = function() {
  const state = PFM.state.getState();
  const { meta, glyphs } = state;
  const { unitsPerEm: upm, glyphHeight: gh, glyphWidth: gw } = meta;
  const originX = meta.originX ?? 0;
  const scale = upm / gh;

  const toX = col => Math.round((col - originX) * scale);
  const toY = row => Math.round((meta.baseline - row) * scale);

  function buildPath(glyph) {
    const path = new opentype.Path();
    const advance = Math.round((PFM.computeGlyphAdvance(glyph, meta) - originX) * scale);

    for (const loop of PFM.traceOutlines(glyph.pixels, gw, gh)) {
      loop.forEach(([col, row], i) => {
        if (i === 0) path.moveTo(toX(col), toY(row));
        else path.lineTo(toX(col), toY(row));
      });
      path.close();
    }

    return { path, advance };
  }

  // Space glyph — empty path, spaceWidth advance
  const spaceGlyph = new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: Math.round((meta.spaceWidth ?? (meta.advanceWidth - originX)) * scale),
    path: new opentype.Path(),
  });

  // .notdef glyph (hollow box)
  const notdefPath = new opentype.Path();
  const effectiveAw = Math.round((meta.advanceWidth - originX) * scale);
  const nw = Math.round(effectiveAw * 0.8);
  const nh = Math.round(upm * 0.7);
  const nx = Math.round(effectiveAw * 0.1);
  const ny = Math.round(-(meta.descender - meta.baseline) * scale);
  const thick = Math.round(scale * 0.5);
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

  const ascenderVal  = Math.round((meta.baseline - meta.ascender)  * scale);
  const descenderVal = Math.round(-(meta.descender - meta.baseline) * scale);

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

  const filename = (meta.name || 'font').replace(/[^a-zA-Z0-9_-]/g, '-') + '.otf';
  font.download(filename);
};
