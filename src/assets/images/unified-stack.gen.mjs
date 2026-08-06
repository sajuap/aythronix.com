import { chromium } from 'playwright';
import fs from 'node:fs';

const draw = ({ W, H, streams, dotsPerStream }) => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // Opaque white: the brand-tint filter maps white to white and black to brand
  // blue, so a white plate blends into the page and compresses far better than
  // an alpha channel would.
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);

  g.fillStyle = '#000';

  let seed = 20260731;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const cy = H / 2;
  const RIGHT = W * 0.97;
  const LEFT = W * 0.06;
  const MERGE_A = W * 0.46;   // streams start closing
  const MERGE_B = W * 0.72;   // fully fused
  const SPREAD = H * 0.185;   // how far apart the streams start
  const BAND = H * 0.052;     // each stream's share of the fused block

  for (let s = 0; s < streams; s++) {
    const k = s - (streams - 1) / 2;
    const yStart = cy + k * SPREAD;
    const yEnd = cy + k * BAND;
    const halfStart = H * 0.016;
    const halfEnd = BAND / 2;

    for (let i = 0; i < dotsPerStream; i++) {
      const x = LEFT + rnd() * (RIGHT - LEFT);
      const p = smooth(MERGE_A, MERGE_B, x);
      const centre = yStart + (yEnd - yStart) * p;
      const half = halfStart + (halfEnd - halfStart) * p;

      // The left end breaks up: dots scatter off the stream and thin out.
      const d = Math.max(0, 1 - (x - LEFT) / (W * 0.34));
      if (rnd() > Math.exp(-d * 2.6)) continue;

      const y = centre + (rnd() - 0.5) * 2 * half + gauss() * d * H * 0.075;
      if (y < 2 || y > H - 2) continue;

      const fade = 1 - d * 0.7;
      g.globalAlpha = (0.34 + rnd() * 0.66) * fade;
      g.beginPath();
      g.arc(x, y, (0.9 + rnd() * 1.9) * (0.5 + 0.5 * fade), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  return c.toDataURL('image/webp', 0.94);
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
const url = await page.evaluate(draw, { W: 1800, H: 1220, streams: 4, dotsPerStream: 9000 });
await browser.close();

const b64 = url.split(',')[1];
fs.writeFileSync('unified-stack.webp', Buffer.from(b64, 'base64'));
console.log('bytes:', fs.statSync('unified-stack.webp').size);
