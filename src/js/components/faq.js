/**
 * FAQ accordion.
 *
 * One answer open at a time: opening a question closes whichever was open, and
 * both halves of that run on the same curve so it reads as one movement rather
 * than a close followed by an open.
 *
 * The split of labour is deliberate. Height is the only thing JS touches —
 * `height: auto` cannot be expressed in CSS as a transition, and measuring it is
 * the one job the stylesheet genuinely cannot do. Everything else that moves —
 * the mark turning from a plus to a minus, the question taking the brand
 * colour — is a CSS transition hung off an `is-open` class, tuned to the same
 * duration and curve. Fewer moving parts, and the parts that are moving are the
 * ones the compositor is best at.
 *
 * The panels start open in the markup and are collapsed here, so a visit where
 * this module never arrives gets a readable list of questions and answers rather
 * than six headings that do nothing.
 */

import { gsap } from '../core/gsap.js';
import { prefersReducedMotion } from '../utils/env.js';

/** Opening is the movement being watched, so it takes slightly longer. */
const OPEN = { duration: 0.5, ease: 'power2.inOut' };
const CLOSE = { duration: 0.42, ease: 'power2.inOut' };

export function initFaq() {
  document.querySelectorAll('[data-faq]').forEach(setupFaq);
}

function setupFaq(list) {
  const items = [...list.querySelectorAll('[data-faq-item]')];
  if (!items.length) return;

  // Reduced motion gets the state without the travel. The accordion is still an
  // accordion — it just arrives rather than unfolds.
  const still = prefersReducedMotion();

  /** The open item, or null. Only ever one. */
  let current = null;

  const entries = items.map((item) => {
    const trigger = item.querySelector('[data-faq-trigger]');
    const panel = item.querySelector('[data-faq-panel]');
    if (!trigger || !panel) return null;

    const entry = { item, trigger, panel, tween: null };

    // Collapsed to start. `hidden` as well as zero height, so a closed answer is
    // out of the accessibility tree rather than merely clipped — a screen reader
    // reading six answers nobody asked to open is the usual way this pattern
    // goes wrong.
    gsap.set(panel, { height: 0 });
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', () => toggle(entry));

    return entry;
  }).filter(Boolean);

  function open(entry) {
    entry.tween?.kill();
    entry.item.classList.add('is-open');
    entry.trigger.setAttribute('aria-expanded', 'true');

    // Out of `display: none` before anything is measured, or the height reads 0.
    entry.panel.hidden = false;

    entry.tween = gsap.to(entry.panel, {
      height: 'auto',
      ...(still ? { duration: 0 } : OPEN),
      // Left at `auto` rather than the pixel value it landed on, so the answer
      // can reflow — a narrower window, a font arriving late — without being
      // pinned to a height measured under different conditions.
      onComplete: () => gsap.set(entry.panel, { height: 'auto' }),
    });

    current = entry;
  }

  function close(entry) {
    entry.tween?.kill();
    entry.item.classList.remove('is-open');
    entry.trigger.setAttribute('aria-expanded', 'false');

    entry.tween = gsap.to(entry.panel, {
      height: 0,
      ...(still ? { duration: 0 } : CLOSE),
      onComplete: () => {
        entry.panel.hidden = true;
      },
    });

    if (current === entry) current = null;
  }

  function toggle(entry) {
    if (current === entry) {
      close(entry);
      return;
    }

    // Both at once, on their own curves. Closing is the shorter of the two, so
    // the page has finished giving back the old answer by the time the new one
    // has finished arriving.
    if (current) close(current);
    open(entry);
  }
}
