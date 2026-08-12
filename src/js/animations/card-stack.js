/**
 * Scroll stack — the depth cue only.
 *
 * The stacking itself is CSS. Each panel is `position: sticky`, so the browser
 * holds it at the top of the viewport and composites the next one over it on its
 * own — no pin, no scrubbed layout, nothing on the main thread per frame. That
 * is deliberate: a pinned, scrubbed stack is the version of this effect that
 * stutters, and the whole point of the pattern is that it feels effortless.
 *
 * What is left for GSAP is the bit CSS cannot do: as a panel is covered, take it
 * down a few percent so it reads as receding *behind* the one arriving rather
 * than being wiped by it. One scrubbed transform per panel, which the compositor
 * carries.
 *
 * The range is exact rather than eyeballed. The cover begins the moment the next
 * panel's top enters the viewport, and completes when that top reaches the
 * sticky offset — which is the panel's own `top`, read from the stylesheet so
 * the two cannot drift apart when that value changes.
 */

import { gsap, ScrollTrigger } from '../core/gsap.js';
import { isMobile, prefersReducedMotion } from '../utils/env.js';

/** How far a covered panel recedes. Enough to read as depth, not as a shrink. */
const COVERED_SCALE = 0.94;

export function initCardStack() {
  const stacks = document.querySelectorAll('[data-card-stack]');
  if (!stacks.length) return;

  // Below 768px the stylesheet drops the panels back into normal flow, so there
  // is nothing to recede behind anything. Reduced motion opts out of the cue and
  // keeps the stacking, which is a layout rather than an animation.
  if (isMobile() || prefersReducedMotion()) return;

  stacks.forEach((stack) => {
    const cards = [...stack.children];

    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;

      // The offset the *next* panel parks at, in px — not this one's. Each
      // panel now sticks one `--peek` lower than the one before it, so the two
      // are no longer the same number, and it is the arriving panel reaching its
      // own resting place that ends the cover. `top` is a calc() in the
      // stylesheet; the computed value has already resolved it.
      const stickyTop = parseFloat(getComputedStyle(next).top) || 0;

      gsap.to(card, {
        scale: COVERED_SCALE,
        ease: 'none',
        scrollTrigger: {
          trigger: next,
          start: 'top bottom',
          end: `top top+=${stickyTop}`,
          scrub: true,
          // The offset is in px and the viewport can change under it.
          invalidateOnRefresh: true,
        },
      });
    });
  });

  // The panels are tall, so the triggers below them moved when this ran.
  ScrollTrigger.refresh();
}
