/**
 * The Selected Work rail on the portfolio page.
 *
 * The row is a plain `overflow-x` scroller and needs none of this — see the note
 * at the top of scss/sections/_work-rail.scss. Everything here is an addition to
 * something that already scrolls:
 *
 *   the drift   the row travels on its own, slowly, and loops. It is JS adding
 *               to `scrollLeft` each frame rather than a transform on the track,
 *               so the row stays a real scroll container while it moves.
 *   the loop    the authored cards are cloned until they cover the wrap, and the
 *               scroll position is kept inside one period of that pattern. The
 *               jump back is invisible because the content either side of it is
 *               identical.
 *   drag        a mouse has no horizontal wheel, so without this the only way
 *               across the row is the keyboard. Press and pull, and the drift
 *               gets out of the way while you do.
 *   the cursor  which is what says the row can be taken hold of at all. It is
 *               also why the drag has to suppress its own click: a card is a
 *               link, and every drag ending on one would otherwise open it.
 *
 * Touch gets the drift but not the drag or the cursor: the row already swipes
 * with real momentum, and a pointer that follows a finger is one nobody sees.
 * Reduced motion gets neither the drift nor the clones.
 */

import { gsap } from '../core/gsap.js';
import { isTouch, onResize, prefersReducedMotion } from '../utils/env.js';

/** How fast the row travels, in CSS pixels per second. */
const DRIFT_SPEED = 40;

/**
 * How quickly the drift eases to a stop and back up, as the fraction of the
 * remaining difference closed each frame at 60fps. Low enough that a row caught
 * under the pointer slows rather than snaps.
 */
const RAMP = 0.08;

/**
 * How far the pointer travels before a press counts as a drag rather than a
 * click. Below this a card still opens, so a slightly unsteady hand does not
 * cost a visitor the link they were aiming at.
 */
const DRAG_THRESHOLD = 6;

export function initWorkRail() {
  document.querySelectorAll('[data-work-rail]').forEach(setupRail);
}

function setupRail(rail) {
  const viewport = rail.querySelector('[data-work-rail-viewport]');
  const track = rail.querySelector('[data-work-rail-track]');
  if (!viewport || !track) return;

  const drift = setupDrift(rail, viewport, track);

  // Both of the rest are pointer affordances. A coarse pointer has the row's
  // own momentum scrolling and no cursor to draw.
  if (isTouch()) return;

  setupDrag(rail, viewport, drift);
  setupCursor(rail, viewport);
}

/**
 * The drift, and the loop that makes it endless.
 *
 * @returns a handle the drag uses to hold the drift off and to keep its own
 *   origin correct across a wrap. Every method is safe to call when the drift
 *   never started, which is what reduced motion and a row that fits both give.
 */
function setupDrift(rail, viewport, track) {
  const idle = { hold: () => {}, release: () => {}, normalize: () => 0, sync: () => {} };

  // Someone who asked for less motion did not ask for a row that moves by
  // itself. The cards are still all there and still scroll by hand.
  if (prefersReducedMotion()) return idle;

  const originals = Array.from(track.children);
  if (!originals.length) return idle;

  let period = 0;
  let held = 0;
  let visible = true;
  let multiplier = 1;

  /**
   * The drift's own idea of where the row is, carried at full precision.
   *
   * At 40px/s the row moves two thirds of a pixel per frame, and `scrollLeft`
   * is not guaranteed to hand that back unrounded — read it every frame and the
   * remainder can be lost on each one, which stalls the row or makes it stutter.
   * So the position is accumulated here and written out, and re-synced from the
   * element whenever something else has moved it.
   */
  let pos = 0;

  /**
   * One period is the authored set plus the gap that follows it — the distance
   * after which the row looks exactly as it did. Measured rather than assumed,
   * because the card width is a breakpoint away from changing.
   */
  const measure = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    period = originals.reduce((sum, card) => sum + card.getBoundingClientRect().width + gap, 0);
  };

  /**
   * Enough copies that the wrap band always has a full viewport of row behind
   * it in both directions. Two periods of travel plus whatever is on screen,
   * and one spare set so the far edge is never the thing being looked at.
   */
  const fill = () => {
    // Every rebuild starts from the authored cards, or a resize compounds.
    track.replaceChildren(...originals);
    measure();
    if (period <= 0) return;

    const needed = Math.ceil(viewport.clientWidth / period) + 3;
    for (let copy = 1; copy < needed; copy += 1) {
      originals.forEach((card) => {
        const clone = card.cloneNode(true);
        // A duplicate is scenery, not content: out of the accessibility tree
        // and out of the tab order, so the row is read and tabbed once.
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'));
        track.appendChild(clone);
      });
    }
  };

  /**
   * Keep the scroll position inside the middle band, so there is always a full
   * period of row to travel into on either side. Returns the shift applied, so
   * a drag in progress can move its own origin by the same amount and not jump.
   */
  const normalize = () => {
    if (period <= 0) return 0;

    const before = viewport.scrollLeft;
    let x = before;
    while (x >= period * 2) x -= period;
    while (x < period) x += period;

    if (x === before) return 0;
    viewport.scrollLeft = x;
    pos = x;
    return x - before;
  };

  fill();
  if (period <= 0) return idle;

  // Park one period in, which is the same view as the start but with a period of
  // row behind it to drag back into.
  viewport.scrollLeft = period;
  pos = period;

  // Off screen it is work nobody can see. The row is well below the fold on this
  // page, so this is most of its life.
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        visible = entry.isIntersecting;
      }),
      { rootMargin: '200px' }
    ).observe(rail);
  }

  // Under the pointer the row stops, so it can be read and aimed at. Same
  // behaviour `data-marquee-pause` gives the tickers elsewhere on the site.
  rail.addEventListener('pointerenter', () => {
    held += 1;
  });
  rail.addEventListener('pointerleave', () => {
    held = Math.max(0, held - 1);
  });

  gsap.ticker.add((time, deltaTime) => {
    if (!visible) return;

    const target = held > 0 ? 0 : 1;
    multiplier += (target - multiplier) * RAMP;

    // Below this the row is stopped for all practical purposes, and writing
    // sub-pixel scroll offsets every frame keeps it from ever settling.
    if (multiplier < 0.001) return;

    // Anything but the drift — a keypress, a trackpad swipe, a drag — moves the
    // row out from under `pos`. A whole pixel is well past sub-pixel rounding
    // and well under what any of those move in a frame.
    if (Math.abs(viewport.scrollLeft - pos) > 1) pos = viewport.scrollLeft;

    pos += (DRIFT_SPEED * multiplier * deltaTime) / 1000;
    viewport.scrollLeft = pos;
    normalize();
  });

  onResize(() => {
    // How far through the period it was, so a resize does not throw the row
    // back to the start — the card width changes at two breakpoints, and with
    // it the period the loop is built on.
    const through = period > 0 ? (viewport.scrollLeft - period) / period : 0;
    fill();
    if (period <= 0) return;
    pos = period + through * period;
    viewport.scrollLeft = pos;
  }, 150);

  return {
    hold: () => {
      held += 1;
    },
    release: () => {
      held = Math.max(0, held - 1);
    },
    normalize,
    /** The drag writes `scrollLeft` itself; this keeps the drift's copy honest. */
    sync: () => {
      pos = viewport.scrollLeft;
    },
  };
}

/**
 * Press and pull.
 *
 * The pointer is captured on the viewport, so a drag that leaves the row keeps
 * feeding it moves and releases cleanly wherever it ends.
 */
function setupDrag(rail, viewport, drift) {
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  let travelled = 0;

  viewport.addEventListener('pointerdown', (event) => {
    // Left button only, and never a pen or a finger — those scroll natively and
    // capturing them would fight the platform's own momentum.
    if (event.button !== 0 || event.pointerType !== 'mouse') return;

    dragging = true;
    travelled = 0;
    startX = event.clientX;
    startScroll = viewport.scrollLeft;
    viewport.setPointerCapture(event.pointerId);
    rail.classList.add('is-dragging');
    drift.hold();
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;

    const dx = event.clientX - startX;
    // The furthest it ever got, not where it ended: a drag out and back is
    // still a drag, and should still not open the card underneath.
    travelled = Math.max(travelled, Math.abs(dx));

    viewport.scrollLeft = startScroll - dx;
    // A drag can cross the wrap. The loop moves the scroll position by a whole
    // period when it does, so the origin this is measured from has to move with
    // it or the row leaps out from under the hand.
    startScroll += drift.normalize();
    drift.sync();
  });

  const release = (event) => {
    if (!dragging) return;
    dragging = false;
    rail.classList.remove('is-dragging');
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    drift.release();
  };

  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);

  // In the capture phase, so it runs before the card's own link sees the click.
  // `travelled` survives from the drag because the click lands after pointerup.
  viewport.addEventListener(
    'click',
    (event) => {
      if (travelled <= DRAG_THRESHOLD) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );
}

/**
 * The pill that replaces the pointer over the row: the word while the row is
 * there to be pulled, the arrow while a card is there to be opened.
 *
 * `has-custom-cursor` is added here rather than sitting in the markup: it is
 * what takes the native pointer away, and doing that before there is something
 * to put in its place would leave the row with no pointer at all.
 */
function setupCursor(rail, viewport) {
  const cursor = rail.querySelector('[data-work-rail-cursor]');
  if (!cursor) return;

  rail.classList.add('has-custom-cursor');

  // Under reduced motion it still tracks the pointer — a cursor that lags its
  // own pointer is the one thing it must not do — but with no easing tail.
  const duration = prefersReducedMotion() ? 0 : 0.3;

  gsap.set(cursor, { xPercent: -50, yPercent: -50, scale: 0.6 });

  const xTo = gsap.quickTo(cursor, 'x', { duration, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration, ease: 'power3' });

  rail.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;

    // Put it under the pointer before it is shown, or it flies in from wherever
    // the pointer left the row last time.
    const box = rail.getBoundingClientRect();
    gsap.set(cursor, { x: event.clientX - box.left, y: event.clientY - box.top });

    rail.classList.add('is-cursor-in');
    gsap.to(cursor, { scale: 1, duration: duration ? 0.35 : 0, ease: 'power3.out' });
  });

  rail.addEventListener('pointerleave', () => {
    rail.classList.remove('is-cursor-in', 'is-over-card');
    gsap.to(cursor, { scale: 0.6, duration: duration ? 0.25 : 0, ease: 'power3.in' });
  });

  rail.addEventListener('pointermove', (event) => {
    const box = rail.getBoundingClientRect();
    xTo(event.clientX - box.left);
    yTo(event.clientY - box.top);
  });

  // Which face it shows depends on what is under it. `pointerover` fires on
  // every crossing inside the row, including between a card's own children, so
  // the test is always "is a card anywhere above this element".
  const overCard = (node) => node instanceof Element && Boolean(node.closest('.work-card_link'));

  viewport.addEventListener('pointerover', (event) => {
    rail.classList.toggle('is-over-card', overCard(event.target));
  });

  viewport.addEventListener('pointerout', (event) => {
    if (!overCard(event.relatedTarget)) rail.classList.remove('is-over-card');
  });
}
