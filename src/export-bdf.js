/* global PFM */

PFM.exportBDF = function() {
  const state = PFM.state.getState();
  const { meta, glyphs } = state;
  const { glyphWidth: gw, glyphHeight: gh, baseline, advanceWidth: aw } = meta;
  const originX = meta.originX ?? 0;

  const ascenderPx  = baseline - meta.ascender;
  const descenderPx = meta.descender - baseline;

  function rowToHex(pixels, row) {
    let bits = '';
    for (let c = 0; c < gw; c++) bits += pixels[row * gw + c] ? '1' : '0';
    while (bits.length % 8 !== 0) bits += '0';
    let hex = '';
    for (let i = 0; i < bits.length; i += 8) {
      hex += parseInt(bits.slice(i, i + 8), 2).toString(16).toUpperCase().padStart(2, '0');
    }
    return hex;
  }

  const codePoints = Object.keys(glyphs).map(Number).sort((a, b) => a - b);
  const effectiveAw = aw - originX;
  const scalableWidth = Math.round((effectiveAw / gh) * 1000);

  const lines = [
    `STARTFONT 2.1`,
    `FONT -misc-${meta.name || 'Untitled'}-medium-r-normal--${gh}-0-75-75-c-${effectiveAw * 10}-iso10646-1`,
    `SIZE ${gh} 75 75`,
    `FONTBOUNDINGBOX ${gw} ${gh} -${originX} -${descenderPx}`,
    `STARTPROPERTIES 5`,
    `FONT_ASCENT ${ascenderPx}`,
    `FONT_DESCENT ${descenderPx}`,
    `DEFAULT_CHAR 0`,
    `FONT_VERSION "${meta.version || '1.0'}"`,
    `COPYRIGHT "${meta.author || ''}"`,
    `ENDPROPERTIES`,
    `CHARS ${codePoints.length}`,
    '',
  ];

  for (const cp of codePoints) {
    const g = glyphs[cp];
    const glyphAw = PFM.computeGlyphAdvance(g, meta) - originX;
    lines.push(
      `STARTCHAR U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      `ENCODING ${cp}`,
      `SWIDTH ${scalableWidth} 0`,
      `DWIDTH ${glyphAw} 0`,
      `BBX ${gw} ${gh} -${originX} -${descenderPx}`,
      `BITMAP`,
    );
    for (let r = 0; r < gh; r++) lines.push(rowToHex(g.pixels, r));
    lines.push('ENDCHAR', '');
  }

  lines.push('ENDFONT');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (meta.name || 'font').replace(/[^a-zA-Z0-9_-]/g, '-') + '.bdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
