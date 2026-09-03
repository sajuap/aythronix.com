/**
 * Image trail — the work appearing behind the pointer as it crosses the
 * capability wall.
 *
 * The whole effect is one rule: every time the pointer has travelled far enough
 * since the last one, the next picture in the pool is dropped where the pointer
 * is now, tipped a few degrees, and given a moment to arrive before it goes. The
 * pictures are a fixed pool cycled round rather than elements created per move —
 * a pointer crossing this section fires hundreds of moves, and building a node
 * for each is how a decorative flourish becomes the reason a page drops frames.
 *
 * The distance threshold is what makes it a trail rather than a strobe. Placing
 * one per pointer event would fire them faster than they can fade, so the
 * section fills with pictures and never empties; placing one per distance means
 * a slow hand gets a few and a fast sweep gets a line of them, which is the
 * behaviour being reached for.
 *
 * It answers the words, not the section. Only a move that lands on a word places
 * anything — the band is mostly the space around and between the rows, and a
 * trail that fires there is one that follows the pointer everywhere instead of
 * being something the words do.
 *
 * Mouse only. There is no pointer to trail on a touch screen, and the effect is
 * pure decoration — reduced motion turns it off entirely and the words carry the
 * section on their own.
 */

import { gsap } from '../core/gsap.js';
import { isTouch, onResize, prefersReducedMotion } from '../utils/env.js';

/** How far the pointer travels between one picture and the next, in px. */
const THRESHOLD = 140;

/**
 * How many pictures are in flight at once. Enough that a fast sweep leaves a
 * trail rather than reusing the one that is still fading in front of it, and
 * the authored captures are cycled up to this count.
 */
const POOL_SIZE = 10;

/** Seconds each picture holds at full strength before it starts to leave. */
const HOLD = 0.5;

export function initImageTrail() {
  document.querySelectorAll('[data-image-trail]').forEach((section) => {
    // Always. The rows travel on a touch screen too, and a word sliding through
    // a still line is just as unreadable there.
    setupStillLines(section);
    setupTrail(section);
  });
}

/**
 * Cut the tunnel each still line stands in.
 *
 * The row carries a mask with a hard-edged gap in it — see `mask-with-tunnel` in
 * scss/sections/_image-trail.scss — and the two sides of that gap are the only
 * thing this has to supply. Measure where the still line actually landed, hand
 * the row those two numbers, and a travelling word goes out of sight at the
 * mouth, stays out of sight for however long it is, and comes back at the far
 * side. Nothing dims and nothing gives way.
 *
 * The mask is what makes it certain. An opaque patch in front of the row was
 * tried twice and lost to paint order both times; masked-out content is not
 * painted at all, so there is no order for it to lose.
 *
 * No per-frame work: the row does not move and the still line does not move, so
 * the tunnel is measured once and again only when the layout changes under it.
 */
function setupStillLines(section) {
  const stills = Array.from(section.querySelectorAll('[data-trail-still]'));
  if (!stills.length) return;

  const measure = () => {
    stills.forEach((still) => {
      const line = still.closest('.trail_line');
      const row = line && line.querySelector('.trail_row');
      const word = still.querySelector('.trail_word');
      if (!row || !word) return;

      // Both boxes are viewport-relative, so the difference is in the row's own
      // coordinates whatever the page is scrolled to.
      const rowBox = row.getBoundingClientRect();
      const wordBox = word.getBoundingClientRect();

      row.style.setProperty('--tunnel-a', `${wordBox.left - rowBox.left}px`);
      row.style.setProperty('--tunnel-b', `${wordBox.right - rowBox.left}px`);
      // Turns on the soft mouth. Opt-in per row, so the rows with no still line
      // in them keep an unbroken mask.
      row.classList.add('has-tunnel');
    });
  };

  measure();

  // The still line moves with the column and its width moves with the type, so
  // every breakpoint puts the mouth somewhere new.
  onResize(measure, 200);
}

function setupTrail(section) {
  if (isTouch() || prefersReducedMotion()) return;

  const seeds = Array.from(section.querySelectorAll('[data-trail-img]'));
  if (!seeds.length) return;

  const layer = seeds[0].parentElement;
  const pool = [...seeds];

  // Cycle the authored captures until the pool is deep enough. Clones share a
  // `src` with their seed, so this costs DOM nodes and no extra bytes.
  while (pool.length < POOL_SIZE) {
    const clone = pool[pool.length % seeds.length].cloneNode(true);
    layer.appendChild(clone);
    pool.push(clone);
  }

  // GSAP owns the transform from here. The centring is set once and survives
  // every later write, so `place` only ever has to think in pointer coordinates.
  gsap.set(pool, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });

  let lastX = null;
  let lastY = null;
  let next = 0;
  let depth = 0;

  section.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;

    // Over the words, not merely inside the section. The band is mostly empty
    // space between and around the rows, and a trail that fires there is one
    // that follows the pointer everywhere rather than answering the words.
    //
    // `event.target` is enough to tell: the picture layer above takes no pointer
    // events, so whatever is under the pointer is either a word or the row and
    // section behind it.
    if (!(event.target instanceof Element) || !event.target.closest('[data-trail-word]')) return;

    const box = section.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;

    // The first move onto a word always places one, so the trail starts where
    // the pointer arrived rather than a threshold further on.
    if (lastX !== null && Math.hypot(x - lastX, y - lastY) < THRESHOLD) return;

    lastX = x;
    lastY = y;
    depth += 1;

    place(pool[next % pool.length], x, y, depth);
    next += 1;
  });

  // Re-entering somewhere else should not count as one long move from wherever
  // the pointer left, or crossing the section twice places nothing the second
  // time until the threshold is cleared again.
  section.addEventListener('pointerleave', () => {
    lastX = null;
    lastY = null;
  });
}

/**
 * Drop one picture at a point and let it go again.
 *
 * `killTweensOf` first because the pool wraps: the element being placed may
 * still be part-way through its own exit, and two timelines writing the same
 * opacity is a picture that flickers instead of arriving.
 */
function place(img, x, y, depth) {
  gsap.killTweensOf(img);

  gsap.set(img, {
    x,
    y,
    // Newest on top, always. The counter only rises, so a picture placed later
    // never lands behind one placed before it.
    zIndex: depth,
    // A couple of degrees, which is the reference's range. Enough that a run of
    // them does not look printed in a column; past about four they stop reading
    // as pictures dropped on a surface and start reading as tilted.
    rotation: gsap.utils.random(-2.5, 2.5),
    scale: 0.6,
    opacity: 0,
  });

  gsap
    .timeline()
    .to(img, { opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' })
    .to(img, { opacity: 0, scale: 0.94, duration: 0.5, ease: 'power2.in' }, `+=${HOLD}`);
}
