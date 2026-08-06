/**
 * Page transition.
 *
 * One fixed panel that sweeps across every internal navigation, taken from the
 * reference's implementation. Both halves are the same 0.7s, and they are two
 * halves of a single continuous upward movement carried across the page load:
 *
 *   leaving   the panel is parked below the fold and driven up to cover, then
 *             the navigation fires
 *             y 100% → 0%,  0.7s, power2.inOut
 *
 *   arriving  the panel is already covering — from CSS, so it is over the page
 *             before any script runs — and continues up and out
 *             y 0% → -100%, 0.7s, power2.out
 *
 * The visitor sees the panel enter from the bottom, and after the load continue
 * off the top. It never reverses, which is what stops the two pages reading as
 * two separate events.
 *
 * Home is the exception at both ends, exactly as the reference has it. Arriving
 * there on a cold load the panel is cleared with no animation, and links *to*
 * home never play the covering half — in both cases because the preloader is
 * already covering the viewport from a higher layer, so a sweep underneath it
 * would only be a delay nobody can see.
 */

import { gsap } from '../core/gsap.js';
import { prefersReducedMotion } from '../utils/env.js';

/** Both halves of the sweep, and the curve each one travels on. */
const DURATION = 0.7;
const COVER_EASE = 'power2.inOut';
const REVEAL_EASE = 'power2.out';

/**
 * The home page, however it is spelled. Deployed under a subpath the site is
 * reached as `/<repo>/` and its links resolve to `/<repo>/index.html`, so this
 * has to match the tail rather than the whole path.
 */
const isHome = (pathname) => pathname === '/' || pathname.endsWith('/index.html');

/** Schemes and link kinds that are not this site navigating to itself. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

export function initPageTransition() {
  const panel = document.querySelector('.page-transition');
  if (!panel) return;

  const reduced = prefersReducedMotion();

  reveal(panel, reduced);
  bindLinks(panel, reduced);

  // Coming back through the bfcache restores this page exactly as it was left —
  // which, on a page we navigated away from, is with the panel covering
  // everything. DOMContentLoaded does not fire again on a restore, so without
  // this the visitor arrives back on a full screen of flat brand colour.
  window.addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) gsap.set(panel, { yPercent: -100 });
    },
    { passive: true }
  );
}

/** Lift the panel off the page we have just arrived on. */
function reveal(panel, reduced) {
  const cold = isHome(window.location.pathname) && document.referrer === '';

  if (cold || reduced) {
    gsap.set(panel, { yPercent: -100 });
    return;
  }

  gsap.to(panel, { yPercent: -100, duration: DURATION, ease: REVEAL_EASE });
}

/** Cover the viewport before following an internal link. */
function bindLinks(panel, reduced) {
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');

    // Anchors, other schemes, and anything the browser should open elsewhere.
    if (!href || EXTERNAL.test(href)) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;

    link.addEventListener('click', (event) => {
      // A modified or non-primary click is a request for a new tab, a new
      // window or a download. Those belong to the browser, not to us.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // Home covers itself with the preloader on arrival.
      if (isHome(url.pathname)) return;

      event.preventDefault();

      // Reduced motion still gets the navigation, just not the 0.7s of panel
      // between here and there.
      if (reduced) {
        window.location.href = link.href;
        return;
      }

      gsap.set(panel, { yPercent: 100 });
      gsap.to(panel, {
        yPercent: 0,
        duration: DURATION,
        ease: COVER_EASE,
        onComplete: () => {
          window.location.href = link.href;
        },
      });
    });
  });
}
