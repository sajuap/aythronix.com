/**
 * Scroll reveals — line-masked text and element fade-ins.
 *
 * Ported from the reference loader site's animation layer, values unchanged:
 *
 *   text lines : SplitText by line, each line wrapped in an overflow-hidden
 *                block, inner span rises from translateY(100%) with
 *                opacity 0 → 1, duration 1s, power3.out, stagger 0.1s
 *   fade-ins   : y 40 → 0, opacity 0 → 1, duration 1s, circ.out
 *   rules      : scaleX/scaleY 0 → 1 from a given origin, 1s, power3.out
 *
 * Opt-in per element via markup, so a section can be left completely static:
 *
 *   data-reveal="text"   split into lines and staggered
 *   data-reveal="fade"   move-and-fade as one block
 *   data-reveal="line"   scale a hairline rule out from its origin
 *   data-reveal-delay    seconds to wait once triggered
 *   data-reveal-start    ScrollTrigger start, default "top 85%"
 *
 * Both kinds are skipped entirely at 767px and under and under reduced-motion,
 * where the elements are simply left visible — the same call the reference makes.
 */

import { gsap, ScrollTrigger, SplitText } from '../core/gsap.js';
import { isMobile, prefersReducedMotion } from '../utils/env.js';

/** Reveal everything with no animation. */
function showAll(elements) {
  elements.forEach((el) => {
    el.classList.remove('is-reveal-hidden');
    gsap.set(el, { clearProps: 'all' });
  });
}

/**
 * Wrap each split line in a clipping block so the inner span can rise from
 * fully below its own line box.
 */
function maskLines(split) {
  return split.lines.map((line) => {
    // SplitText writes `display: block` as an inline style on each line, which
    // outranks any stylesheet rule. It has to be `flow-root` instead: the
    // wrapper below carries negative block margins to cancel the padding that
    // buys clip room, and without a block formatting context per line those
    // margins collapse into the neighbouring line's — leaving a multi-line
    // heading 0.15em taller than the unsplit original and shifting the section
    // below it. Setting it here, next to the structure it applies to, avoids an
    // `!important` in the stylesheet.
    line.style.display = 'flow-root';

    const wrapper = document.createElement('span');
    wrapper.className = 'line-wrapper';

    const inner = document.createElement('span');
    inner.className = 'line-inner';
    inner.innerHTML = line.innerHTML;

    wrapper.appendChild(inner);
    line.innerHTML = '';
    line.appendChild(wrapper);

    return inner;
  });
}

function revealText(el) {
  // Fonts must be settled before splitting, or the line breaks are computed
  // against the fallback face and re-flow the moment the webfont lands.
  const split = new SplitText(el, { type: 'lines', linesClass: 'split-line' });
  const inners = maskLines(split);

  el.classList.remove('is-reveal-hidden');

  gsap.set(inners, { yPercent: 100, opacity: 0 });

  gsap.to(inners, {
    yPercent: 0,
    opacity: 1,
    duration: 1,
    ease: 'power3.out',
    stagger: 0.1,
    delay: parseFloat(el.dataset.revealDelay) || 0,
    scrollTrigger: {
      trigger: el,
      start: el.dataset.revealStart || 'top 85%',
      toggleActions: 'play none none none',
    },
  });
}

function revealFade(el) {
  el.classList.remove('is-reveal-hidden');

  gsap.fromTo(
    el,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'circ.out',
      delay: parseFloat(el.dataset.revealDelay) || 0,
      scrollTrigger: {
        trigger: el,
        start: el.dataset.revealStart || 'top 90%',
        toggleActions: 'play none none none',
      },
    }
  );
}

function revealLine(el) {
  el.classList.remove('is-reveal-hidden');

  // `data-reveal-axis="y"` for the vertical ticks; default is horizontal rules.
  const vertical = el.dataset.revealAxis === 'y';
  const origin = el.dataset.revealOrigin || (vertical ? 'top center' : 'left center');

  gsap.fromTo(
    el,
    vertical
      ? { scaleY: 0, transformOrigin: origin }
      : { scaleX: 0, transformOrigin: origin },
    {
      ...(vertical ? { scaleY: 1 } : { scaleX: 1 }),
      duration: 1,
      ease: 'power3.out',
      delay: parseFloat(el.dataset.revealDelay) || 0,
      scrollTrigger: {
        trigger: el,
        start: el.dataset.revealStart || 'top 80%',
        toggleActions: 'play none none none',
      },
    }
  );
}

export function initReveals() {
  const elements = Array.from(document.querySelectorAll('[data-reveal]'));

  // Releases the CSS rule that holds every reveal target at opacity 0. Safe to
  // do first: each branch below either sets its own "from" state synchronously
  // or is showing the elements anyway, so there is no frame where an unstyled
  // element is visible.
  const release = () => document.documentElement.classList.add('is-revealed');

  if (!elements.length) {
    release();
    return;
  }

  if (isMobile() || prefersReducedMotion()) {
    release();
    showAll(elements);
    return;
  }

  const run = () => {
    release();

    elements.forEach((el) => {
      switch (el.dataset.reveal) {
        case 'text':
          revealText(el);
          break;
        case 'line':
          revealLine(el);
          break;
        case 'fade':
        default:
          revealFade(el);
          break;
      }
    });

    ScrollTrigger.refresh();
  };

  // Wait on the webfonts so SplitText measures real line breaks.
  if (document.fonts?.ready) {
    document.fonts.ready.then(run);
  } else {
    run();
  }
}
