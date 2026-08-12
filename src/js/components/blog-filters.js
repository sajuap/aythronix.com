/**
 * Blog category filters.
 *
 * One mechanism, no special cases: every filterable thing on the page carries
 * `data-category`, every chip carries `data-filter`, and `all` matches
 * everything. The featured post is filtered on the same terms as the cards
 * below it — the chips sit directly above it in the layout, so a row of controls
 * that visibly skipped the nearest thing on the page would read as broken.
 *
 * State lives on `aria-pressed` rather than a class, and the stylesheet draws
 * from that attribute. One source of truth: what a screen reader is told and
 * what is on screen cannot drift apart.
 */

import { ScrollTrigger } from '../core/gsap.js';

export function initBlogFilters() {
  const chips = [...document.querySelectorAll('[data-filter]')];
  if (!chips.length) return;

  const items = [...document.querySelectorAll('[data-category]')];
  if (!items.length) return;

  const apply = (active) => {
    items.forEach((item) => {
      const match = active === 'all' || item.dataset.category === active;
      item.classList.toggle('is-filtered-out', !match);
    });

    chips.forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === active));
    });

    // Hiding cards changes the document height, which every trigger below this
    // point has already measured against. Without this the reveals further down
    // fire at the wrong scroll positions for the rest of the visit.
    ScrollTrigger.refresh();
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => apply(chip.dataset.filter));
  });
}
