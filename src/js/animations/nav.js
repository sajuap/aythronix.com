/**
 * Header behaviour.
 *
 * Colour flip: the reference scrubs this against the first 1% of page scroll —
 * transparent at 0, solid white with a 10%-black hairline by 1%. That is fast
 * enough to read as instant but it is a real interpolation, not a class swap,
 * so a short flick of the wheel gives a partial value.
 *
 * Menu: below 992px the links collapse behind a button. Scroll is locked while
 * it is open, Escape closes it, and any link tap closes it before scrolling.
 */

import { gsap, ScrollTrigger } from '../core/gsap.js';
import { stopScroll, startScroll } from '../core/smooth-scroll.js';
import { isTabletDown, onResize } from '../utils/env.js';

export function initNavScroll() {
  const nav = document.querySelector('.nav_component');
  if (!nav) return;

  gsap.fromTo(
    nav,
    {
      backgroundColor: 'rgba(255,255,255,0)',
      borderBottomColor: 'rgba(0,0,0,0)',
    },
    {
      backgroundColor: 'rgba(255,255,255,1)',
      borderBottomColor: 'rgba(0,0,0,0.1)',
      ease: 'none',
      immediateRender: false,
      scrollTrigger: {
        start: 0,
        // 1% of the total scrollable distance.
        end: () => Math.max(1, ScrollTrigger.maxScroll(window) * 0.01),
        scrub: true,
        invalidateOnRefresh: true,
      },
    }
  );
}

export function initNavMenu() {
  const nav = document.querySelector('.nav_component');
  const button = document.querySelector('.menu-button');
  const menu = document.querySelector('.nav-menu');
  if (!nav || !button || !menu) return;

  let open = false;

  const setOpen = (next) => {
    if (open === next) return;
    open = next;

    nav.classList.toggle('is-menu-open', open);
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));

    if (open) {
      stopScroll();
      gsap.fromTo(
        menu,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: 'wfEase' }
      );
    } else {
      startScroll();
      gsap.set(menu, { opacity: 1 });
    }
  };

  button.addEventListener('click', () => setOpen(!open));

  // Any nav link closes the menu first — otherwise the anchor scroll happens
  // behind a locked page.
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  // Crossing back above 992px leaves the menu open and scroll locked otherwise.
  onResize(() => {
    if (!isTabletDown() && open) setOpen(false);
  });
}
