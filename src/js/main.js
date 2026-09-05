/**
 * Aythronix — application entry point.
 *
 * Boot order matters:
 *   1. `--vh` is published before anything measures a full-viewport box.
 *   2. Smooth scroll comes up before ScrollTrigger-backed animations, so
 *      triggers register against the proxied scroller rather than the document.
 *   3. The preloader locks scroll immediately and releases it on completion.
 *   4. The hero's WebGL backdrop is *built* as early as possible and *started*
 *      as late as possible. Bringing it up is expensive and slow; running it is
 *      expensive and fast. So the build goes behind the preloader, where the
 *      cost is invisible, and the ticker waits for the panel to leave, where it
 *      would otherwise be stealing frames from the intro. The preloader holds
 *      its exit until the backdrop reports a real frame.
 *   5. The hero sphere follows the same rule, for the same reason. It used to be
 *      *built* at the hand-over rather than merely started there, which put
 *      3,500 particles and their springs on the one frame the panel lifts on —
 *      so the hero stalled at exactly the moment a visitor started watching it.
 *      Now it is built behind the panel and held, like the backdrop.
 *   6. Everything the hand-over does beyond those two runs one step per frame
 *      (`runAcrossFrames`), so the browser can paint between the pieces instead
 *      of freezing through one long task. None of it is above the fold.
 */

import '../scss/main.scss';

import { gsap, ScrollTrigger } from './core/gsap.js';
import { initSmoothScroll } from './core/smooth-scroll.js';
import { initViewportHeight } from './utils/viewport.js';
import { isTabletDown, onResize, prefersReducedMotion } from './utils/env.js';

import { initPreloader } from './components/preloader.js';
import { initPageTransition } from './components/page-transition.js';
import { initNavMenu, initNavScroll } from './animations/nav.js';
import { initMarquees } from './animations/marquee.js';
import { initButtonBrackets } from './animations/button-brackets.js';
import { initReveals } from './animations/reveals.js';
import { initCardStack } from './animations/card-stack.js';
import { initHeroStack, initPageHeroStack, initStudioStack } from './animations/hero-stack.js';
import { initLottieIcons } from './components/lottie-icons.js';
import { initWorkRail } from './components/work-rail.js';
import { initSectorList } from './components/sector-list.js';
import { initFaq } from './components/faq.js';
import { initBlogPost } from './components/blog-post.js';
import { initImageTrail } from './components/image-trail.js';
import { initAnchors } from './components/anchors.js';
import { initContactForm } from './components/contact-form.js';
import { initBlogFilters } from './components/blog-filters.js';
import NebulaSphere from './three/nebula-sphere.js';

// Belt and braces. The class is really cleared by a parser-blocking inline
// script in each page's <head>, because this module is deferred and anything it
// does lands after the first paint — which is a window where the stylesheet has
// the preloader hidden and the raw page on screen. Left here so the module is
// still correct on its own if it is ever loaded outside those pages.
document.documentElement.classList.remove('no-js');

let heroSphere = null;
let heroGlass = null;
let heroGlassReady = null;

/**
 * True once the preloader has handed over. The glass is built ahead of that
 * moment and deliberately held, so whichever of the two lands second is the one
 * that has to let it run.
 */
let revealed = false;

/**
 * Build the hero sphere.
 *
 * It used to be desktop-only — below 992px the canvas was `display: none` and a
 * still stood in, so the hero was motionless on every phone and tablet. The cost
 * was never really the width: this is a 2D context drawing arcs, and what it
 * costs is points times pixels. So both come down on a small screen instead of
 * the whole thing being switched off. Reduced motion is still the one case where
 * nothing is built and the still is the sphere.
 *
 * Called twice over: once from `boot`, where `revealed` is still false and the
 * field is therefore built but held, and again on every resize across the 992px
 * boundary, where it is past the reveal and starts on its own.
 */
function initHeroSphere() {
  const canvas = document.getElementById('nebula-canvas');
  if (!canvas) return;

  const shouldRun = !prefersReducedMotion();
  const small = isTabletDown();

  // Rebuilt rather than reconfigured when the boundary is crossed: the point
  // count is baked into the field at construction.
  if (heroSphere && heroSphere.isSmall !== small) {
    heroSphere.destroy();
    heroSphere = null;
  }

  if (shouldRun && !heroSphere) {
    // Ice blue rather than the brand blue the sphere carried over the old white
    // hero — brand blue on the glass sheet is barely a step off its own
    // background, and the field disappears into it.
    heroSphere = new NebulaSphere(canvas, {
      color: '214,232,255',
      // Running from the moment it is built, behind the panel, rather than held
      // until the hand-over. It is the cheap half of the hero — a 2D context
      // drawing twelve batched paths a frame — so there is nothing to save by
      // holding it, and holding it was what the visitor was seeing: a field that
      // had been standing still since boot, moving off the instant the panel
      // lifted. Turning under the panel, it is simply already in motion when the
      // hero arrives. The glass is still held; that one is worth holding.
      autoStart: true,
      // Under 992px: two fifths of the points, and a pixel ratio that stops a
      // 3x phone drawing nine times the fill for a field of soft dots.
      particleCount: small ? 1400 : 3500,
      // The canvas is the full viewport now, so every step of pixel ratio is a
      // much bigger backing store to clear and fill than when it was the width
      // of the column. 1.5 is as far as a field of two-pixel dots can tell.
      maxDpr: small ? 1.25 : 1.5,
      // On a phone the arc is allowed to run off both sides. Held inside the
      // width it is a small dome sitting in a tall gap with air all around it;
      // overrun, it reads as an arc crossing the screen with its ends off-frame,
      // which is the same shape a wide screen gets.
      arcWidth: small ? 1.45 : 0.95,
      // And its dots get a lift to go with it. They are a share of a sphere that
      // is small on a phone whatever else is done, and they are the whole of
      // what the field is.
      dotScale: small ? 1.5 : 1,
    });
    heroSphere.isSmall = small;
  } else if (!shouldRun && heroSphere) {
    heroSphere.destroy();
    heroSphere = null;
  }
}

/**
 * Run each step on its own animation frame.
 *
 * Everything the reveal hands over to used to run in one synchronous block
 * inside the preloader's `onComplete`: 3,500 particles built for the hero sphere
 * and 1,400 more for the orb, SplitText across every heading on the page, the
 * Lottie player, and a full `ScrollTrigger.refresh()`. That is a single long task
 * landing on the exact frame the panel lifts, and it is what makes the hero stall
 * for a moment just as the visitor starts watching it.
 *
 * Same total work, but the browser gets to paint between the pieces, so the glass
 * and the sphere keep animating through it instead of freezing. None of these
 * steps is above the fold — the first `[data-reveal]` on the home page is in the
 * value-prop section — so nothing visible waits on them.
 */
function runAcrossFrames(steps) {
  let i = 0;
  const step = () => {
    if (i >= steps.length) return;
    steps[i++]();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * The hero's glass backdrop — a Three.js scene, so it is loaded on demand rather
 * than bundled into main. Three is by far the heaviest thing on the site and only
 * the home page has a hero, so the legal pages never download it.
 *
 * Started from `boot`, not from the reveal. Everything it takes to bring this
 * scene up — fetching the chunk, prefiltering the environment, building the
 * normal map, linking the shaders and drawing once — is most of a second on a
 * mid-range machine, and run after the panel had gone it was a second of the
 * hero's CSS gradient sitting in full view before the real backdrop replaced it.
 * Run now, all of it happens behind the preloader.
 *
 * @returns a promise that settles when there is a frame on screen, which is what
 *   the preloader holds its exit on.
 */
function initHeroGlass() {
  const canvas = document.querySelector('.hero_glass-canvas');
  if (!canvas || heroGlass) return Promise.resolve(false);

  return import('./three/glass-slabs.js')
    .then(({ default: GlassSlabs }) => {
      // Held: warmed up behind the panel, but not given the ticker until the
      // panel has gone, so it never competes with the intro for frames.
      heroGlass = new GlassSlabs(canvas, { autoStart: false });

      // The reveal can beat the chunk here — reduced motion skips the preloader
      // outright, and a warm cache can finish it before a slow network lands
      // this module. Nothing else would lift the hold in that case.
      if (revealed) heroGlass.start();

      return heroGlass.ready;
    })
    .catch(() => false); // CSS backdrop stands in.
}

function initAfterReveal() {
  revealed = true;

  // The intro is over. Anything that should only animate once the visitor can
  // actually see it keys off this — the hero backdrop's crossfade in
  // scss/sections/_hero.scss is the one that matters, since under the panel it
  // was a fade nobody could see turning into a fade everybody could.
  document.documentElement.classList.add('is-loaded');

  // The glass was built behind the panel and has been sitting on a finished
  // first frame, so this is only the ticker being handed over — the frame the
  // panel lifts on stays cheap. The sphere has been turning since it was built
  // and needs nothing here; the call is kept because it is idempotent and this
  // is the one place that would have to remember, if it were ever held again.
  heroGlass?.start();
  heroSphere?.start();

  // Everything else is below the fold, so it can arrive over the next few frames
  // rather than all on this one. Order matters at the end: the refresh has to
  // come after the reveals and marquees have registered their triggers.
  runAcrossFrames([
    initReveals,
    initMarquees,
    initCardStack,
    initLottieIcons,
    initWorkRail,
    initSectorList,
    initImageTrail,
    // The pinned hero never leaves the viewport, so both Three.js scenes would
    // otherwise keep drawing behind an opaque sheet for every screen after the
    // first. These two callbacks are what stop that — see the note at the top of
    // animations/hero-stack.js.
    () => {
      initHeroStack({
        onCovered: () => {
          heroGlass?.stop();
          heroSphere?.stop();
        },
        onRevealed: () => {
          heroGlass?.start();
          heroSphere?.start();
        },
      });

      // The about page's studio band, same device. Nothing to pause behind this
      // one — it is a photograph, not a running scene.
      initStudioStack();
      initPageHeroStack();
    },
    () => {
      // Crossing the 992px boundary either needs the sphere or needs it gone.
      onResize(initHeroSphere, 250);

      // Layout has settled and the intro is done — recompute every trigger.
      ScrollTrigger.refresh();
    },
  ]);
}

function boot() {
  initViewportHeight();

  // Before the page transition, and that ordering is load-bearing: this writes
  // the "keep reading" cards into the article page, and the transition binds its
  // cover to the links that exist when it runs. The other way round and those
  // three cards would be the only links on the site that navigate bare.
  initBlogPost();

  // First, and ahead of the dynamic import that smooth scroll waits on: this
  // panel is covering the viewport from CSS, so every frame before it is lifted
  // is a frame of flat colour the visitor is sitting through.
  initPageTransition();

  // Next, and before the smooth-scroll import so the two chunks are in flight
  // together: this is the long pole in the page being *finished* rather than
  // merely shown, and the preloader is about to spend five seconds covering for
  // it. Every one of those milliseconds is free.
  heroGlassReady = initHeroGlass();

  // Built here rather than at the reveal, for the same reason: distributing 3,500
  // points over a sphere and allocating a spring for each is work the visitor
  // should not be able to see, and behind the panel it is invisible. `revealed`
  // is still false, so it is held — the loop does not start until the panel has
  // gone, which is the part of the old ordering that was actually load-bearing.
  initHeroSphere();

  // Static/idempotent wiring that does not depend on the intro.
  initNavMenu();
  initButtonBrackets();
  // Here rather than in the post-reveal batch: this one *collapses* the FAQ
  // panels, which are written open so a failed module still leaves them
  // readable. A frame or two of six open answers is not something anyone should
  // see, and at DOMContentLoaded nobody can.
  initFaq();
  initAnchors();
  initContactForm();
  initBlogFilters();

  // Auto-update the copyright year wherever it is marked.
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = year;
  });

  // Smooth scroll first, then the scroll-linked nav flip.
  //
  // The catch is load-bearing now that index.html locks scrolling from its head:
  // the only thing that unlocks it is the preloader finishing, and the preloader
  // is downstream of this promise. Let a failed Lenis chunk reject and the
  // visitor is left on a page they cannot scroll. Smooth scrolling is an
  // enhancement; being able to scroll at all is not.
  Promise.resolve(initSmoothScroll())
    .catch(() => null)
    .then(() => {
      initNavScroll();
      initPreloader({ waitFor: heroGlassReady, onComplete: initAfterReveal });
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// Expose a little for debugging without leaking the whole module graph.
if (import.meta.env.DEV) {
  window.__aythronix = {
    gsap,
    ScrollTrigger,
    get sphere() { return heroSphere; },
    get glass() { return heroGlass; },
  };
}



// --- Contact form submission ---
document.querySelectorAll('[data-contact-form]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wrapper = form.closest('.form-wrapper');
    const doneEl = wrapper.querySelector('[data-form-done]');
    const failEl = wrapper.querySelector('[data-form-fail]');
    const submitBtn = form.querySelector('.form-submit');
    submitBtn.disabled = true;
    const originalVal = submitBtn.value;
    submitBtn.value = submitBtn.dataset.wait || 'Please wait...';
    failEl.hidden = true;
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') throw new Error('Send failed');
      form.hidden = true;
      doneEl.hidden = false;
    } catch (err) {
      failEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.value = originalVal;
    }
  });
});