/**
 * Pin a section and deal the rest of the page over it.
 *
 * Scrolling past a pinned section squeezes it down into a rounded card and
 * darkens it, while the sheet after it rises and covers it. The section does not
 * move: it is `position: sticky` in the stylesheet, and stays put behind the page
 * for the rest of the scroll. All this adds is the squeeze — and the one number
 * the stylesheet cannot work out for itself.
 *
 * **The range** is exactly one viewport and it is measured off the *cover*, not
 * off the pinned section. A sticky element's box stops describing where it is in
 * the document the moment it pins, so asking ScrollTrigger about it would be
 * asking the one element on the page that has stopped telling the truth. The
 * cover is in normal flow and its top edge crossing the viewport *is* the
 * animation, so it is the honest trigger for it.
 *
 * **The offset** is the part CSS cannot do. `top: 0` is right only while the
 * section fits on screen. The about page's studio band is 1008px against a 900px
 * viewport, and pinned to the top its foot — where the copy and the CTA sit — is
 * cut off below the fold. Pinned to the bottom instead, the part that gets lost
 * is the top of a decorative wordmark, which is the right thing to lose. So the
 * offset is measured: zero when the section fits, and negative by the shortfall
 * when it does not, which bottom-aligns it. Re-measured on every refresh, because
 * both of those heights are a resize away from changing.
 */

import { gsap, ScrollTrigger } from '../core/gsap.js';
import { prefersReducedMotion } from '../utils/env.js';

/**
 * How far a pinned section gives way.
 *
 * Small on purpose. The effect is the page arriving over something still there,
 * not the section performing an exit — much past this and the corners pull far
 * enough off the frame to read as a second, smaller page rather than as depth.
 */
const SQUEEZE = {
  scale: 0.92,
  radius: '1.75rem',
  veil: 0.55,
};

/**
 * A little scrub lag. Lenis is already smoothing the scroll itself, so this is
 * only enough to take the edge off a fast wheel — past about half a second the
 * cover starts to feel detached from the hand doing the scrolling.
 */
const SCRUB = 0.3;

/**
 * @param {object}      config
 * @param {Element}     config.pin     the sticky section
 * @param {Element}     config.target  what actually scales — sometimes the
 *                                     section, sometimes a child of it
 * @param {Element}     config.cover   the sheet that rises over it
 * @param {object}     [config.squeeze]
 * @param {Function}   [config.onCovered]
 * @param {Function}   [config.onRevealed]
 */
function pinAndCover({ pin, target, cover, squeeze = SQUEEZE, onCovered, onRevealed }) {
  if (!pin || !target || !cover) return;

  // Zero while the section fits the viewport, negative by the shortfall when it
  // does not — see the note at the top.
  const fit = () => {
    const spare = window.innerHeight - pin.offsetHeight;
    pin.style.setProperty('--pin-top', `${Math.min(0, Math.round(spare))}px`);
  };

  fit();
  ScrollTrigger.addEventListener('refreshInit', fit);

  // Reduced motion keeps the layout — the page still covers the section, because
  // that is stacking rather than movement — and loses the squeeze.
  if (!prefersReducedMotion()) {
    gsap.to(target, {
      scale: squeeze.scale,
      borderRadius: squeeze.radius,
      '--pin-veil': squeeze.veil,
      ease: 'none',
      scrollTrigger: {
        trigger: cover,
        /**
         * The cover's top edge entering the viewport, to that same edge reaching
         * the top of it — clamped, and the clamp is load-bearing.
         *
         * Unclamped this is one viewport of scroll, which is right only while the
         * pinned section is at least a viewport tall. The inner pages' banner is
         * 22rem, so its cover already starts well above the viewport's bottom
         * edge: "top bottom" resolves to a scroll position of about -500, which
         * cannot be reached, and the banner would therefore arrive already
         * half-squeezed at the top of the page. Clamped, the range simply starts
         * at zero and the squeeze runs over the distance the cover actually has
         * to travel.
         */
        start: 'clamp(top bottom)',
        end: 'clamp(top top)',
        scrub: SCRUB,
        invalidateOnRefresh: true,
      },
    });
  }

  // Covered: the cover's top edge is at the viewport's top, so there is nothing
  // of the section left to see.
  if (onCovered || onRevealed) {
    ScrollTrigger.create({
      trigger: cover,
      start: 'top top',
      onEnter: () => onCovered?.(),
      onLeaveBack: () => onRevealed?.(),
    });
  }
}

/**
 * The home page's hero.
 *
 * The callbacks are the part nobody sees. A pinned hero never leaves the
 * viewport, so the IntersectionObserver inside each of its two Three.js scenes
 * reports "visible" for the length of the page and both keep drawing — the most
 * expensive work on the site, running flat out behind an opaque sheet, for every
 * screen after the first.
 */
export function initHeroStack({ onCovered, onRevealed } = {}) {
  const pin = document.querySelector('.hero-section.is-pinned');
  if (!pin) return;

  pinAndCover({
    pin,
    // The inner rather than the section: the section is the sticky box, and
    // the hero's ground is painted on the child.
    target: pin.querySelector('.hero-section_background-image'),
    cover: document.querySelector('.page-stack'),
    onCovered,
    onRevealed,
  });
}

/**
 * The about page's studio band.
 *
 * The section itself is what scales here, because the band's picture and its
 * wordmark both break out to the full viewport width — scaling anything inside
 * would leave those two behind, and clipping them back to the column is the one
 * thing the composition cannot survive.
 */
export function initStudioStack() {
  const pin = document.querySelector('.studio-band.is-pinned');
  if (!pin) return;

  pinAndCover({
    pin,
    target: pin,
    cover: pin.nextElementSibling,
    // Lighter than the hero's. That one is navy to begin with and can take a
    // heavy shadow; this is a daylight photograph, and past about a third it
    // stops reading as receding and starts reading as switched off.
    squeeze: { ...SQUEEZE, veil: 0.34 },
  });
}

/**
 * The inner pages' banner.
 *
 * The same device again, and the section itself is what scales — the banner is a
 * single full-bleed box with its own ground, so there is nothing inside it worth
 * singling out.
 *
 * This is the one that is shorter than the viewport, which is what the clamp on
 * the trigger range is there for.
 */
export function initPageHeroStack() {
  const pin = document.querySelector('.page-hero.is-pinned');
  if (!pin) return;

  pinAndCover({
    pin,
    target: pin,
    cover: pin.nextElementSibling,
  });
}
