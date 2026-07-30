/**
 * Infinite horizontal marquees.
 *
 * Speed is taken from the reference: it translates the row 10,000px over
 * 300,000ms, i.e. 33.33px/s. Same number here, so the drift reads identically.
 *
 * The reference simply runs one very long tween and accepts the jump when it
 * loops. Instead we measure one full copy of the content, duplicate it until it
 * covers more than two viewports, and wrap the x value at that copy's width —
 * same speed, no seam, and it survives a resize.
 */

import { gsap } from '../core/gsap.js';
import { onResize, prefersReducedMotion } from '../utils/env.js';

const PIXELS_PER_SECOND = 10000 / 300;

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
  const duration = copyWidth / PIXELS_PER_SECOND;

  return gsap.fromTo(
    track,
    { x: 0 },
    {
      x: -copyWidth,
      duration,
      ease: 'none',
      repeat: -1,
      // Wrap rather than reset, so the loop point is invisible.
      modifiers: {
        x: (value) => `${gsap.utils.wrap(-copyWidth, 0, parseFloat(value))}px`,
      },
    }
  );
}

export function initMarquees() {
  const tracks = document.querySelectorAll('[data-marquee]');
  if (!tracks.length) return;

  // A still marquee is the right answer for reduced motion, but it must still
  // be laid out — leave the authored content in place and stop there.
  if (prefersReducedMotion()) return;

  const instances = [];

  const build = () => {
    instances.forEach((tween) => tween?.kill());
    instances.length = 0;

    tracks.forEach((track) => {
      gsap.set(track, { x: 0 });
      const copyWidth = buildMarquee(track);
      if (copyWidth) instances.push(animate(track, copyWidth));
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
