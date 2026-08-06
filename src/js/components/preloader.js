/**
 * Preloader.
 *
 * One continuous timeline:
 *
 *   1  a white frame, the mark centred on it and not yet drawn
 *   2  the icon is drawn as an outline; at 95% through it the wordmark starts,
 *      and each letter begins only once the previous one is nearly closed
 *   3  the readout climbs 0→100 across exactly that drawing window
 *   4  100 lands, a beat passes, and the outline eases full of brand blue
 *   5  the brand reveal — the panel goes white→blue while the mark goes
 *      blue→white, on the same curve over the same half-second, with a bloom
 *      lifting behind the mark as the colour arrives
 *   6  the finished lockup is held, then the panel lifts away to the hero
 *
 * Three implementation notes carry most of the weight.
 *
 * The drawing is real: each path gets `stroke-dasharray` set to its own measured
 * length and `stroke-dashoffset` driven from that length to zero, so the ink
 * genuinely travels along the outline. Nothing in the draw is an opacity fade.
 * Per-path duration is weighted by the square root of path length — long enough
 * that the big shapes read as slower, flat enough that they do not stall — and
 * each path is drawn from a thinner nib that eases up to full weight, then lifts
 * a little at the end, so the line tapers the way a pen does.
 *
 * The brand reveal is a plain colour animation: `backgroundColor` on the panel
 * against `color` on the stage, which every path inherits through currentColor.
 * Straight tweens like these necessarily pass through the same value once — the
 * mark and its background are briefly the same colour. Both run on a hard in-out
 * curve to make that crossing as short as it can be: the two are within a tenth
 * of each other for roughly 20ms, which is a frame or so and reads as a swap
 * rather than a blink.
 *
 * Trigger: `window.load`, with a hard cap so a slow asset can never strand a
 * visitor behind the panel.
 */

import { gsap, CustomEase } from '../core/gsap.js';
import { stopScroll, startScroll } from '../core/smooth-scroll.js';
import { isTabletDown, prefersReducedMotion } from '../utils/env.js';

// Loader-local curves. Defined here rather than in core/gsap.js because nothing
// else on the site runs on them.

/** A hand accelerating into a stroke and riding a long way out of it. */
const EASE_PEN = CustomEase.create('loaderPen', '0.4, 0.05, 0.28, 1');

/**
 * The brand reveal. Soft at both ends and decisive through the middle, which is
 * exactly where the two colours have to pass each other.
 */
const EASE_BRAND = CustomEase.create('loaderBrand', '0.85, 0, 0.15, 1');

const EASE_EXIT = CustomEase.create('loaderExit', '0.76, 0, 0.16, 1');
const EASE_FILL = 'power2.inOut';

/** The two ends of the colour axis. Kept in step with scss/base/_tokens.scss. */
const WHITE = '#ffffff';
const BRAND_BLUE = '#0765eb';

/** Nib weight at the moment a stroke starts, and after it lifts, as fractions. */
const NIB_START = 0.5;
const NIB_LIFT = 0.9;

/**
 * Every duration is in seconds. `iconDraw` and `wordDraw` are budgets — the
 * per-path durations inside each are derived from path length and normalised to
 * fill exactly that span, so retiming the sequence is a one-number change.
 *
 * `iconHandover` is the fraction of the icon that has to be drawn before the
 * wordmark starts, and `lead` the fraction of a shape drawn before the next one
 * begins. Everything from `fillAt` down is an offset from the moment the last
 * letter closes, except the exit, which is offset from the end of the reveal.
 */
const TIMELINE = {
  desktop: {
    iconDraw: 0.9,
    wordDraw: 1.75,
    iconHandover: 0.95,
    iconLead: 0.85,
    wordLead: 0.9,

    // The readout has just said 100. Let it.
    holdAt100: 0.15,
    fillDuration: 0.55,
    fillStagger: 0.012,
    // Measured from each path's own fill start, so the pen line leaves every
    // shape the same distance into its flood.
    settleAt: 0.3,
    settleDuration: 0.35,

    readoutAt: 0.06,
    readoutDuration: 0.3,

    revealGap: 0.12,
    revealDuration: 0.5,
    // Deliberately past the halfway point of the reveal. The two colours cross
    // there, and a bloom sitting on top of that moment lightens the ground
    // behind an already low-contrast mark — it turns the one brief soft frame
    // into a visible haze. Behind it instead, the mark is on its way to white
    // over a ground on its way to blue, which is the moment worth lighting.
    bloomAt: 0.28,
    bloomIn: 0.12,
    bloomOut: 0.16,
    bloomPeak: 0.34,

    hold: 0.28,
    exitDuration: 0.85,

    // Both are offsets from the start of the exit — the hero rises in behind
    // the panel while it is still clearing, which is what keeps the handover
    // from reading as two separate events.
    heroAt: 0.5,
    heroMoveDuration: 0.5,
    heroFadeDuration: 0.2,
    navAt: 0.6,
    navDuration: 0.5,
  },
  mobile: {
    iconDraw: 0.78,
    wordDraw: 1.45,
    iconHandover: 0.95,
    iconLead: 0.85,
    wordLead: 0.9,

    holdAt100: 0.15,
    fillDuration: 0.5,
    fillStagger: 0.01,
    settleAt: 0.28,
    settleDuration: 0.3,

    readoutAt: 0.06,
    readoutDuration: 0.28,

    revealGap: 0.12,
    revealDuration: 0.5,
    bloomAt: 0.28,
    bloomIn: 0.12,
    bloomOut: 0.16,
    bloomPeak: 0.3,

    hold: 0.28,
    exitDuration: 0.8,

    heroAt: 0.45,
    heroMoveDuration: 0.5,
    heroFadeDuration: 0.2,
    navAt: 0.55,
    navDuration: 0.5,
  },
};

/** Digits in the readout, zero-padded. */
const COUNT_DIGITS = 3;

/**
 * Replace the readout's text with one span per digit, so each figure sits in a
 * fixed-width cell (see `.preloader_count-digit`). Built once and then only the
 * text nodes are touched, rather than reparsing markup on every frame of the
 * count.
 */
function buildDigits(el) {
  el.textContent = '';
  return Array.from({ length: COUNT_DIGITS }, () => {
    const span = document.createElement('span');
    span.className = 'preloader_count-digit';
    el.appendChild(span);
    return span;
  });
}

/** Longest we will wait on `window.load` before starting anyway. */
const LOAD_TIMEOUT = 3000;

/**
 * Longest the finished lockup is held waiting on the hero behind it, in ms.
 *
 * Generous, because the wait is spent on a deliberate, finished frame rather
 * than on a spinner — but bounded, because a backdrop that never comes up must
 * not be able to strand anyone behind the panel.
 *
 * 2500 was too tight. The backdrop is a 487KB chunk plus a shader compile, and
 * measured on a 400kbps connection it was still not drawable when the cap
 * expired — so the panel left, the hero came up on its CSS gradient, and the
 * real backdrop faded in on top a moment later. That fade is the "blink". At
 * 5000 the same load lands inside the window; past that the fallback is the
 * honest answer and the crossfade is what it is for.
 */
const HERO_WAIT_CAP = 5000;

/** Stand-in draw window if the inline mark is ever missing from the markup. */
const FALLBACK_DRAW = 1.2;

/** User units of slack in the dash pattern — must exceed the stroke width. */
const DASH_CLEARANCE = 4;

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

/**
 * Prime every path as a fully retracted outline, and record the resting stroke
 * weight the stylesheet gave it so the taper has something to ease up to.
 *
 * The dash pattern is deliberately not the usual `dasharray: length` with the
 * offset at the same value. That parks the dash's trailing round cap exactly on
 * the path's start point, which paints a dot — so before the drawing reaches
 * them, all twelve shapes sit on the frame as a scatter of blue specks. Instead
 * the gap run is made longer than the path, so the pattern cannot repeat back
 * into it, and the offset overshoots by more than a stroke width, so the cap
 * clears the start too.
 */
function primePaths(paths) {
  return paths.map((path) => {
    const length = path.getTotalLength() || 1;
    const width = parseFloat(getComputedStyle(path).strokeWidth) || 1;

    gsap.set(path, {
      strokeDasharray: `${length} ${length + DASH_CLEARANCE}`,
      strokeDashoffset: length + DASH_CLEARANCE / 2,
      strokeWidth: width * NIB_START,
      strokeOpacity: 1,
      fillOpacity: 0,
    });

    return { path, length, width };
  });
}

/**
 * Lay a run of paths onto `tl` as one continuous hand.
 *
 * Each path starts at `lead` through the one before it — 0.9 meaning a letter
 * begins with the previous letter 90% closed. Durations are weighted by
 * √length and scaled so the whole run spans exactly `budget`.
 *
 * @returns the time the run finishes, i.e. `at + budget`.
 */
function drawRun(tl, entries, { budget, lead }, at) {
  if (!entries.length) return at;

  const weights = entries.map((entry) => Math.sqrt(entry.length));
  const last = entries.length - 1;

  // What the run would span at the raw weights: every path but the last
  // contributes only its lead, and the last contributes in full.
  const span = weights.reduce((total, w, i) => total + (i === last ? w : w * lead), 0);
  const scale = budget / span;

  let cursor = at;
  entries.forEach(({ path, width }, i) => {
    const duration = weights[i] * scale;

    tl.to(path, { strokeDashoffset: 0, duration, ease: EASE_PEN }, cursor);

    // The nib presses in over the first third — while only a short length is on
    // the paper, so it reads as the entry tapering rather than the whole line
    // changing weight — then lifts a fraction at the end.
    tl.to(
      path,
      { strokeWidth: width, duration: duration * 0.34, ease: 'power2.out' },
      cursor
    );
    tl.to(
      path,
      { strokeWidth: width * NIB_LIFT, duration: duration * 0.2, ease: 'power1.in' },
      cursor + duration * 0.8
    );

    cursor += duration * lead;
  });

  return at + budget;
}

/**
 * Hold the timeline at `exitAt` until `waitFor` settles.
 *
 * The panel used to leave on a fixed schedule, which meant the hero's WebGL
 * backdrop was still linking shaders and prefiltering its environment as it was
 * uncovered — so the visitor watched the CSS gradient stand-in sit there and
 * then swap. The work has not got any cheaper; it just happens behind the panel
 * now, and this is what makes sure the panel does not go first.
 *
 * The gate is an `onUpdate` check rather than a `gsap.addPause`, because in the
 * normal case there is nothing to wait for — the backdrop has been ready since
 * halfway through the drawing — and a pause inserted up front would still cost a
 * frame to come back out of. This way the common path never touches the
 * playhead at all.
 */
function gateExit(tl, exitAt, waitFor) {
  let open = false;
  let holding = false;
  let timer = 0;

  const release = () => {
    if (open) return;
    open = true;
    clearTimeout(timer);
    tl.eventCallback('onUpdate', null);
    if (holding) {
      holding = false;
      tl.resume();
    }
  };

  tl.eventCallback('onUpdate', () => {
    if (open || holding || tl.time() < exitAt) return;
    holding = true;
    // Armed here rather than at setup. The cap is a bound on how long the
    // visitor is made to wait, and the wait does not begin until the playhead
    // arrives — started from setup it would expire while the mark was still
    // being drawn, and the gate would never hold anything.
    timer = setTimeout(release, HERO_WAIT_CAP);
    tl.pause();
  });

  // Wired after the handler, so a `waitFor` that is already settled cannot clear
  // the callback a line before it is attached. Settled either way: a backdrop
  // that failed is as good a reason to carry on as one that succeeded, since the
  // CSS fallback is already painted.
  Promise.resolve(waitFor).then(release, release);
}

export function initPreloader({ onComplete, waitFor } = {}) {
  const panel = document.querySelector('.preloader');

  // No panel in the markup (or JS-disabled styling already took over): just
  // make sure nothing is left hidden.
  if (!panel) {
    revealImmediately();
    onComplete?.();
    return Promise.resolve();
  }

  const stage = panel.querySelector('.preloader_stage');
  const svg = panel.querySelector('.preloader_logo');
  const bloom = panel.querySelector('.preloader_bloom');
  const progress = panel.querySelector('.preloader_progress');
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

  const iconPaths = svg ? [...svg.querySelectorAll('.preloader_logo-icon path')] : [];
  const wordPaths = svg ? [...svg.querySelectorAll('.preloader_logo-word path')] : [];

  stopScroll();

  // --- Initial state --------------------------------------------------------
  const icon = primePaths(iconPaths);
  const word = primePaths(wordPaths);
  const allPaths = [...iconPaths, ...wordPaths];

  gsap.set(panel, { yPercent: 0, display: 'flex', backgroundColor: WHITE });
  if (stage) gsap.set(stage, { color: BRAND_BLUE });
  if (bloom) gsap.set(bloom, { opacity: 0 });
  const digits = count ? buildDigits(count) : null;

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
        const readout = { value: 0 };

        const tl = gsap.timeline({
          onComplete: () => {
            panel.classList.add('is-done');
            // The initial state wrote `display: flex` as an inline style, which
            // outranks `.is-done { display: none }`. Clear it directly or the
            // panel stays a live fixed-position layer for the rest of the
            // session, translated off-screen but still composited.
            panel.style.display = 'none';
            startScroll();
            onComplete?.();
            resolve();
          },
        });

        // --- 1-2. The drawing -------------------------------------------------
        const iconEnd = drawRun(tl, icon, { budget: t.iconDraw, lead: t.iconLead }, 0);
        const wordEnd = drawRun(
          tl,
          word,
          { budget: t.wordDraw, lead: t.wordLead },
          t.iconDraw * t.iconHandover
        );
        const drawn = Math.max(iconEnd, wordEnd) || FALLBACK_DRAW;

        // --- 3. The readout ---------------------------------------------------
        // Same start, same length, same timeline as the drawing, so 100 lands on
        // the frame the last letter closes rather than near it.
        tl.to(
          readout,
          {
            value: 100,
            duration: drawn,
            ease: 'none',
            onUpdate: () => {
              const v = readout.value;
              if (bar) bar.style.transform = `scaleX(${v / 100})`;
              if (digits) {
                const text = String(Math.round(v)).padStart(COUNT_DIGITS, '0');
                for (let i = 0; i < COUNT_DIGITS; i++) {
                  // Only the digit that actually changed is written.
                  if (digits[i].textContent !== text[i]) digits[i].textContent = text[i];
                }
              }
            },
          },
          0
        );

        // The counter has said 100 and has no second job.
        const readouts = [progress, count].filter(Boolean);
        if (readouts.length) {
          tl.to(
            readouts,
            { opacity: 0, duration: t.readoutDuration, ease: 'none' },
            drawn + t.readoutAt
          );
        }

        // --- 4. The flood -----------------------------------------------------
        // A beat after 100, then the outline eases full rather than switching on.
        const fillAt = drawn + t.holdAt100;

        tl.to(
          allPaths,
          {
            fillOpacity: 1,
            duration: t.fillDuration,
            ease: EASE_FILL,
            stagger: t.fillStagger,
          },
          fillAt
        );

        // The pen line leaves once the fill is under it. The mark is opaque
        // throughout, so all this reads as is the outline settling back to the
        // logo's true weight.
        tl.to(
          allPaths,
          {
            strokeOpacity: 0,
            duration: t.settleDuration,
            ease: 'none',
            stagger: t.fillStagger,
          },
          fillAt + t.settleAt
        );

        // --- 5. The brand reveal ----------------------------------------------
        const fillEnd = fillAt + t.fillStagger * (allPaths.length - 1) + t.fillDuration;
        const revealAt = fillEnd + t.revealGap;

        tl.to(
          panel,
          { backgroundColor: BRAND_BLUE, duration: t.revealDuration, ease: EASE_BRAND },
          revealAt
        );

        if (stage) {
          tl.to(
            stage,
            { color: WHITE, duration: t.revealDuration, ease: EASE_BRAND },
            revealAt
          );
        }

        // Light behind the mark as the colour lands, and gone again before the
        // hold — it is there to make the change feel lit, not to be looked at.
        if (bloom) {
          tl.to(
            bloom,
            { opacity: t.bloomPeak, duration: t.bloomIn, ease: 'power2.out' },
            revealAt + t.bloomAt
          );
          tl.to(
            bloom,
            { opacity: 0, duration: t.bloomOut, ease: 'power2.in' },
            revealAt + t.bloomAt + t.bloomIn
          );
        }

        // --- 6. The handover --------------------------------------------------
        const exitAt = revealAt + t.revealDuration + t.hold;
        tl.to(panel, { yPercent: -100, duration: t.exitDuration, ease: EASE_EXIT }, exitAt);

        // Nothing below this line is allowed to start until the hero behind the
        // panel is drawable. On anything but a cold cache it already is, and the
        // hold runs its stated length.
        if (waitFor) gateExit(tl, exitAt, waitFor);

        if (heroCopy) {
          tl.to(
            heroCopy,
            { y: '0rem', duration: t.heroMoveDuration, ease: 'wfOutCirc' },
            exitAt + t.heroAt
          );
          tl.to(
            heroCopy,
            { opacity: 1, duration: t.heroFadeDuration, ease: 'none' },
            exitAt + t.heroAt
          );
        }

        if (nav) {
          tl.to(
            nav,
            { opacity: 1, duration: t.navDuration, ease: 'none' },
            exitAt + t.navAt
          );
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
