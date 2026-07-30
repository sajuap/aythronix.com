/**
 * Single place where GSAP is configured and plugins are registered.
 *
 * Everything else imports `gsap` / `ScrollTrigger` from here, so plugin
 * registration cannot be accidentally skipped by import order.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText, CustomEase);

// Never let GSAP silently drop frames into a single huge jump — with a
// scroll-linked timeline that reads as a stutter.
gsap.ticker.lagSmoothing(0);

gsap.config({
  // Cuts a `will-change`/3d-transform hint from every tween; we opt in per
  // element in the stylesheet instead.
  force3D: true,
  nullTargetWarn: false,
});

// ---------------------------------------------------------------------------
// Named eases
//
// The reference's interaction engine exposes a fixed set of easing curves. These
// are the exact cubic-beziers behind the ones it uses, so a duration lifted from
// the reference lands on the same curve here.
// ---------------------------------------------------------------------------

/** The engine's "ease" — its default, equivalent to CSS `ease`. */
CustomEase.create('wfEase', '0.25, 0.1, 0.25, 1');

/** The engine's "outCirc" — used for the logo pop and the hero copy entrance. */
CustomEase.create('wfOutCirc', '0.075, 0.82, 0.165, 1');

/** The engine's "inOutQuint", used by the page-transition panel. */
CustomEase.create('wfInOutQuint', '0.86, 0, 0.07, 1');

export { gsap, ScrollTrigger, ScrollToPlugin, SplitText, CustomEase };
