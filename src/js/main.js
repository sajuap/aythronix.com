/**
 * Botronics — application entry point.
 *
 * Boot order matters:
 *   1. `--vh` is published before anything measures a full-viewport box.
 *   2. Smooth scroll comes up before ScrollTrigger-backed animations, so
 *      triggers register against the proxied scroller rather than the document.
 *   3. The preloader locks scroll immediately and releases it on completion.
 *   4. The hero sphere is only built once the preloader has handed over —
 *      3,500 springs competing with the intro timeline costs frames on the one
 *      animation a visitor is guaranteed to watch.
 */

import '../scss/main.scss';

import { gsap, ScrollTrigger } from './core/gsap.js';
import { initSmoothScroll } from './core/smooth-scroll.js';
import { initViewportHeight } from './utils/viewport.js';
import { isTabletDown, onResize, prefersReducedMotion } from './utils/env.js';

import { initPreloader } from './components/preloader.js';
import { initNavMenu, initNavScroll } from './animations/nav.js';
import { initMarquees } from './animations/marquee.js';
import { initButtonBrackets } from './animations/button-brackets.js';
import { initReveals } from './animations/reveals.js';
import { initTeamToggle } from './components/team-toggle.js';
import { initLottieIcons } from './components/lottie-icons.js';
import { initAnchors } from './components/anchors.js';
import { initContactForm } from './components/contact-form.js';
import NebulaSphere from './three/nebula-sphere.js';

// Tell the stylesheet JS is live, so the preload-hidden states are safe to apply.
document.documentElement.classList.remove('no-js');

let heroSphere = null;

/**
 * Build the hero sphere on desktop only. Below 992px the canvas is display:none
 * and a still image stands in, so there is nothing to drive.
 */
function initHeroSphere() {
  const canvas = document.getElementById('nebula-canvas');
  if (!canvas) return;

  const shouldRun = !isTabletDown() && !prefersReducedMotion();

  if (shouldRun && !heroSphere) {
    heroSphere = new NebulaSphere(canvas);
  } else if (!shouldRun && heroSphere) {
    heroSphere.destroy();
    heroSphere = null;
  }
}

function initAfterReveal() {
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

  // Static/idempotent wiring that does not depend on the intro.
  initNavMenu();
  initButtonBrackets();
  initTeamToggle();
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
    initPreloader({ onComplete: initAfterReveal });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// Expose a little for debugging without leaking the whole module graph.
if (import.meta.env.DEV) {
  window.__botronics = { gsap, ScrollTrigger, get sphere() { return heroSphere; } };
}
