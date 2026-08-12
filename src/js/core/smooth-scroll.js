/**
 * Lenis smooth scrolling, driven off the GSAP ticker.
 *
 * Two things matter here:
 *  - Lenis and ScrollTrigger must share one clock. Lenis is stepped from
 *    `gsap.ticker` and pushes `ScrollTrigger.update` on every scroll, otherwise
 *    pinned/scrubbed animations lag a frame behind the content.
 *  - It is off at 767px and under. Touch scrolling already has momentum, and
 *    hijacking it costs more than it adds.
 */

import { gsap, ScrollTrigger } from './gsap.js';
import { isMobile, prefersReducedMotion } from '../utils/env.js';

let lenis = null;

export function initSmoothScroll() {
  if (isMobile() || prefersReducedMotion()) return null;

  // Loaded lazily so phones never pay for the bytes.
  return import('lenis').then(({ default: Lenis }) => {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      // Native touch behaviour stays native.
      syncTouch: false,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
      autoRaf: false,
    });

    // Lenis starts running the moment it is constructed. If the page is already
    // locked — index.html sets `is-locked` from its head, before this chunk has
    // even been requested — it has to come up stopped, or it spends the rest of
    // the preloader listening for wheel events it should be ignoring.
    if (document.documentElement.classList.contains('is-locked')) lenis.stop();

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);

    // No scrollerProxy: Lenis drives the real window scroll position rather
    // than transforming a wrapper, so ScrollTrigger reads it correctly on its
    // own. Proxying `documentElement` here would put ScrollTrigger's start/end
    // calculations in a different coordinate space than the page and shift
    // every trigger.
    ScrollTrigger.addEventListener('refresh', () => lenis.resize());
    ScrollTrigger.refresh();

    return lenis;
  });
}

export const getLenis = () => lenis;

/** Pause scrolling — used while the preloader is up and the menu is open. */
export function stopScroll() {
  document.documentElement.classList.add('is-locked');
  if (lenis) lenis.stop();
}

export function startScroll() {
  document.documentElement.classList.remove('is-locked');
  if (lenis) lenis.start();
}

/**
 * Smooth-scroll to an element or offset, clearing the fixed header.
 * Falls back to native behaviour when Lenis is not running.
 */
export function scrollToTarget(target, { offset = -80, duration = 1.2 } = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;

  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';

  // `scrollIntoView` honours the target's `scroll-margin-top`, so the header
  // clearance comes from the same place it does on the Lenis path. A manual
  // `window.scrollTo(top)` would ignore it and land the section under the nav.
  if (!offset) {
    el.scrollIntoView({ behavior, block: 'start' });
    return;
  }

  const top = el.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior });
}
