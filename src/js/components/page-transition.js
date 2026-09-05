/**
 * Page transition — a curtain with an arched hem.
 *
 * One sheet, taller than the screen, with a wide shallow curve cut into its
 * bottom edge. It travels across every internal navigation:
 *
 *   leaving   the arch descends from above the fold, its curve sweeping down the
 *             screen until the sheet covers, then the navigation fires
 *
 *   arriving  the sheet is already covering — from CSS, so it is over the page
 *             before any script runs — and draws back up, the same curve
 *             sweeping up and the page appearing under it
 *
 * Neither the arch nor the movement is this file's doing. The hem is a mask and
 * the sweep is a CSS transition, both in scss/components/_preloader.scss; all
 * that happens here is that classes go on and come off, and something waits for
 * the sheet to finish before navigating.
 *
 * **Why the movement is not a tween.** It used to be, and it stuttered — badly
 * enough to read as a glitch rather than as slowness. This animation runs across
 * the busiest half-second a page ever has: the stylesheet has just landed, the
 * modules are booting, ScrollTrigger is measuring. A tween has to be advanced by
 * hand on the main thread every frame, so when that thread stalls the tween does
 * not pause, it jumps. Recorded on a cold inner-page load, the main thread went
 * away for 400ms mid-sweep and the sheet moved 508px — 41% of its whole travel —
 * between one paint and the next. GSAP's own lag smoothing did not catch it
 * because its threshold is half a second. A transform transition is handed to
 * the compositor, which carries on interpolating at its own pace however busy
 * the main thread gets, so what is on screen is the curve rather than whatever
 * was left of it.
 *
 * Home is the exception at both ends. Arriving there on a cold load the cover is
 * cleared with no animation, and links *to* home never play the covering half —
 * in both cases because the preloader is already covering the viewport from a
 * higher layer, so a sweep underneath it would only be a delay nobody can see.
 */

import { startScroll, stopScroll } from '../core/smooth-scroll.js';
import { prefersReducedMotion } from '../utils/env.js';

/**
 * A beat of stillness before the sheet is drawn back off a page that has just
 * arrived.
 *
 * Partly so it does not read as having been interrupted — a cover that starts
 * leaving in the same frame it appears never looks like it was covering
 * anything. And partly practical: this is measured from a *painted* frame rather
 * than from DOMContentLoaded, so the cover is provably on screen before it
 * starts to leave.
 */
const REVEAL_DELAY = 300;

/**
 * Grace on top of the transition's own duration before giving up on
 * `transitionend`.
 *
 * The event is reliable, but "reliable" is not the standard for the callback
 * that fires the navigation: if it were ever missed — the tab hidden mid-sweep,
 * the transition interrupted — the visitor would be left sitting on a blue
 * screen that never goes anywhere. The fallback is what makes that impossible.
 */
const SETTLE_GRACE = 400;

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

/**
 * Run `done` when the sheet has finished travelling, once and once only.
 *
 * The duration is read back off the element rather than repeated here, so the
 * stylesheet stays the single place either half of this is timed.
 */
function whenSettled(panel, done) {
  const ms = parseFloat(getComputedStyle(panel).transitionDuration) * 1000 || 0;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    panel.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    done();
  };

  // `transform` only, and only from the panel itself — a bubbling `transitionend`
  // from anything inside it would otherwise end the sweep early.
  const onEnd = (event) => {
    if (event.target === panel && event.propertyName === 'transform') finish();
  };

  panel.addEventListener('transitionend', onEnd);
  const timer = setTimeout(finish, ms + SETTLE_GRACE);
}

/** Two frames, so the class that follows is applied to something already drawn. */
function afterPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

export function initPageTransition() {
  const cover = document.querySelector('.page-transition');
  const panel = cover ? cover.querySelector('.page-transition_panel') : null;
  if (!cover || !panel) return;

  const reduced = prefersReducedMotion();

  // Shared with the click handler so the bfcache restore below can clear it. A
  // held object rather than a closed-over boolean because that restore has to
  // reach the same flag the handler reads.
  const state = { navigating: false };

  reveal(cover, panel, reduced);
  bindLinks(cover, panel, reduced, state);

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
      park(cover);
      // Unconditionally, whoever set it. A restored page does not run its
      // preloader again, so on home there is nothing else coming to take the
      // lock off — and this page was left locked, mid-navigation.
      startScroll();
    },
    { passive: true }
  );
}

/** Out of the way, off its layer, and back to the arriving hem. */
function park(cover) {
  cover.classList.remove('is-revealing', 'is-covering', 'is-down');
  cover.classList.add('is-idle');
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
function reveal(cover, panel, reduced) {
  const cold = isHome(window.location.pathname) && document.referrer === '';

  if (cold || reduced) {
    park(cover);
    if (ownsLock()) startScroll();
    return;
  }

  // Measured from a painted frame rather than from DOMContentLoaded. The old
  // version counted its delay from whenever the module happened to boot, which
  // on a slow load was before the cover had been composited even once.
  afterPaint(() => {
    setTimeout(() => {
      cover.classList.add('is-revealing');

      whenSettled(panel, () => {
        park(cover);
        // Not before: until the sheet is off the page, everything under it is
        // still hidden, and a page that scrolls behind a cover is the whole
        // reason the lock is there.
        if (ownsLock()) startScroll();
      });
    }, REVEAL_DELAY);
  });
}

/** Cover the viewport before following an internal link. */
function bindLinks(cover, panel, reduced, state) {
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
      // while the sheet comes down. Without this, a second click starts a second
      // sweep on the same panel and the two race to set `location.href`.
      if (state.navigating) return;
      state.navigating = true;

      // Reduced motion still gets the navigation, just not the cover between
      // here and there.
      if (reduced) {
        window.location.href = link.href;
        return;
      }

      // The same rule at the leaving end: nothing should slide about under the
      // sheet while it comes down. The page we are going to locks itself from
      // its own head, and a bfcache return here is released by `pageshow` above.
      stopScroll();

      // Turn the hem over for the way down and park the sheet above the fold.
      // Both are instant — `.is-covering` alone carries no transition — and safe
      // to do in one go because the sheet is off-screen at this instant.
      cover.classList.remove('is-idle');
      cover.classList.add('is-covering');

      // A frame between parking it and sending it down, so the browser has two
      // distinct transforms to interpolate between. Set both in the same frame
      // and there is nothing to transition from: the sheet simply appears.
      afterPaint(() => {
        cover.classList.add('is-down');
        whenSettled(panel, () => {
          window.location.href = link.href;
        });
      });
    });
  });
}
