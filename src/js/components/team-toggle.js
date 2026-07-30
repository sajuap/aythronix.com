/**
 * Team "Show more / Show less".
 *
 * The reference does this as four instant display swaps: reveal the second card
 * group, drop the white bottom fade over the first, and exchange the two
 * buttons. Same four state changes here, with a height animation added so the
 * page does not jump by six cards in one frame — and ScrollTrigger is refreshed
 * afterwards because the document just changed length.
 */

import { gsap, ScrollTrigger } from '../core/gsap.js';
import { prefersReducedMotion } from '../utils/env.js';

export function initTeamToggle() {
  const root = document.querySelector('[data-team-toggle]');
  if (!root) return;

  const second = document.querySelector('.team-section_cards-wrapper.is-second');
  const fade = document.querySelector('.is-absolute.is-blur-white-bottom');
  const showBtn = root.querySelector('.is-see');
  const hideBtn = root.querySelector('.is-hide');

  if (!second || !showBtn || !hideBtn) return;

  let expanded = false;
  let busy = false;

  const swapButtons = () => {
    showBtn.style.display = expanded ? 'none' : 'block';
    hideBtn.style.display = expanded ? 'block' : 'none';
    showBtn.setAttribute('aria-expanded', String(expanded));
    hideBtn.setAttribute('aria-expanded', String(expanded));
  };

  const expand = () => {
    expanded = true;
    swapButtons();
    if (fade) fade.style.display = 'none';

    second.style.display = 'block';

    if (prefersReducedMotion()) {
      ScrollTrigger.refresh();
      return;
    }

    busy = true;
    // Measure the natural height, then animate to it and release.
    gsap.set(second, { height: 'auto', overflow: 'hidden' });
    const target = second.offsetHeight;

    gsap.fromTo(
      second,
      { height: 0, opacity: 0 },
      {
        height: target,
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => {
          // Hand height back to the layout so later resizes behave.
          gsap.set(second, { height: 'auto', overflow: '' });
          busy = false;
          ScrollTrigger.refresh();
        },
      }
    );
  };

  const collapse = () => {
    expanded = false;
    swapButtons();

    const finish = () => {
      second.style.display = 'none';
      gsap.set(second, { height: 'auto', overflow: '', opacity: 1 });
      if (fade) fade.style.display = 'block';
      busy = false;
      ScrollTrigger.refresh();
    };

    if (prefersReducedMotion()) {
      finish();
      return;
    }

    busy = true;
    gsap.to(second, {
      height: 0,
      opacity: 0,
      duration: 0.45,
      ease: 'power2.inOut',
      onComplete: finish,
    });
  };

  showBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (busy) return;
    expand();
  });

  hideBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (busy) return;
    collapse();
  });

  swapButtons();
}
