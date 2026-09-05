/**
 * The discipline rail — rows that grow and fill as the pointer crosses them.
 *
 * Two things happen at once, and the second is the one that is easy to miss:
 *
 *   the fill    a dark panel rises from the row's bottom edge and covers it
 *   the growth  the row itself gets taller while that happens, pushing every
 *               row below it down
 *
 * The growth is not a separate flourish. The live row carries a CTA that the
 * resting row does not, and it is that CTA entering the flow that makes the row
 * taller — so the panel is not covering the row so much as the row is opening to
 * make space for what the panel has to say. Measured off the reference: the row
 * holds its top edge, its bottom travels down by the height of the CTA, and the
 * rows beneath move by exactly the same amount.
 *
 * The fill always comes from the bottom. There is no direction-sensing here: the
 * panel's bottom edge simply *is* the row's bottom edge for the whole travel,
 * rising or falling with it.
 *
 * What is not moving matters as much. Each row carries its content twice: the
 * resting copy in navy, and a white copy inside the panel, laid out by the same
 * rule. The panel slides and its inner wrapper slides the opposite way by the
 * same amount, so the white copy stands perfectly still while the panel's edge
 * sweeps across it. The eye gets a line of type changing colour from the bottom
 * up, mid-glyph — never type sliding into place.
 *
 *   panel  yPercent  100 → 0     the edge travelling up from the bottom
 *   inner  yPercent  -100 → 0    cancelling it, so the content holds still
 *
 * Two transforms rather than an animated clip, because the compositor carries
 * both. The height tween is a real layout change and there is no way around
 * that — rows below have to move — but it is one row's height on a list of five.
 *
 * The rows are links, so this answers to keyboard focus too. Touch has no hover
 * and gets none of it: the CTA is simply part of the resting row there.
 */

import { gsap } from '../core/gsap.js';
import { isTouch, prefersReducedMotion } from '../utils/env.js';

/**
 * Timings.
 *
 * One duration and one ease for both the fill and the growth, which is the
 * whole of what makes this feel like a single movement. They were on separate
 * curves — 0.45s against 0.28s, matching the rates measured off the reference —
 * and the arithmetic was right but the result was not: the row reached its full
 * height while the panel was still two thirds of the way up, so the eye caught a
 * row that jumped and a fill that then chased it. Sharing a curve, the bottom
 * edge and the growth are the same edge moving, because that is what they are.
 *
 * `inOut` rather than `out`, which is where the softness comes from. An `out`
 * ease leaves at full speed and only decelerates — the panel appeared to be
 * flung from the bottom edge, and on a row that is also growing, that opening
 * snap is the part that reads as hard. Eased at both ends, it starts from rest,
 * so nothing in the row ever changes velocity abruptly.
 *
 * The two are no longer near-equal. The reveal answers the pointer, so it wants
 * to feel prompt; the close is something the eye has already left, and letting
 * it take its time is what stops a row crossed in passing from snapping shut
 * behind you.
 */
const ENTER = { duration: 0.5, ease: 'power2.inOut' };

/** Unchanged, and now the slower of the two on purpose. */
const LEAVE = { duration: 0.65, ease: 'power2.inOut' };

export function initSectorList() {
  document.querySelectorAll('[data-sector-list]').forEach(setupList);
}

function setupList(list) {
  const rows = list.querySelectorAll('[data-sector-row]');
  if (!rows.length) return;

  // A coarse pointer never hovers: it taps, and the row navigates. Leaving the
  // listeners off is also what lets the stylesheet promote the CTA into the
  // resting row there — see the touch block in scss/sections/_sector-list.scss.
  if (isTouch()) return;

  const still = prefersReducedMotion();

  rows.forEach((row) => setupRow(row, still));
}

function setupRow(row, still) {
  const panel = row.querySelector('[data-sector-panel]');
  const inner = row.querySelector('[data-sector-panel-inner]');

  // The resting layer's own CTA. Never painted — the white one in the panel is
  // the one anybody sees — but it is what occupies the space, so animating its
  // height is what grows the row. Keeping the growth in the face rather than
  // hard-coding a number means the row opens by exactly as much as the CTA
  // needs, at any type size or breakpoint.
  const spacer = row.querySelector('[data-sector-grow]');
  if (!panel || !inner || !spacer) return;

  let tween = null;

  /**
   * Take the resting position off CSS and state it in GSAP's own terms.
   *
   * The stylesheet parks these with `translateY(±100%)` so the panel is hidden
   * before this module has loaded — but GSAP reads the computed *matrix*, which
   * by then is a pixel offset, and files it under `y`. Set `yPercent` on top of
   * that and the two stack: the panel starts a full two row-heights away and the
   * first reveal arrives late and from nowhere. Naming both here is what stops
   * the same offset being counted twice.
   */
  gsap.set(panel, { yPercent: 100, y: 0 });
  gsap.set(inner, { yPercent: -100, y: 0 });

  const play = (open) => {
    tween?.kill();

    // Reduced motion gets the state, not the travel: the row is open or it is
    // not, which is the same information without anything sweeping across it.
    const vars = still ? { duration: 0 } : open ? ENTER : LEAVE;

    tween = gsap
      .timeline({ defaults: vars })
      .to(panel, { yPercent: open ? 0 : 100 }, 0)
      .to(inner, { yPercent: open ? 0 : -100 }, 0)
      // `height: auto` rather than a measured pixel value, so a resize or a font
      // landing mid-visit cannot leave the row opening to yesterday's number.
      .to(spacer, { height: open ? 'auto' : 0 }, 0);
  };

  const open = () => {
    row.classList.add('is-live');
    play(true);
  };

  const close = () => {
    row.classList.remove('is-live');
    play(false);
  };

  // `pointerenter`/`pointerleave` rather than over/out: the row is full of
  // children, and the bubbling pair fire on every crossing between them.
  //
  // The row only ever grows *downward* under the pointer, so opening one can
  // never move it out from under the cursor that opened it — which is the usual
  // way a hover-driven layout change turns into a flicker loop.
  row.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') open();
  });

  row.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') close();
  });

  // Keyboard. `focus-visible`, so a click does not fire this a second time
  // behind the pointer's own animation.
  row.addEventListener('focus', () => {
    if (row.matches(':focus-visible')) open();
  });

  row.addEventListener('blur', close);
}
