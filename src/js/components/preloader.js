/**
 * Preloader.
 *
 * The choreography is taken from the reference loader's page-load interaction,
 * beat for beat. Both of its variants are reproduced — the values in TIMELINE
 * below are the reference's own durations, delays and easings, converted from
 * milliseconds to seconds.
 *
 *   desktop (>=992px)                    mobile (<=991px)
 *   ───────────────────────────────      ───────────────────────────────
 *   0.00  progress 0→100, 4.50s          0.00  progress 0→100, 6.00s
 *   2.60  backdrop fade in,   0.50s      2.50  backdrop fade in,   0.50s
 *   2.60  logo 0.8→1, 0.40s, outCirc     2.50  logo 0.8→1, 0.40s, outCirc
 *   4.00  logo fade out,      0.40s      3.50  logo fade out,      0.50s
 *   4.40  panel y→-100vh,     1.00s      4.20  panel y→-100vh,     1.00s
 *   5.00  hero copy y→0,      0.50s
 *   5.00  hero copy fade in,  0.20s
 *   5.10  nav fade in,        0.50s
 *
 * The panel leaves at 4.4s while the progress tween still has 0.1s to run —
 * that overlap is intentional in the original and is what stops the exit
 * feeling like it waits for the counter.
 *
 * Trigger: the reference fires this on its framework's "page finished" event,
 * which lands at roughly `window.load`. We use `load` with a hard cap so a slow
 * asset can never strand a visitor behind a white panel.
 */

import { gsap } from '../core/gsap.js';
import { stopScroll, startScroll } from '../core/smooth-scroll.js';
import { isTabletDown, prefersReducedMotion } from '../utils/env.js';
import NebulaSphere from '../three/nebula-sphere.js';

const TIMELINE = {
  desktop: {
    progressDuration: 4.5,
    backdropAt: 2.6,
    backdropDuration: 0.5,
    logoScaleAt: 2.6,
    logoScaleDuration: 0.4,
    logoFadeAt: 4.0,
    logoFadeDuration: 0.4,
    exitAt: 4.4,
    exitDuration: 1.0,
    heroAt: 5.0,
    heroMoveDuration: 0.5,
    heroFadeDuration: 0.2,
    navAt: 5.1,
    navDuration: 0.5,
  },
  mobile: {
    progressDuration: 6.0,
    backdropAt: 2.5,
    backdropDuration: 0.5,
    logoScaleAt: 2.5,
    logoScaleDuration: 0.4,
    logoFadeAt: 3.5,
    logoFadeDuration: 0.5,
    exitAt: 4.2,
    exitDuration: 1.0,
    // The mobile variant has no separate hero/nav beats; they ride just behind
    // the panel so the page is never left blank.
    heroAt: 4.8,
    heroMoveDuration: 0.5,
    heroFadeDuration: 0.2,
    navAt: 4.9,
    navDuration: 0.5,
  },
};

/** Longest we will wait on `window.load` before starting anyway. */
const LOAD_TIMEOUT = 3000;

function waitForLoad() {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    window.addEventListener('load', finish, { once: true });
    setTimeout(finish, LOAD_TIMEOUT);
  });
}

export function initPreloader({ onComplete } = {}) {
  const panel = document.querySelector('.preloader');

  // No panel in the markup (or JS-disabled styling already took over): just
  // make sure nothing is left hidden.
  if (!panel) {
    revealImmediately();
    onComplete?.();
    return Promise.resolve();
  }

  const layer2 = panel.querySelector('.preloader_layer-2');
  const logo = panel.querySelector('.preloader_logo');
  const canvas = panel.querySelector('.preloader_canvas');
  const bar = panel.querySelector('.preloader_progress-bar');
  const count = panel.querySelector('.preloader_count');

  const nav = document.querySelector('.nav_component');
  const heroCopy = document.querySelector('[data-hero-copy]');

  // Someone who asked for reduced motion gets the page, not the show.
  if (prefersReducedMotion()) {
    panel.classList.add('is-done');
    revealImmediately();
    onComplete?.();
    return Promise.resolve();
  }

  const t = isTabletDown() ? TIMELINE.mobile : TIMELINE.desktop;

  // A second, centred particle field: the same visual language as the hero,
  // assembling from scattered to sphere as the counter climbs.
  let sphere = null;
  if (canvas && !isTabletDown()) {
    sphere = new NebulaSphere(canvas, {
      particleCount: 2200,
      baseRadius: 320,
      anchor: 'center',
      disableInteractions: true,
      gather: 0,
    });
  }

  stopScroll();

  // --- Initial state (the reference's "first group as initial state") -------
  gsap.set(panel, { yPercent: 0, display: 'flex' });
  gsap.set(layer2, { opacity: 0 });
  gsap.set(logo, { scale: 0.8, opacity: 1 });
  if (bar) gsap.set(bar, { scaleX: 0 });
  if (nav) gsap.set(nav, { opacity: 0 });
  if (heroCopy) gsap.set(heroCopy, { y: '4rem', opacity: 0 });

  // Hand the hidden elements back to CSS now that GSAP holds their state.
  document
    .querySelectorAll('.is-preload-hidden')
    .forEach((el) => el.classList.remove('is-preload-hidden'));

  return waitForLoad().then(
    () =>
      new Promise((resolve) => {
        const progress = { value: 0 };

        const tl = gsap.timeline({
          onComplete: () => {
            panel.classList.add('is-done');
            sphere?.destroy();
            startScroll();
            onComplete?.();
            resolve();
          },
        });

        // 0.00 — progress climbs. Drives the bar, the readout and the assembly.
        tl.to(
          progress,
          {
            value: 100,
            duration: t.progressDuration,
            ease: 'none',
            onUpdate: () => {
              const v = progress.value;
              if (bar) bar.style.transform = `scaleX(${v / 100})`;
              if (count) count.textContent = String(Math.round(v)).padStart(3, '0');
              sphere?.setGather(v / 100);
            },
          },
          0
        );

        // 2.60 — the backdrop layer behind the mark fades up.
        tl.to(
          layer2,
          { opacity: 1, duration: t.backdropDuration, ease: 'none' },
          t.backdropAt
        );

        // 2.60 — the mark settles to full size.
        tl.to(
          logo,
          { scale: 1, duration: t.logoScaleDuration, ease: 'wfOutCirc' },
          t.logoScaleAt
        );

        // 4.00 — the mark fades out ahead of the panel leaving.
        tl.to(
          logo,
          { opacity: 0, duration: t.logoFadeDuration, ease: 'none' },
          t.logoFadeAt
        );

        // 4.40 — the panel lifts clear of the viewport.
        tl.to(
          panel,
          { yPercent: -100, duration: t.exitDuration, ease: 'wfEase' },
          t.exitAt
        );

        // 5.00 — the hero copy rises into place behind it.
        if (heroCopy) {
          tl.to(
            heroCopy,
            { y: '0rem', duration: t.heroMoveDuration, ease: 'wfOutCirc' },
            t.heroAt
          );
          tl.to(
            heroCopy,
            { opacity: 1, duration: t.heroFadeDuration, ease: 'none' },
            t.heroAt
          );
        }

        // 5.10 — the header arrives last.
        if (nav) {
          tl.to(nav, { opacity: 1, duration: t.navDuration, ease: 'none' }, t.navAt);
        }
      })
  );
}

/** Drop every preload-hidden state without animating. */
function revealImmediately() {
  document.querySelectorAll('.is-preload-hidden').forEach((el) => {
    el.classList.remove('is-preload-hidden');
    el.style.opacity = '';
  });
  const nav = document.querySelector('.nav_component');
  const heroCopy = document.querySelector('[data-hero-copy]');
  if (nav) gsap.set(nav, { opacity: 1 });
  if (heroCopy) gsap.set(heroCopy, { y: 0, opacity: 1 });
  startScroll();
}
