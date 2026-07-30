/**
 * Corner-bracket hover.
 *
 * Every `.is-ext` button has four 8px brackets sitting 4px outside its corners.
 * On hover each one slides a further 4px diagonally outward over 200ms; on
 * leave it returns over the same 200ms. Values are the reference's.
 *
 * The catch: each bracket is one SVG rotated to face its corner, and that
 * rotation lives in the CSS `transform`. Animating x/y with GSAP takes over the
 * whole transform, so the rotation has to be handed to GSAP up front or the
 * brackets snap to a single orientation on first hover.
 */

import { gsap } from '../core/gsap.js';
import { isTouch } from '../utils/env.js';

// corner class → [rotation, xDirection, yDirection]
const CORNERS = [
  ['is-top-left', 270, -1, -1],
  ['is-bottom-left', 180, -1, 1],
  ['is-bottom-right', 90, 1, 1],
  ['is-top-right', 0, 1, -1],
];

const DISTANCE = 4;
const DURATION = 0.2;

export function initButtonBrackets() {
  // Hover has no meaning on a touch screen, and binding it there causes the
  // brackets to stick out after a tap.
  if (isTouch()) return;

  const buttons = document.querySelectorAll('[data-brackets]');

  buttons.forEach((button) => {
    const targets = [];

    CORNERS.forEach(([className, rotation, dx, dy]) => {
      const el = button.querySelector(`.select-button-vector.${className}.is-ext`);
      if (!el) return;

      // Seed the transform GSAP will own from here on, rotation included.
      gsap.set(el, { rotation, x: 0, y: 0 });
      targets.push({ el, dx, dy });
    });

    if (!targets.length) return;

    const to = (open) => {
      targets.forEach(({ el, dx, dy }) => {
        gsap.to(el, {
          x: open ? dx * DISTANCE : 0,
          y: open ? dy * DISTANCE : 0,
          duration: DURATION,
          ease: open ? 'power2.out' : 'power2.in',
          overwrite: 'auto',
        });
      });
    };

    button.addEventListener('mouseenter', () => to(true));
    button.addEventListener('mouseleave', () => to(false));
    // Keyboard users get the same affordance.
    button.addEventListener('focusin', () => to(true));
    button.addEventListener('focusout', () => to(false));
  });
}
