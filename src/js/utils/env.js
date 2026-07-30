/**
 * Environment probes.
 *
 * The breakpoints here are the same numbers the stylesheet uses. They are
 * evaluated on call rather than cached, so a resize past a boundary is picked
 * up by whatever asks next.
 */

export const BP = {
  mobilePortrait: 479,
  mobileLandscape: 767,
  tablet: 991,
  wide: 1440,
  xwide: 1920,
};

/** True at 767px and under — where scroll-driven motion is switched off. */
export const isMobile = () => window.innerWidth <= BP.mobileLandscape;

/** True at 991px and under — where the canvas sphere is dropped for a still. */
export const isTabletDown = () => window.innerWidth <= BP.tablet;

/** True from 992px up — the full desktop experience. */
export const isDesktop = () => window.innerWidth > BP.tablet;

/** Honour the OS-level "reduce motion" setting. */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Coarse pointer — no hover states worth wiring up. */
export const isTouch = () =>
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/**
 * Fire `fn` on resize, but only after the viewport has been still for `wait`ms
 * and only when a dimension actually changed. iOS fires resize when the URL bar
 * collapses, which would otherwise rebuild every timeline mid-scroll.
 */
export function onResize(fn, wait = 200) {
  let timer;
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;

  const handler = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    clearTimeout(timer);
    timer = setTimeout(fn, wait);
  };

  window.addEventListener('resize', handler, { passive: true });
  return () => window.removeEventListener('resize', handler);
}
