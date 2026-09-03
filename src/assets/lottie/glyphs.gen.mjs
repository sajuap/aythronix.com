/**
 * Generates the icon Lottie files.
 *
 *   node src/assets/lottie/glyphs.gen.mjs
 *
 * The four glyphs this site started with came from an icon set —
 * `system-regular-58-call-phone`, `-76-newspaper`, `-160-trending-up` and
 * `-63-settings-cog`, which is why three of them ended up standing for
 * Discovery, Clarity and Email at the same time. Three of the four still have an
 * honest home and are used as they are; the rest of the set is generated here so
 * every slot gets a glyph that means something, in the same format.
 *
 * Everything about the output is copied from those files rather than guessed at:
 * a 500×500 board at 60fps over 60 frames, the `sh → tm → st → tr` item order
 * inside each shape group, `[0.02745, 0.39608, 0.92157]` for the brand blue, a
 * 31.3 stroke, and `lc`/`lj` 2 for round caps and joins. The animation is a trim
 * path, which is what three of the four already used.
 *
 * Source of truth is the path data below. Regenerate rather than hand-editing a
 * .json — the bezier arrays in those files are not something to maintain by hand.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- The set ---------------------------------------------------------------
//
// Paths draw in the order given, so the stagger reads as the shape being built:
// the outline first, then whatever sits inside it. Circles are written as two
// arcs so every element is a path and the trim treats them identically.

const GLYPHS = {
  /** Discovery — a magnifier. Looking at what is already there. */
  discovery: [
    'M 315 215 A 100 100 0 1 1 115 215 A 100 100 0 1 1 315 215',
    'M 288 288 L 380 380',
  ],

  /** Blueprinting — a drawing frame divided into plates. */
  blueprint: ['M 125 125 H 375 V 375 H 125 Z', 'M 125 215 H 375', 'M 215 215 V 375'],

  /** Deployment — up, and off the ground it was standing on. */
  deployment: ['M 125 395 H 375', 'M 250 350 V 150', 'M 170 230 L 250 150 L 330 230'],

  /** Clarity — an eye. Being able to see it. */
  clarity: [
    'M 100 250 C 155 165 345 165 400 250 C 345 335 155 335 100 250 Z',
    'M 298 250 A 48 48 0 1 1 202 250 A 48 48 0 1 1 298 250',
  ],

  /** Adaptability — two directions, both available. */
  adaptability: [
    'M 125 195 H 355',
    'M 305 145 L 355 195 L 305 245',
    'M 375 305 H 145',
    'M 195 255 L 145 305 L 195 355',
  ],

  /** Focus — a target, narrowing to one point. */
  focus: [
    'M 390 250 A 140 140 0 1 1 110 250 A 140 140 0 1 1 390 250',
    'M 320 250 A 70 70 0 1 1 180 250 A 70 70 0 1 1 320 250',
    'M 265 250 A 15 15 0 1 1 235 250 A 15 15 0 1 1 265 250',
  ],

  /** Email — an envelope. */
  email: ['M 110 160 H 390 V 340 H 110 Z', 'M 110 160 L 250 262 L 390 160'],

  /** Network — two nodes and the line between them. */
  network: [
    'M 225 170 A 55 55 0 1 1 115 170 A 55 55 0 1 1 225 170',
    'M 385 330 A 55 55 0 1 1 275 330 A 55 55 0 1 1 385 330',
    'M 208 208 L 292 292',
  ],

  /** Scalability — the same step, taken again, off one baseline. */
  scalability: ['M 120 380 H 380', 'M 170 335 V 270', 'M 250 335 V 195', 'M 330 335 V 120'],

  /** Partnership — two of them, and the ground they hold in common. */
  partnership: [
    'M 300 250 A 90 90 0 1 1 120 250 A 90 90 0 1 1 300 250',
    'M 380 250 A 90 90 0 1 1 200 250 A 90 90 0 1 1 380 250',
  ],

  /** Innovation — a bulb. The idea, before there is anything to build. */
  innovation: [
    'M 342 210 A 92 92 0 1 1 158 210 A 92 92 0 1 1 342 210',
    'M 205 345 H 295',
    'M 218 383 H 282',
  ],
};

// --- Board and timing, taken from the originals ----------------------------

const SIZE = 500;
const FPS = 60;
const FRAMES = 60;
const BLUE = [0.02745, 0.39608, 0.92157, 1];
const STROKE = 31.3;

/**
 * The trim-path loop, per path index.
 *
 * `e` runs 0 → 100 and the line draws on. `s` then runs 0 → 100, which pulls the
 * start up to the end so the stroke leaves the way it arrived rather than
 * rewinding. Two frames of stagger per path, which keeps the fourth path of the
 * busiest glyph inside the 60-frame board.
 */
const DRAW_IN = [0, 20];
const DRAW_OUT = [34, 54];
const STAGGER = 2;

/** Roughly power2.inOut, in Lottie's keyframe easing form. */
const EASE_IN = { x: [0.33], y: [1] };
const EASE_OUT = { x: [0.67], y: [0] };

// --- SVG path → Lottie bezier ----------------------------------------------

/**
 * One elliptical arc as up to four cubics.
 *
 * Endpoint-to-centre parameterisation from the SVG spec's implementation notes,
 * then a quarter-turn cap per segment because a cubic cannot hold more of a
 * circle than that without visibly bulging.
 */
function arcToCubics(x1, y1, rx, ry, phiDeg, fA, fS, x2, y2) {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];

  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  // Scale the radii up if they are too small to span the two points.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const sign = fA === fS ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));

  const cxp = (co * (rx * y1p)) / ry;
  const cyp = (co * (-ry * x1p)) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };

  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  const theta1 = angle(1, 0, ux, uy);
  let dTheta = angle(ux, uy, vx, vy);
  if (!fS && dTheta > 0) dTheta -= 2 * Math.PI;
  if (fS && dTheta < 0) dTheta += 2 * Math.PI;

  const segs = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const delta = dTheta / segs;
  const k = (4 / 3) * Math.tan(delta / 4);

  const out = [];
  let theta = theta1;
  let px = x1;
  let py = y1;

  for (let i = 0; i < segs; i++) {
    const theta2 = theta + delta;
    const cos1 = Math.cos(theta);
    const sin1 = Math.sin(theta);
    const cos2 = Math.cos(theta2);
    const sin2 = Math.sin(theta2);

    const ex = cosPhi * rx * cos2 - sinPhi * ry * sin2 + cx;
    const ey = sinPhi * rx * cos2 + cosPhi * ry * sin2 + cy;

    const d1x = cosPhi * -rx * sin1 - sinPhi * ry * cos1;
    const d1y = sinPhi * -rx * sin1 + cosPhi * ry * cos1;
    const d2x = cosPhi * -rx * sin2 - sinPhi * ry * cos2;
    const d2y = sinPhi * -rx * sin2 + cosPhi * ry * cos2;

    out.push([px + k * d1x, py + k * d1y, ex - k * d2x, ey - k * d2y, ex, ey]);

    px = ex;
    py = ey;
    theta = theta2;
  }

  return out;
}

/**
 * Parse one absolute `d` into Lottie's vertex form.
 *
 * Lottie stores tangents relative to their own vertex: `o[n]` is the first
 * control point of the segment leaving vertex n, `i[n]` the second control point
 * of the segment arriving at it, both as offsets. Straight segments carry zeroes.
 */
function toLottiePath(d) {
  const tokens = d.match(/[MLHVCAZ]|-?\d*\.?\d+/gi);
  const v = [];
  const inT = [];
  const outT = [];
  let closed = false;

  let cmd = null;
  let x = 0;
  let y = 0;
  let i = 0;

  const push = (px, py) => {
    v.push([px, py]);
    inT.push([0, 0]);
    outT.push([0, 0]);
  };

  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLHVCAZ]/i.test(t)) {
      cmd = t.toUpperCase();
      i++;
      if (cmd === 'Z') {
        closed = true;
        continue;
      }
    }

    if (cmd === 'M') {
      x = num();
      y = num();
      push(x, y);
    } else if (cmd === 'L') {
      x = num();
      y = num();
      push(x, y);
    } else if (cmd === 'H') {
      x = num();
      push(x, y);
    } else if (cmd === 'V') {
      y = num();
      push(x, y);
    } else if (cmd === 'C') {
      const c1x = num();
      const c1y = num();
      const c2x = num();
      const c2y = num();
      const ex = num();
      const ey = num();
      outT[v.length - 1] = [c1x - x, c1y - y];
      push(ex, ey);
      inT[v.length - 1] = [c2x - ex, c2y - ey];
      x = ex;
      y = ey;
    } else if (cmd === 'A') {
      const rx = num();
      const ry = num();
      const rot = num();
      const fA = num();
      const fS = num();
      const ex = num();
      const ey = num();
      for (const [c1x, c1y, c2x, c2y, px, py] of arcToCubics(x, y, rx, ry, rot, fA, fS, ex, ey)) {
        outT[v.length - 1] = [c1x - x, c1y - y];
        push(px, py);
        inT[v.length - 1] = [c2x - px, c2y - py];
        x = px;
        y = py;
      }
    } else {
      throw new Error(`unhandled command ${cmd} in ${d}`);
    }
  }

  // A closed path repeats its first point as its last; Lottie carries the wrap
  // in `c` instead, so the duplicate has to go — with its tangent moved onto the
  // vertex it duplicates, or the join is drawn straight.
  if (closed && v.length > 1) {
    const first = v[0];
    const last = v[v.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.001) {
      inT[0] = inT[v.length - 1];
      v.pop();
      inT.pop();
      outT.pop();
    }
  }

  return { i: inT, o: outT, v, c: closed };
}

// --- Lottie emitter --------------------------------------------------------

const round = (n) => Math.round(n * 1000) / 1000;

const roundPath = (p) => ({
  i: p.i.map(([a, b]) => [round(a), round(b)]),
  o: p.o.map(([a, b]) => [round(a), round(b)]),
  v: p.v.map(([a, b]) => [round(a), round(b)]),
  c: p.c,
});

function trim(index) {
  const shift = index * STAGGER;
  return {
    ty: 'tm',
    s: {
      a: 1,
      k: [
        { i: EASE_IN, o: EASE_OUT, t: DRAW_OUT[0] + shift, s: [0] },
        { t: DRAW_OUT[1] + shift, s: [100] },
      ],
      ix: 1,
    },
    e: {
      a: 1,
      k: [
        { i: EASE_IN, o: EASE_OUT, t: DRAW_IN[0] + shift, s: [0] },
        { t: DRAW_IN[1] + shift, s: [100] },
      ],
      ix: 2,
    },
    o: { a: 0, k: 0, ix: 3 },
    m: 1,
    ix: 2,
    nm: 'Trim Paths 1',
    mn: 'ADBE Vector Filter - Trim',
    hd: false,
  };
}

function group(d, index) {
  return {
    ty: 'gr',
    // `sh -> tm -> st -> tr`, which is the order the originals use.
    it: [
      {
        ind: 0,
        ty: 'sh',
        ix: 1,
        ks: { a: 0, k: roundPath(toLottiePath(d)), ix: 2 },
        nm: 'Path 1',
        mn: 'ADBE Vector Shape - Group',
        hd: false,
      },
      trim(index),
      {
        ty: 'st',
        c: { a: 0, k: BLUE, ix: 3 },
        o: { a: 0, k: 100, ix: 4 },
        w: { a: 0, k: STROKE, ix: 5 },
        lc: 2,
        lj: 2,
        bm: 0,
        nm: 'Stroke',
        mn: 'ADBE Vector Graphic - Stroke',
        hd: false,
      },
      {
        ty: 'tr',
        p: { a: 0, k: [0, 0], ix: 2 },
        a: { a: 0, k: [0, 0], ix: 1 },
        s: { a: 0, k: [100, 100], ix: 3 },
        r: { a: 0, k: 0, ix: 6 },
        o: { a: 0, k: 100, ix: 7 },
        sk: { a: 0, k: 0, ix: 4 },
        sa: { a: 0, k: 0, ix: 5 },
        nm: 'Transform',
      },
    ],
    nm: `Group ${index + 1}`,
    np: 3,
    cix: 2,
    bm: 0,
    ix: index + 1,
    mn: 'ADBE Vector Group',
    hd: false,
  };
}

function build(name, paths) {
  return {
    v: '5.12.1',
    fr: FPS,
    ip: 0,
    op: FRAMES,
    w: SIZE,
    h: SIZE,
    nm: name,
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: name,
        sr: 1,
        ks: {
          o: { a: 0, k: 100, ix: 11 },
          r: { a: 0, k: 0, ix: 10 },
          p: { a: 0, k: [0, 0, 0], ix: 2, l: 2 },
          a: { a: 0, k: [0, 0, 0], ix: 1, l: 2 },
          s: { a: 0, k: [100, 100, 100], ix: 6, l: 2 },
        },
        ao: 0,
        shapes: paths.map(group),
        ip: 0,
        op: FRAMES,
        st: 0,
        bm: 0,
      },
    ],
    markers: [],
  };
}

// --- The imported four -----------------------------------------------------
//
// These were rendering black, and had been all along.
//
// Every colour in them is driven by an After Effects expression —
// `comp('system-regular-…').layer('control').effect('primary')('Color')` — which
// needs lottie's expression engine to evaluate. The site loads `lottie_light`,
// which does not include it, so the property never received a value and fell
// through to black. Verified by running all twelve through the real player:
// the generated glyphs came out `rgb(6,101,235)`, these four `rgb(0,0,0)`.
//
// The fix is to resolve the expression here rather than ship an engine to
// evaluate it at runtime: strip the expression and write the brand blue into the
// value it was reaching for. Nothing is lost — all 43 expressions across the four
// files are colour, none of them drives motion. Idempotent, so re-running is
// safe.
// `icon-2` was in this list and is not in the folder — it went with the pages
// rework in 0e60d24, and nothing has referenced it since. The name stayed here,
// which is enough to crash the run on `readFileSync` before the last two files
// are reached, so the script had quietly stopped being runnable. Names here have
// to match what is actually on disk.
const IMPORTED = ['icon-1', 'icon-3', 'built-icon'];

function normaliseImported(name) {
  const file = join(HERE, `${name}.json`);
  const json = JSON.parse(readFileSync(file, 'utf8'));

  let expressions = 0;
  let colours = 0;

  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;

    // Fills and strokes: pin the colour, drop the expression that was meant to
    // supply it.
    if ((node.ty === 'fl' || node.ty === 'st') && node.c) {
      if (node.c.x !== undefined) {
        delete node.c.x;
        expressions++;
      }
      node.c.a = 0;
      node.c.k = [...BLUE];
      colours++;
    }

    // Anything else still carrying an expression would be dead weight at best,
    // since nothing can evaluate it.
    if (typeof node.x === 'string' && node.x.includes('$bm_rt')) {
      delete node.x;
      expressions++;
    }

    Object.values(node).forEach(walk);
  };

  walk(json);
  writeFileSync(file, JSON.stringify(json));
  return { expressions, colours };
}

let written = 0;
for (const [name, paths] of Object.entries(GLYPHS)) {
  const json = build(name, paths);
  writeFileSync(join(HERE, `${name}.json`), JSON.stringify(json));
  const verts = json.layers[0].shapes.reduce((n, g) => n + g.it[0].ks.k.v.length, 0);
  console.log(`generated  ${name.padEnd(14)} ${paths.length} path(s), ${verts} vertices`);
  written++;
}

for (const name of IMPORTED) {
  const { expressions, colours } = normaliseImported(name);
  console.log(
    `normalised ${name.padEnd(14)} ${colours} colour(s) pinned to brand blue, ` +
      `${expressions} expression(s) stripped`
  );
}

console.log(`\n${written} generated, ${IMPORTED.length} normalised, in ${HERE}`);
