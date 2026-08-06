/**
 * Infinite horizontal marquees.
 *
 * Default speed is taken from the reference: it translates the row 10,000px over
 * 300,000ms, i.e. 33.33px/s. Same number here, so the logo and stack tickers
 * drift identically.
 *
 * The reference simply runs one very long tween and accepts the jump when it
 * loops. Instead we measure one full copy of the content, duplicate it until it
 * covers more than two viewports, and wrap the x value at that copy's width —
 * same speed, no seam, and it survives a resize.
 *
 * Per-row options, all opt-in from markup so a row that sets none of them
 * behaves exactly as before:
 *
 *   data-marquee-speed="42"    px/s, instead of the default 33.33
 *   data-marquee-reverse       travels left→right instead of right→left
 *   data-marquee-offset="0.5"  start this far through the loop, so two rows
 *                              running together do not begin in register
 *   data-marquee-pause         ease to a stop while the pointer is over the row
 */

import { gsap } from '../core/gsap.js';
import { isTouch, onResize, prefersReducedMotion } from '../utils/env.js';

const PIXELS_PER_SECOND = 10000 / 300;

/** Seconds to ease into and out of a hover pause. Long enough not to snap. */
const HOVER_RAMP = 0.45;

function buildMarquee(track) {
  const wrapper = track.parentElement;
  if (!wrapper) return null;

  // Snapshot the authored children once; every rebuild starts from these.
  if (!track._originalHTML) track._originalHTML = track.innerHTML;
  track.innerHTML = track._originalHTML;

  const originals = Array.from(track.children);
  if (!originals.length) return null;

  const gap = parseFloat(getComputedStyle(track).columnGap) || 0;

  const measure = () =>
    originals.reduce((sum, el) => sum + el.getBoundingClientRect().width + gap, 0);

  let copyWidth = measure();
  if (copyWidth <= 0) return null;

  // Enough copies to cover the wrapper twice over, so there is always content
  // entering from the right.
  const needed = Math.max(2, Math.ceil((wrapper.offsetWidth * 2) / copyWidth) + 1);
  for (let i = 1; i < needed; i++) {
    originals.forEach((el) => track.appendChild(el.cloneNode(true)));
  }

  return copyWidth;
}

function animate(track, copyWidth) {
  const speed = parseFloat(track.dataset.marqueeSpeed) || PIXELS_PER_SECOND;
  const reverse = track.hasAttribute('data-marquee-reverse');

  const tween = gsap.fromTo(
    track,
    { x: reverse ? -copyWidth : 0 },
    {
      x: reverse ? 0 : -copyWidth,
      duration: copyWidth / speed,
      ease: 'none',
      repeat: -1,
      // Wrap rather than reset, so the loop point is invisible. The window is
      // the same either way — only the direction of travel through it changes.
      modifiers: {
        x: (value) => `${gsap.utils.wrap(-copyWidth, 0, parseFloat(value))}px`,
      },
    }
  );

  // Phase, not position: `progress` is per-iteration on a repeating tween, so
  // this starts the row partway round its own loop. Two rows can then share a
  // card set without ever showing it in the same place at the same time.
  const offset = parseFloat(track.dataset.marqueeOffset);
  if (offset) tween.progress(Math.abs(offset) % 1);

  return tween;
}

/**
 * Ease the row to a standstill under the pointer and back up on the way out.
 *
 * Tweening `timeScale` rather than calling pause(): a hard stop mid-drift reads
 * as a stutter, and this is a row the visitor has deliberately reached for.
 * Bound to the wrapper, not the track, because the track is several viewports
 * wide and moving — the wrapper is the part that holds still.
 *
 * Skipped on touch, where there is no hover to speak of and a pointerenter that
 * never gets its pointerleave would leave the row stopped for good.
 *
 * @returns an unbind function, or null if nothing was bound.
 */
function bindHoverPause(track, tween) {
  const wrapper = track.parentElement;
  if (!wrapper || !track.hasAttribute('data-marquee-pause') || isTouch()) return null;

  const ramp = (timeScale) =>
    gsap.to(tween, { timeScale, duration: HOVER_RAMP, ease: 'power2.out', overwrite: true });

  const enter = () => ramp(0);
  const leave = () => ramp(1);

  wrapper.addEventListener('pointerenter', enter);
  wrapper.addEventListener('pointerleave', leave);

  return () => {
    wrapper.removeEventListener('pointerenter', enter);
    wrapper.removeEventListener('pointerleave', leave);
  };
}

export function initMarquees() {
  const tracks = document.querySelectorAll('[data-marquee]');
  if (!tracks.length) return;

  // A still marquee is the right answer for reduced motion, but it must still
  // be laid out — leave the authored content in place and stop there.
  if (prefersReducedMotion()) return;

  const instances = [];
  const unbinds = [];

  const build = () => {
    instances.forEach((tween) => tween?.kill());
    instances.length = 0;
    // Rebuilding replaces the tween a bound handler was ramping, so the old
    // listeners have to go with it or a resize would leave one stopped row per
    // rebuild holding a reference to a dead tween.
    unbinds.forEach((off) => off());
    unbinds.length = 0;

    tracks.forEach((track) => {
      gsap.set(track, { x: 0 });
      const copyWidth = buildMarquee(track);
      if (!copyWidth) return;

      const tween = animate(track, copyWidth);
      instances.push(tween);

      const off = bindHoverPause(track, tween);
      if (off) unbinds.push(off);
    });
  };

  // Images inside the press strip have no intrinsic width until they decode; a
  // measurement taken before that is wrong, so wait for them.
  const images = Array.from(document.querySelectorAll('[data-marquee] img'));
  const pending = images.filter((img) => !img.complete);

  if (pending.length) {
    let left = pending.length;
    const done = () => {
      if (--left === 0) build();
    };
    pending.forEach((img) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    // Build once up front anyway so nothing sits frozen on a slow image.
    build();
  } else {
    build();
  }

  onResize(build, 250);
}
