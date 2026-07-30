/**
 * Publishes a `--vh` custom property equal to 1% of the real inner height.
 *
 * Mobile browsers report 100vh as the height *without* their collapsible
 * chrome, so a 100vh hero jumps by ~60px the first time you scroll. Anything
 * that needs a true full-screen box uses `calc(var(--vh) * 100)` instead.
 */

let lastHeight = 0;

function setViewportHeight() {
  const h = window.innerHeight;
  // Ignore the small oscillations that come from the URL bar sliding, and only
  // touch the DOM when the value has meaningfully moved.
  if (Math.abs(h - lastHeight) < 2) return;
  lastHeight = h;
  document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
}

export function initViewportHeight() {
  setViewportHeight();
  window.addEventListener('resize', setViewportHeight, { passive: true });
  window.addEventListener('orientationchange', () => {
    // Orientation change reports the pre-rotation height for a frame or two.
    setTimeout(setViewportHeight, 120);
  });
}
