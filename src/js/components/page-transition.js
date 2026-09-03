/**
 * Page transition — a curtain with an arched hem.
 *
 * One sheet, taller than the screen, with a wide shallow curve cut into its
 * bottom edge. It travels across every internal navigation:
 *
 *   leaving   the arch descends from above the fold, its curve sweeping down the
 *             screen until the sheet covers, then the navigation fires
 *             y -100% → 0%,  1.15s
 *
 *   arriving  the sheet is already covering — from CSS, so it is over the page
 *             before any script runs — and draws back up, the same curve
 *             sweeping up and the page appearing under it
 *             y 0% → -100%,  1.45s
 *
 * The arch is the whole design and it is not this file's doing: it is a mask, in
 * scss/components/_preloader.scss. All that happens here is that one element
 * moves up and down, slowly.
 *
 * It was five columns dropping in sequence. That is where the old raked edge
 * came from and it is exactly what a single curve cannot survive — see the note
 * on the panel in the stylesheet.
 *
 * Home is the exception at both ends. Arriving there on a cold load the cover is
 * cleared with no animation, and links *to* home never play the covering half —
 * in both cases because the preloader is already covering the viewport from a
 * higher layer, so a sweep underneath it would only be a delay nobody can see.
 */

import { gsap } from '../core/gsap.js';
import { startScroll, stopScroll } from '../core/smooth-scroll.js';
import { prefersReducedMotion } from '../utils/env.js';

/**
 * Both halves of the sweep, and the curve they travel on.
 *
 * Slow, and slow at both ends. `power3.inOut` barely moves for the first fifth
 * of its run, carries through the middle and settles rather than stops — which
 * is what makes a heavy sheet read as heavy. `power2` was too eager off the mark
 * and arrived with a tap.
 *
 * The durations are long on purpose. This is the one moment on the site that is
 * asked to feel unhurried, and a cover that snaps is a cover that reads as a
 * flash rather than as something moving.
 */
const COVER_DURATION = 1.15;
const REVEAL_DURATION = 1.45;

/**
 * The two halves are eased differently, and deliberately.
 *
 * Covering is a gathering: it barely moves for the first fifth of its run, then
 * carries and settles. That is what makes a heavy sheet read as heavy, and the
 * slow start is free because the visitor has only just clicked.
 *
 * Uncovering is a release, and there the same slow start was the problem. The
 * hem sits below the fold at rest, so the first stretch of the sweep moves the
 * sheet without uncovering anything — and an ease that also creeps at the start
 * turned that into half a second where nothing on screen changed at all. Which
 * is not read as slow, it is read as stuck. Leaving immediately and settling
 * long keeps the honey in the part of it that can actually be seen.
 */
const COVER_EASE = 'power3.inOut';
const REVEAL_EASE = 'power2.out';

/**
 * A beat of stillness before the sheet is drawn back off a page that has just
 * arrived.
 *
 * Partly so it does not read as having been interrupted — a cover that starts
 * leaving in the same frame it appears never looks like it was covering
 * anything. And partly practical: the first frames after a navigation are the
 * busiest ones on the page, and this hands the sweep a settled layout to run
 * against instead of competing with it.
 */
const REVEAL_DELAY = 0.3;

/** Nothing to stagger: the curtain is one sheet. */
const STAGGER = 0;

/**
 * Where the curtain waits, above the fold. The panels are taller than the
 * viewport so the arch cut into their hem still clears the bottom of the screen
 * when they are down; parking them at -100% of that height puts the whole sheet,
 * hem included, above the top of the frame.
 */
const PARKED = -100;

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
  gsap.set(panels, { yPercent: PARKED });
  gsap.set(cover, { autoAlpha: 0 });
  // Back to the arriving hem. Matters on a bfcache return, which restores this
  // page mid-cover with the leaving one still set.
  cover.classList.remove('is-covering');
}

/**
 * Draw the curtain off the page we have just arrived on.
 *
 * Upward, so the arch is the boundary the whole way: the hem hangs below the
 * sheet, and as the sheet rises that curve sweeps up the screen and the page
 * appears underneath it, corners first and the middle of the arc last. Dropping
 * it downward instead would put the sheet's straight top edge in front and the
 * arch would never be seen on the half of the transition the visitor actually
 * waits through.
 */
function reveal(cover, panels, reduced) {
  const cold = isHome(window.location.pathname) && document.referrer === '';

  if (cold || reduced) {
    clear(cover, panels);
    if (ownsLock()) startScroll();
    return;
  }

  gsap.to(panels, {
    yPercent: PARKED,
    duration: REVEAL_DURATION,
    delay: REVEAL_DELAY,
    stagger: STAGGER,
    ease: REVEAL_EASE,
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

      // Turn the hem over for the way down. The two curves are in the
      // stylesheet; this only says which. Safe to set here because the sheet is
      // parked off-screen at this instant, so the swap cannot be seen.
      cover.classList.add('is-covering');
      gsap.set(cover, { autoAlpha: 1 });

      gsap.fromTo(
        panels,
        { yPercent: PARKED },
        {
          yPercent: 0,
          duration: COVER_DURATION,
          stagger: STAGGER,
          ease: COVER_EASE,
          onComplete: () => {
            window.location.href = link.href;
          },
        }
      );
    });
  });
}
