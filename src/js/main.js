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
 *   5. The hero sphere is only built once the preloader has handed over —
 *      3,500 springs competing with the intro timeline costs frames on the one
 *      animation a visitor is guaranteed to watch.
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
import { initLottieIcons } from './components/lottie-icons.js';
import { initAnchors } from './components/anchors.js';
import { initContactForm } from './components/contact-form.js';
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
 * Build the hero sphere on desktop only. Below 992px the canvas is display:none
 * and a still image stands in, so there is nothing to drive.
 */
function initHeroSphere() {
  const canvas = document.getElementById('nebula-canvas');
  if (!canvas) return;

  const shouldRun = !isTabletDown() && !prefersReducedMotion();

  if (shouldRun && !heroSphere) {
    // Ice blue rather than the brand blue the sphere carried over the old white
    // hero — brand blue on the glass sheet is barely a step off its own
    // background, and the field disappears into it.
    heroSphere = new NebulaSphere(canvas, { color: '214,232,255' });
  } else if (!shouldRun && heroSphere) {
    heroSphere.destroy();
    heroSphere = null;
  }
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

  // The scene has been sitting on a finished first frame. Hand it the ticker.
  heroGlass?.start();

  initHeroSphere();
  initReveals();
  initMarquees();
  initLottieIcons();

  // Crossing the 992px boundary either needs the sphere or needs it gone.
  onResize(initHeroSphere, 250);

  // Layout has settled and the intro is done — recompute every trigger.
  ScrollTrigger.refresh();
}

function boot() {
  initViewportHeight();

  // First, and ahead of the dynamic import that smooth scroll waits on: this
  // panel is covering the viewport from CSS, so every frame before it is lifted
  // is a frame of flat colour the visitor is sitting through.
  initPageTransition();

  // Next, and before the smooth-scroll import so the two chunks are in flight
  // together: this is the long pole in the page being *finished* rather than
  // merely shown, and the preloader is about to spend five seconds covering for
  // it. Every one of those milliseconds is free.
  heroGlassReady = initHeroGlass();

  // Static/idempotent wiring that does not depend on the intro.
  initNavMenu();
  initButtonBrackets();
  initAnchors();
  initContactForm();

  // Auto-update the copyright year wherever it is marked.
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = year;
  });

  // Smooth scroll first, then the scroll-linked nav flip.
  Promise.resolve(initSmoothScroll()).then(() => {
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
