/**
 * Page transition.
 *
 * Five full-height columns that drop across every internal navigation, each one
 * starting a tenth of a second after the one to its left:
 *
 *   leaving   the columns come down from above the fold until they cover, then
 *             the navigation fires
 *             y -100% → 0%,  0.85s, 0.1s stagger, power2.inOut
 *
 *   arriving  the columns are already covering — from CSS, so they are over the
 *             page before any script runs — and lift back out through the top
 *             y 0% → -100%,  1.05s, 0.1s stagger, power2.inOut
 *
 * The visitor sees a raked edge come down, and after the load the same rake lift
 * away. This is the reference build's transition, matched: same panel count,
 * stagger, curve and durations, differing only in colour.
 *
 * Note the cost at the leaving end — the last column does not land until
 * 0.85 + 4 × 0.1 = 1.25s after the click, and the navigation waits for it.
 *
 * Home is the exception at both ends. Arriving there on a cold load the cover is
 * cleared with no animation, and links *to* home never play the covering half —
 * in both cases because the preloader is already covering the viewport from a
 * higher layer, so a sweep underneath it would only be a delay nobody can see.
 */

import { gsap } from '../core/gsap.js';
import { startScroll, stopScroll } from '../core/smooth-scroll.js';
import { prefersReducedMotion } from '../utils/env.js';

/** Both halves of the sweep, and the curve they travel on. */
const COVER_DURATION = 0.85;
const REVEAL_DURATION = 1.05;
const STAGGER = 0.1;
const EASE = 'power2.inOut';

/**
 * The home page, however it is spelled. Deployed under a subpath the site is
 * reached as `/<repo>/` and its links resolve to `/<repo>/index.html`, so this
 * has to match the tail rather than the whole path.
 */
const isHome = (pathname) => pathname === '/' || pathname.endsWith('/index.html');

/** Schemes and link kinds that are not this site navigating to itself. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * Whether the scroll lock is this cover's to release.
 *
 * Every page now locks scrolling from its head, so nothing moves behind a cover
 * the visitor cannot see past. On the home page the preloader sits above this
 * one and holds that lock until it is finished, so releasing it here — which
 * happens within a frame of boot on a cold load — would hand the page back while
 * the preloader is still up, which is the exact thing the lock is for.
 */
const ownsLock = () => !document.querySelector('.preloader');

export function initPageTransition() {
  const cover = document.querySelector('.page-transition');
  const panels = cover ? cover.querySelectorAll('.page-transition_panel') : [];
  if (!cover || !panels.length) return;

  const reduced = prefersReducedMotion();

  // Shared with the click handler so the bfcache restore below can clear it. A
  // held object rather than a closed-over boolean because that restore has to
  // reach the same flag the handler reads.
  const state = { navigating: false };

  reveal(cover, panels, reduced);
  bindLinks(cover, panels, reduced, state);

  // Coming back through the bfcache restores this page exactly as it was left —
  // which, on a page we navigated away from, is mid-cover and mid-navigation.
  // DOMContentLoaded does not fire again on a restore, so without this the
  // visitor arrives back on a full screen of flat brand colour, on a page whose
  // links are all still blocked by the in-flight guard.
  window.addEventListener(
    'pageshow',
    (event) => {
      if (!event.persisted) return;
      state.navigating = false;
      clear(cover, panels);
      // Unconditionally, whoever set it. A restored page does not run its
      // preloader again, so on home there is nothing else coming to take the
      // lock off — and this page was left locked, mid-navigation.
      startScroll();
    },
    { passive: true }
  );
}

/**
 * Park the cover out of the way.
 *
 * `autoAlpha` rather than opacity alone: it takes `visibility` with it, which is
 * what releases the columns' composited layers between navigations. The container
 * is `pointer-events: none`, so nothing here is about hit-testing.
 */
function clear(cover, panels) {
  gsap.set(panels, { yPercent: -100 });
  gsap.set(cover, { autoAlpha: 0 });
}

/** Lift the columns off the page we have just arrived on. */
function reveal(cover, panels, reduced) {
  const cold = isHome(window.location.pathname) && document.referrer === '';

  if (cold || reduced) {
    clear(cover, panels);
    if (ownsLock()) startScroll();
    return;
  }

  gsap.to(panels, {
    yPercent: -100,
    duration: REVEAL_DURATION,
    stagger: STAGGER,
    ease: EASE,
    onComplete: () => {
      clear(cover, panels);
      // Not before: until the last column is off the page, everything under it
      // is still hidden, and a page that scrolls behind a cover is the whole
      // reason the lock is there.
      if (ownsLock()) startScroll();
    },
  });
}

/** Cover the viewport before following an internal link. */
function bindLinks(cover, panels, reduced, state) {
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

      // One navigation at a time. The cover does not take clicks — it is
      // `pointer-events: none`, so that it is not left swallowing them for the
      // whole visit — which leaves every link on the page live underneath it
      // while the columns come down. Without this, a second click during those
      // 1.25s starts a second set of tweens on the same panels and the two race
      // to set `location.href`.
      if (state.navigating) return;
      state.navigating = true;

      // Reduced motion still gets the navigation, just not the 1.25s of cover
      // between here and there.
      if (reduced) {
        window.location.href = link.href;
        return;
      }

      // The same rule at the leaving end: nothing should slide about under the
      // columns while they come down. The page we are going to locks itself from
      // its own head, and a bfcache return here is released by `pageshow` above.
      stopScroll();

      gsap.set(cover, { autoAlpha: 1 });

      gsap.fromTo(
        panels,
        { yPercent: -100 },
        {
          yPercent: 0,
          duration: COVER_DURATION,
          stagger: STAGGER,
          ease: EASE,
          onComplete: () => {
            window.location.href = link.href;
          },
        }
      );
    });
  });
}
