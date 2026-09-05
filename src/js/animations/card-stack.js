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
import { prefersReducedMotion } from '../utils/env.js';

/** How far a covered panel recedes. Enough to read as depth, not as a shrink. */
const COVERED_SCALE = 0.94;

export function initCardStack() {
  const stacks = document.querySelectorAll('[data-card-stack]');
  if (!stacks.length) return;

  // Runs at every width. It used to bail below 768px, because the stylesheet
  // dropped the panels back into normal flow there and left nothing to recede
  // behind anything; the panels are sticky on a phone now, so the depth cue goes
  // with them. It costs nothing extra to do so — the cue is one scrubbed
  // transform per panel, which the compositor carries.
  //
  // Reduced motion still opts out of the cue and keeps the stacking, which is a
  // layout rather than an animation.
  if (prefersReducedMotion()) return;

  stacks.forEach((stack) => {
    const cards = [...stack.children];

    cards.forEach((card, i) => {
      const next = cards[i + 1];
      if (!next) return;

      // The offset the *next* panel parks at, in px — not this one's. Each
      // panel sticks one `--peek` lower than the one before it, so the two are
      // not the same number, and it is the arriving panel reaching its own
      // resting place that ends the cover. `top` is a calc() in the stylesheet;
      // the computed value has already resolved it.
      //
      // Read on every refresh rather than once at setup. Both halves of that
      // calc are now breakpoint-dependent — a phone parks the panels higher and
      // peeks less, so they fit above the fold — and a viewport crossing 768px
      // would otherwise leave every trigger ending at the offset the other
      // breakpoint had.
      const stickyTop = () => parseFloat(getComputedStyle(next).top) || 0;

      gsap.to(card, {
        scale: COVERED_SCALE,
        ease: 'none',
        scrollTrigger: {
          trigger: next,
          start: 'top bottom',
          end: () => `top top+=${stickyTop()}`,
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
