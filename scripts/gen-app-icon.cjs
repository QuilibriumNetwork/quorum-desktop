// Generates the desktop app icon: brand-blue rounded square + centered white
// Quorum symbol. Source symbol is public/quorumicon.png (white on transparent).
// Output: public/icon-512.png (used by BrowserWindow + electron-builder).
//
// Pure pngjs — no native deps. Run: node scripts/gen-app-icon.cjs
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SIZE = 512;
// Brand accent blue (--accent-500 / --quorum-blue in _colors.scss).
const BLUE = { r: 0x02, g: 0x87, b: 0xf2 };
// Rounded-square corner radius — ~22% of size, matching modern app-tile style.
const RADIUS = Math.round(SIZE * 0.22);
// Symbol footprint inside the tile (fraction of the full canvas).
const SYMBOL_SCALE = 0.6;

const root = path.join(__dirname, '..');
const symbolPath = path.join(root, 'public', 'quorumicon.png');
const outPath = path.join(root, 'public', 'icon-512.png');

const symbol = PNG.sync.read(fs.readFileSync(symbolPath));
const out = new PNG({ width: SIZE, height: SIZE });

// Signed distance helper for an antialiased rounded-square mask. Returns
// coverage in [0,1] for the pixel center at (x,y).
function roundedSquareCoverage(x, y) {
  // Distance from the rounded-rect edge (negative = inside).
  const hw = SIZE / 2;
  const dx = Math.abs(x + 0.5 - hw) - (hw - RADIUS);
  const dy = Math.abs(y + 0.5 - hw) - (hw - RADIUS);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  const outside = Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0);
  const dist = outside - RADIUS;
  // 1px antialiasing band around the edge.
  return Math.min(Math.max(0.5 - dist, 0), 1);
}

// Nearest-neighbour sample of the symbol's alpha (it's pure white, so we only
// need its alpha channel) at canvas pixel (x,y).
const symbolSize = Math.round(SIZE * SYMBOL_SCALE);
const symbolOffset = Math.round((SIZE - symbolSize) / 2);
function symbolAlpha(x, y) {
  const sx = x - symbolOffset;
  const sy = y - symbolOffset;
  if (sx < 0 || sy < 0 || sx >= symbolSize || sy >= symbolSize) return 0;
  const srcX = Math.min(symbol.width - 1, Math.floor((sx / symbolSize) * symbol.width));
  const srcY = Math.min(symbol.height - 1, Math.floor((sy / symbolSize) * symbol.height));
  return symbol.data[(symbol.width * srcY + srcX) * 4 + 3] / 255;
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (SIZE * y + x) * 4;
    const bgA = roundedSquareCoverage(x, y); // tile alpha
    const symA = symbolAlpha(x, y) * bgA;     // symbol clipped to the tile

    // Composite white symbol over blue tile.
    out.data[i] = Math.round(BLUE.r * (1 - symA) + 255 * symA);
    out.data[i + 1] = Math.round(BLUE.g * (1 - symA) + 255 * symA);
    out.data[i + 2] = Math.round(BLUE.b * (1 - symA) + 255 * symA);
    out.data[i + 3] = Math.round(bgA * 255);
  }
}

fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`Wrote ${outPath} (${SIZE}x${SIZE}, blue ${'#0287f2'}, radius ${RADIUS}px)`);
