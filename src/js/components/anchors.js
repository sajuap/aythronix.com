/**
 * In-page anchor navigation.
 *
 * Every nav item and CTA points at a `#section` on this page. Routed through
 * Lenis so the travel matches the rest of the scrolling, offset by the fixed
 * header, and the hash is pushed afterwards so Back still works.
 */

import { scrollToTarget } from '../core/smooth-scroll.js';
import { prefersReducedMotion } from '../utils/env.js';

/**
 * Extra offset applied on top of the target's own `scroll-margin-top`.
 *
 * Zero on purpose: Lenis already honours `scroll-margin-top`, and the sections
 * carry 6rem of it (see utilities/_helpers.scss) so that a hard load onto a
 * `#hash` clears the fixed header too. Adding a second offset here stacked the
 * two and overshot by the full header height.
 */
const HEADER_CLEARANCE = 0;

export function initAnchors() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href*="#"]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Ignore anything leaving the page.
    if (/^(mailto:|tel:|https?:)/i.test(href) && !href.includes(location.hostname)) return;
    if (link.target === '_blank') return;

    const hashIndex = href.indexOf('#');
    if (hashIndex === -1) return;

    const hash = href.slice(hashIndex);
    if (hash === '#' || hash.length < 2) return;

    // A link like "/#Team" from this page is still an in-page jump.
    const path = href.slice(0, hashIndex);
    if (path && path !== '/' && path !== location.pathname) return;

    const target = document.querySelector(hash);
    if (!target) return;

    event.preventDefault();

    scrollToTarget(target, {
      offset: HEADER_CLEARANCE,
      duration: prefersReducedMotion() ? 0 : 1.2,
    });

    if (history.pushState) history.pushState(null, '', hash);
  });

  // A cold load onto /#Team needs the same header clearance.
  if (location.hash.length > 1) {
    const target = document.querySelector(location.hash);
    if (target) {
      // After the preloader has released scroll.
      setTimeout(() => {
        scrollToTarget(target, { offset: HEADER_CLEARANCE, duration: 0 });
      }, 100);
    }
  }
}
