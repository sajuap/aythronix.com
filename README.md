# Aythronix — website

A handwritten site: HTML5, SCSS, Bootstrap 5 (grid + utilities only), ES6 modules, GSAP,
Lenis and a 2D-canvas particle system, bundled with Vite.

No page builder, no framework. The layout was built against a reference implementation's
own compiled CSS rather than estimated by eye, and is verified against it with headless
Chrome (see [Verification](#verification)). The brand layer on top — logo, palette,
imagery treatment — is Aythronix's own (see [Brand](#brand)).

---

## Quick start

```bash
npm install
npm run dev        # dev server on :5173
npm run build      # production build into dist/
npm run preview    # serve dist/ on :4173
```

Node 18+.

---

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Bundler | Vite 5 | Multi-page: `index.html`, `legal-notice.html`, `policy.html` |
| Styles | SCSS (dart-sass) | 7-1-ish layout under `src/scss/` |
| Grid / utilities | Bootstrap 5.3 | **Partial import.** Grid, mixins and the utilities API only — Reboot is deliberately excluded, see below |
| Animation | GSAP 3.15 | ScrollTrigger, ScrollToPlugin, SplitText, CustomEase |
| Smooth scroll | Lenis 1.3 | Desktop only, stepped from the GSAP ticker |
| Vector animation | lottie-web | Light (SVG-only) build, lazy-loaded on intersection |
| Particle field | Hand-written 2D canvas | 3,500 points — see [The particle sphere](#the-particle-sphere) |

### Why Bootstrap is only partially imported

Reboot sets its own heading scale, paragraph colour, margins and `font-family`. The
design's typography is specific — a 4rem H1 at `letter-spacing: -2.16px`, paragraphs at
80% opacity — and importing Reboot means overriding all of it back, line by line, for no
gain. So `main.scss` pulls in `functions`, `variables`, `maps`, `mixins`, `utilities`,
`grid` and `utilities/api`, with `$grid-breakpoints` re-pointed at the design's own
boundaries so Bootstrap's `media-breakpoint-*` and our max-width mixins agree.

---

## Brand

### Palette

Everything derives from one blue, `#0765eb`, taken straight from the logo. Tokens live in
`src/scss/base/_tokens.scss`.

| Token | Value | Used for |
| --- | --- | --- |
| `--base-color-brand--blue` | `#0765eb` | solid buttons, the mark, accents, particles |
| `--base-color-brand--blue-dark` | `#0550c2` | primary button hover |
| `--base-color-brand--blue-lightest` | `#f0f5ff` | tinted surfaces |
| navy base | `#04173a` | the dark neutral — headings, and the base of every tint |

The neutral ramp is deliberately **not** black. Each step (`neutral-darker` through
`neutral-lightest`) is an alpha of that navy, so body copy, hairlines, form fills, card
gradients and shadows all carry a trace of the brand hue. It is a small shift per element
and it is the reason the page reads as one system rather than blue accents dropped onto a
monochrome site.

### Logo

The supplied artwork (`aythronix 300.300 blue.svg`, kept at the repo root as the source of
truth) is a stacked lockup — mark above wordmark. Horizontal is what the header needs, so
`scratchpad`-side tooling splits the two groups and re-lays them out. Measured source
geometry: wordmark `295.92 × 61.67`, mark `65.68 × 67.70`.

Three derivatives in `src/assets/icons/`:

| File | Purpose | viewBox |
| --- | --- | --- |
| `logo.svg` | horizontal lockup — header, footer brand, preloader | `397.03 × 80.17` |
| `logo-mark.svg` | mark alone — favicon, tight spaces | `65.68 × 67.70` |
| `footer-logo.svg` | oversized footer wordmark, masked fade | `1192 × 201` |

The footer wordmark's opacity is matched to the original by *perceived weight*, not by
copying its number. The original was near-black at 20%, landing on `rgb(204,204,204)` over
white — luminance ≈ 204. This blue is much lighter per unit of alpha:
`L(a) = 255 − 164.3·a`, so 20% would give ≈ 222 and read washed out. Solving for 204 gives
**31%**. Its fade also stops at 27% rather than 0, because the original's gradient ran past
the bottom of its viewBox and was still around 27% where it got cropped.

Two decisions worth recording:

- **The mark is set to 1.3× the wordmark's box height.** Side by side at equal heights it
  reads as a small badge; at 1.3 it carries the lockup, which is what "make the icon a
  little bigger" asked for.
- **The wordmark is centred on its ascender-to-baseline band, not its bounding box.** The
  box includes the `y` descender, which the eye does not read as part of the line —
  centring the box instead visibly floats the word above the mark.

### Imagery

The sphere renders and the mission dot-illustration were authored as black dots. Rather
than regenerate ten raster variants, an SVG `feComponentTransfer` filter (`#brand-tint`,
declared inline in `index.html`) maps input black to the brand blue and white to white:

```
feFuncR tableValues="0.02745 1"   →  7/255
feFuncG tableValues="0.39608 1"   → 101/255
feFuncB tableValues="0.92157 1"   → 235/255
```

It handles the transparent PNG in the hero *and* the opaque white-background AVIF in the
milestones — a mask could only have done the first — and covers every `srcset` variant for
free. `color-interpolation-filters="sRGB"` is required; the default linearRGB applies the
ramp in the wrong colour space and comes out washed.

The four milestone Lottie glyphs were recoloured in place by walking the animation JSON and
rewriting only genuine colour properties. A string replace on `"k":[0,0,0,1]` would also
have hit position and anchor-point keyframes, which serialise identically.

Press logos stay black on purpose: they are other companies' marks and tinting them would
misrepresent them.

---

## Architecture

```
index.html  legal-notice.html  policy.html
src/
  scss/
    base/         tokens, mixins, fonts, reset, typography
    layout/       containers, spacing scale, flex display utilities
    components/   button, nav, preloader, marquee, form, reveals
    sections/     hero, logos, projects, mission, technology,
                  milestones, team, contact, footer, legal
    utilities/    helpers (scroll lock, skip link, Lenis)
    main.scss     single entry — load order is documented in the file
  js/
    core/         gsap.js (plugin registration + named eases)
                  smooth-scroll.js (Lenis ↔ ScrollTrigger)
    components/   preloader, anchors, team-toggle, lottie-icons, contact-form
    animations/   nav, marquee, button-brackets, reveals
    three/        nebula-sphere.js
    utils/        env.js (breakpoints), viewport.js (--vh)
    main.js       boot sequence
  assets/         fonts, images, icons, lottie
```

### Boot order (`src/js/main.js`)

1. `--vh` is published before anything measures a full-viewport box.
2. Lenis comes up before any ScrollTrigger-backed animation, so triggers register
   against the right scroller.
3. The preloader locks scroll immediately and releases it on completion.
4. The hero sphere is built **after** the intro finishes — 3,500 springs competing with
   the intro timeline costs frames on the one animation every visitor watches.

---

## Breakpoints

Desktop-first, matching the reference exactly. Mixins live in `scss/base/_mixins.scss`.

| Mixin | Query |
| --- | --- |
| *(base)* | 992px and up |
| `tablet` | `max-width: 991px` |
| `mobile-landscape` | `max-width: 767px` |
| `mobile-portrait` | `max-width: 479px` |
| `wide` / `xwide` | `min-width: 1440px` / `1920px` |

Behaviour changes worth knowing:

- **992px** — the canvas sphere is dropped for a pre-rendered still; the nav collapses
  behind a button; the header CTA moves into the menu; the Technology image re-orders
  below its copy; the milestones sphere is removed.
- **767px** — scroll-driven motion (reveals, Lenis) switches off entirely; horizontal
  rows collapse to columns unless tagged `is-still-horizontal`.

---

## The preloader

The choreography is taken from the loader reference's page-load interaction, beat for
beat. Both of its variants are reproduced; the numbers below are the reference's own
durations and delays. Implementation: `src/js/components/preloader.js`.

| t (desktop) | Beat | Duration | Ease |
| --- | --- | --- | --- |
| 0.00 | progress 0 → 100 | 4.50s | linear |
| 2.60 | backdrop layer fades in | 0.50s | linear |
| 2.60 | logo scales 0.8 → 1 | 0.40s | `outCirc` |
| 4.00 | logo fades out | 0.40s | linear |
| 4.40 | panel lifts to `y: -100vh` | 1.00s | `ease` |
| 5.00 | hero copy rises `4rem → 0` | 0.50s | `outCirc` |
| 5.00 | hero copy fades in | 0.20s | linear |
| 5.10 | header fades in | 0.50s | linear |

The mobile variant runs a 6.00s progress tween with its beats at 2.50 / 3.50 / 4.20.

Two details that are easy to get wrong:

- The panel starts leaving at 4.40s while the progress tween still has 0.10s to run. That
  overlap is in the original and is what stops the exit feeling like it waits for the
  counter.
- It is triggered on `window.load` (the reference fires on its framework's equivalent),
  with a 3s cap so a slow asset can never strand someone behind a blank panel.

`prefers-reduced-motion` skips the whole thing and reveals the page immediately.

---

## The particle sphere

`src/js/three/nebula-sphere.js`. 3,500 points spread over a sphere by Fibonacci spiral,
spun about Y, projected with a perspective divide and drawn as arcs to a 2D canvas.

**It is not WebGL, and that is on purpose** — the reference isn't either. At this point
count a 2D context with plain `arc()` calls outperforms per-point WebGL setup, and
matching the reference is the goal. `three` is installed and available for future work
but is not imported, so it is not in the bundle.

Two behaviours sit on the projection: a pointer *tilt* (the cursor's offset from centre
rotates the field by a fraction of a degree per pixel) and a local *warp* (points within
120px of the cursor are pushed radially away and slightly toward the viewer). Both feed a
spring/friction integrator, so points ease back rather than snap.

The projection deliberately keeps the reference's ordering quirk: screen position is
computed from the pre-integration depth while the radius uses the post-integration depth.
Recomputing both after integration tightens the field visibly, so it is left as-is.

Added on top of the reference: the loop parks itself when the canvas leaves the viewport
or the tab is hidden, and `destroy()` releases the rAF, the observer and every listener.
Without that a 3,500-point loop keeps burning frames behind the fold.

---

## Reveal animations

`data-reveal` on an element opts it in — `text` (SplitText by line, masked, staggered),
`fade` (move and fade as one block), or `line` (scale a hairline rule from an origin).
`data-reveal-delay`, `-start`, `-origin` and `-axis` tune it. All of it is off at 767px
and under, and under `prefers-reduced-motion`.

One trap worth documenting: masking a line needs vertical padding on the clip, or
descenders (g, y, p) get shaved. That padding inflates the element's height, which moves
every section below it. The fix is padding **plus** a matching negative block margin on
the wrapper, and `display: flow-root` per line — set from JS, because SplitText writes an
inline `display: block` that outranks any stylesheet rule. Without the `flow-root`,
adjacent lines' negative margins collapse into one and a multi-line heading ends up
0.15em too tall.

---

## Verification

Both builds were driven in headless Chrome at four viewports, comparing computed styles
and measured geometry against `https://www.botronics.be/`.

**Section heights and total document height — 0px delta at every breakpoint:**

| Viewport | Content sections matching | Total height (local = live) |
| --- | --- | --- |
| 1440 × 900 | 9 / 9 | 6420px |
| 1280 × 800 | 9 / 9 | 6270px |
| 834 × 1112 | 9 / 9 | 8346px |
| 390 × 844 | 9 / 9 | 8731px |

Since the rebrand, all nine content sections still match exactly; the footer is
intentionally **+50px** taller (469 vs 419 at 1440), entirely because the new oversized
wordmark uses a `1192 × 201` viewBox instead of the original's `1192 × 154` so the word
shows down to its baseline. Cropping at the old height cut through the x-height. Total
document height is therefore 6470px against the reference's 6420px, and that 50px is the
only structural difference.

Measured *after* walking the page so every lazy image has loaded and decoded. This
matters more than it sounds: an image with no intrinsic size yet collapses its grid row,
and the Technology section reads 638px unloaded against 857px loaded. Comparing two
unloaded states agrees, but it agrees about the wrong thing — the harness now forces the
loaded state on both sides before measuring. Individual sub-elements (the iXi copy block,
both contact panels, the form grid, textarea, submit, mission image band, technology copy,
team card stack, footer grid) also match to the pixel.

Computed styles also match on the H1, the Mondwest display span (373px wide on both
sides), body copy, eyebrow labels, nav links, buttons, containers and team cards. All
four webfonts report `loaded`. No console errors, page errors or failed requests on any
page.

**Interactions checked:** corner brackets move exactly `+4,-4` on hover; marquees
translate continuously; the nav interpolates `rgba(255,255,255,0)` →
`rgb(255,255,255)` with a `rgba(0,0,0,0.1)` hairline across the first 1% of scroll; the
team toggle goes 2 → 8 cards and swaps its buttons and bottom fade; all four Lottie
glyphs mount; anchors land 96px clear of the fixed header.

### Bugs this process caught

- **Every stylesheet asset was 404ing.** Vite does not rewrite relative `url()` from SCSS
  partials on the legacy Sass `@import` path, so all four webfonts, the smoke background,
  the two decoration SVGs and the iXi panel art silently failed — the build succeeded and
  the page looked *nearly* right, with fallback Times standing in for Mondwest. Fixed by
  using root-absolute `/src/assets/...` paths.
- **Lottie JSON referenced from `data-` attributes was not processed**, so it built fine
  and 404'd in production. Now resolved through `import.meta.glob(..., '?url')`.
- **A `ScrollTrigger.scrollerProxy` on `documentElement`** would have shifted every
  trigger: Lenis drives real window scroll, so no proxy belongs there.
- **Anchor scrolling double-counted the header offset** — Lenis already honours
  `scroll-margin-top`, so the extra JS offset stacked on top of it.
- **The preloader panel stayed `display: flex` forever**, because the intro wrote that as
  an inline style and `.is-done { display: none }` could not outrank it.

---

## Deliberate differences from the reference

Recorded so they read as decisions rather than gaps.

1. **No Three.js effects, because the reference has none.** The original is a Webflow
   site: its motion is the built-in interaction engine, four Lottie glyphs, CSS
   transitions and the 2D-canvas sphere. There is no WebGL, no shader, no post-processing
   and no GSAP anywhere in it. Adding invented WebGL would have moved *away* from the
   reference, so the interactions were re-implemented in GSAP (the requested stack) at the
   reference's own durations, easings and values.
2. **No jQuery in the bundle.** The reference loads it because its page builder's runtime
   requires it; the only first-party use is one line setting the copyright year. That is
   `textContent` here. jQuery stays in `package.json` but importing it would add ~85KB for
   nothing.
3. **Scroll reveals are an addition.** The reference has no scroll-triggered reveals at
   all. These are opt-in per element via `data-reveal` and cost zero layout height (see
   above), so the static rendering is unchanged; remove the attributes to match the
   reference exactly.
4. **Lenis smooth scrolling is an addition** — the reference scrolls natively. It is
   desktop-only and disabled under reduced-motion.
5. **The preloader is an addition.** The reference has no loader; this one follows the
   loader reference's choreography with Botronics' own brand content — the assembling
   particle field is the site's own signature visual, standing in for the original's
   full-bleed vector animation, driven by the same 0 → 100 progress value.
6. **Marquees loop seamlessly.** The reference translates one long row 10,000px over
   300s and visibly jumps when it restarts. Speed here is identical (33.33px/s), but the
   content is measured and cloned to fill the viewport and the offset wraps, so there is
   no seam and it survives a resize.
7. **The contact form has no backend.** It validates, shows the reference's own three
   states, and posts to whatever `action` the markup declares — with none set it succeeds
   locally so the flow stays reviewable. The final grid cell is reserved for an anti-spam
   widget, matching the reference's own reserved row.
8. **Accessibility additions:** a skip link, real `<button>`s for the menu and team
   toggle, `aria-expanded` state, focus-visible rings, keyboard-reachable bracket hover,
   and `Escape` to close the menu.

---

## Performance notes

- Bundle: ~20KB app JS, ~133KB GSAP, ~20KB Lenis, all gzipped to well under half that.
  lottie-web (167KB) and Lenis are dynamic imports — phones never fetch either.
- CSS is a single file; the two decoration SVGs are inlined as data URIs under the 2KB
  threshold.
- The sphere caps DPR at 2, so a 3× phone screen doesn't quadruple fill-rate, and parks
  its loop off-screen.
- `gsap.ticker.lagSmoothing(0)` — a scroll-linked timeline that catches up in one jump
  reads as a stutter.
- Marquees and the panel are the only elements with `will-change`, applied per element
  rather than globally.
- Resize handlers are debounced and ignore events where no dimension actually changed
  (iOS fires `resize` when the URL bar collapses).

---

## Assets

68 files pulled local into `src/assets/` — 4 webfonts (Overused Grotesk regular/medium/
bold, PP Mondwest), the press logos, team portraits with their full `srcset` ladders, the
sphere renders, the four Lottie JSONs and the UI icons. Nothing is loaded from a third-party
CDN at runtime.

---

## Outstanding — needs your input

The rebrand renamed every human-readable brand string. Three things were left pointing at
the old identity because inventing a replacement would have produced broken links:

| What | Current value | Where |
| --- | --- | --- |
| Domain | `https://www.botronics.be/` | `canonical`, `og:url`, JSON-LD `url` in `index.html`; body text and `canonical` in both legal pages |
| Contact email | `info@botronics.be` | `legal-notice.html`, `policy.html` |
| LinkedIn profile | `linkedin.com/company/botronics/` | footer of all three pages, JSON-LD `sameAs` |

`utm_campaign` values *were* renamed to `aythronix` — those are analytics labels, not
addresses, so they should follow the brand.

Also worth a look: `ppneuebit-bold.otf` and a duplicate `ppmondwest-regular.otf` sit at the
repo root. They arrived mid-session rather than from the build; PP NeueBit is not
referenced anywhere. The Mondwest copy the site actually uses lives in
`src/assets/fonts/`.

---

## Branch

Work is on `feature/botronics-clone`. `main` holds the pre-existing empty
Bootstrap/webpack scaffold as a baseline commit, so the migration to Vite is reviewable
as a diff.
