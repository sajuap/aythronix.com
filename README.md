# Aythronix — website

Marketing site for Aythronix, a web / mobile / AI / e-commerce / SEO engineering agency.

Handwritten HTML5, SCSS, Bootstrap 5 (grid + utilities only), ES6 modules, GSAP, Lenis and a
2D-canvas particle system, bundled with Vite. No page builder, no framework.

```bash
npm install
npm run dev        # dev server on :5173
npm run build      # production build into dist/
npm run preview    # serve dist/ on :4173
```

Node 18+.

---

## ⚠️ Read before going live

**The three testimonials and the 4.9/5 rating are wired into `Review` and
`AggregateRating` structured data.** If those reviews are placeholder copy rather than
real, verifiable client feedback, publishing that markup breaks Google's review-snippet
policy and can earn a manual action against the whole domain — which is materially worse
than having no rating markup at all.

Before launch, either:

1. replace them with real attributed reviews you can substantiate, keeping `reviewCount` in
   step with how many are actually rendered on the page; or
2. delete the third `<script type="application/ld+json">` block in `index.html` (the
   AggregateRating/Review one) and leave the testimonial cards as ordinary page content.

The same applies to the two case-study metrics (`+140%`, `0.8s`) — they are presented as
factual outcomes and should be defensible.

Other placeholders to fill in: `hello@aythronix.com`, the `x.com/aythronix` and
`linkedin.com/company/aythronix` profiles, and the footer's Careers / Gallery / Contact
Support links, which currently point at on-page anchors because the destination pages do
not exist yet.

---

## Content and SEO

| Field | Value |
| --- | --- |
| Title | Aythronix \| Web, Mobile, AI & E-Commerce Engineering Agency |
| Canonical | `https://www.aythronix.com/` |
| Robots | `index, follow` |
| Primary keyword | digital engineering agency |
| H1 | Architecting the Future of Your Digital Ecosystem |

Exactly one `<h1>`; every section leads with an `<h2>`; cards inside sections use `<h3>`.
That hierarchy is the thing most easily broken by later edits, so it is worth preserving.

### Page order

| # | Section | `id` | Heading |
| --- | --- | --- | --- |
| 1 | Hero | `Hero` | Architecting the Future of Your Digital Ecosystem |
| 2 | Capability ticker | `Capabilities` | *(marquee — Web Development · Mobile Apps · AI Solutions · E-Commerce · SEO)* |
| 3 | Value proposition | `About` | One Technical Partner. Endless Capabilities. |
| 4 | Tech stack ribbon | `Stack` | Engineering With Modern Accredited Infrastructure |
| 5 | Services — bento grid | `Services` | Tailored Digital Solutions Built to Scale |
| 6 | Case studies | `Work` | Mission Critical Outcomes |
| 7 | Engineering lifecycle | `Process` | Engineering Lifecycle |
| 8 | Testimonials | `Reviews` | Trusted by Innovators, Scaled by Aythronix |
| 9 | Contact | `Contact` | Let's Architect Your Next Advantage |

### Structured data

Four JSON-LD blocks in `<head>`:

- **Organization** — with `logo`, `sameAs` and `contactPoint`. Carries an `@id` so the other
  graphs reference it instead of redeclaring the company three times.
- **Service ×5** — one node per offering, each `provider`-linked back to that `@id`.
- **AggregateRating + Review ×3** — see the warning above.
- **BreadcrumbList** — just `Home` while this is a single page. Extend it when service pages
  land.

`FAQPage` is not present: there is no FAQ block on the page, and FAQ markup without
matching visible content is invalid.

---

## Brand

### Palette

Everything derives from one blue, `#0765eb`, taken from the logo. Tokens live in
`src/scss/base/_tokens.scss`.

| Token | Value | Used for |
| --- | --- | --- |
| `--base-color-brand--blue` | `#0765eb` | solid buttons, the mark, metrics, particles |
| `--base-color-brand--blue-dark` | `#0550c2` | primary button hover |
| `--base-color-brand--blue-darker` | `#043a8c` | featured card gradient |
| navy base | `#04173a` | the dark neutral, and the base of every tint |

The neutral ramp is deliberately **not** black. Each step is an alpha of that navy, so body
copy, hairlines, form fills, card gradients and shadows all carry a trace of the brand hue.
It is a small shift per element and it is why the page reads as one system rather than blue
accents dropped onto a monochrome site.

### Logo

The supplied artwork (`aythronix 300.300 blue.svg`, kept at the repo root as the source of
truth) is a stacked lockup — mark above wordmark. Horizontal is what the header needs, so
build tooling splits the two groups and re-lays them out. Measured source geometry:
wordmark `295.92 × 61.67`, mark `65.68 × 67.70`.

| File | Purpose | viewBox |
| --- | --- | --- |
| `logo.svg` | horizontal lockup — header, footer brand, preloader | `397.03 × 80.17` |
| `logo-mark.svg` | mark alone — favicon, tight spaces | `65.68 × 67.70` |
| `logo-wordmark.svg` | wordmark alone | `295.92 × 61.67` |
| `footer-logo.svg` | oversized footer wordmark with a masked fade | `1192 × 201` |

Three decisions worth recording:

- **The mark is 1.3× the wordmark's box height.** Side by side at equal heights it reads as a
  small badge; at 1.3 it carries the lockup.
- **The wordmark is centred on its ascender-to-baseline band, not its bounding box.** The box
  includes the `y` descender, which the eye does not read as part of the line — centring the
  box visibly floats the word above the mark.
- **The footer mark's opacity is matched by perceived weight, not by copying a number.** Blue
  is much lighter per unit of alpha than a near-black: `L(a) = 255 − 164.3·a` over white, so
  20% would land at luminance ≈ 222 and read washed out. Solving for 204 gives **31%**.

### Imagery

The sphere renders and the abstract figure illustration were authored as black dot art.
Rather than regenerate ten raster variants, an SVG `feComponentTransfer` filter
(`#brand-tint`, declared inline in `index.html`) maps input black to the brand blue and
white to white:

```
feFuncR tableValues="0.02745 1"   →  7/255
feFuncG tableValues="0.39608 1"   → 101/255
feFuncB tableValues="0.92157 1"   → 235/255
```

It handles the transparent hero PNG *and* the opaque white-background AVIF — a mask could
only have done the first — and covers every `srcset` variant for free.
`color-interpolation-filters="sRGB"` is required; the default linearRGB applies the ramp in
the wrong colour space and comes out washed.

The four lifecycle Lottie glyphs were recoloured in place by walking the animation JSON and
rewriting only genuine colour properties. A string replace on `"k":[0,0,0,1]` would also
have hit position and anchor-point keyframes, which serialise identically.

### The tech stack ribbon is typographic, not logos

AWS and OpenAI are not distributable under the icon licences available here — Simple Icons
removed both at the trademark holders' request — and mixing four real marks with two text
labels looks like an oversight rather than a choice. All six are set in the same type
treatment instead. Drop in real marks later if the respective brand guidelines allow it.

---

## Architecture

```
index.html  legal-notice.html  policy.html
src/
  scss/
    base/         tokens, mixins, fonts, reset, typography
    layout/       containers, spacing scale, flex display utilities
    components/   button, nav, preloader, marquee, form, reveals
    sections/     hero, logos, value-prop, services, case-studies,
                  lifecycle, testimonials, contact, footer, legal
    utilities/    helpers (scroll lock, skip link, Lenis)
    main.scss     single entry — load order is documented in the file
  js/
    core/         gsap.js (plugin registration + named eases)
                  smooth-scroll.js (Lenis ↔ ScrollTrigger)
    components/   preloader, anchors, lottie-icons, contact-form
    animations/   nav, marquee, button-brackets, reveals
    three/        nebula-sphere.js
    utils/        env.js (breakpoints), viewport.js (--vh)
    main.js       boot sequence
  assets/         fonts, images, icons, lottie
```

The legal pages' header and footer are generated from `index.html` rather than maintained by
hand, so the three pages cannot drift out of sync.

### Boot order (`src/js/main.js`)

1. `--vh` is published before anything measures a full-viewport box.
2. Lenis comes up before any ScrollTrigger-backed animation, so triggers register against
   the right scroller.
3. The preloader locks scroll immediately and releases it on completion.
4. The hero sphere is built **after** the intro finishes — 3,500 springs competing with the
   intro timeline costs frames on the one animation every visitor watches.

### Bootstrap is imported partially, on purpose

Reboot is excluded. It sets its own heading scale, paragraph colour, margins and
`font-family`, and this design's typography is specific — a 4rem H1 at
`letter-spacing: -2.16px`, paragraphs at 80% opacity. Importing Reboot means overriding all
of it back, line by line, for no gain. What is taken: `functions`, `variables`, `maps`,
`mixins`, `utilities`, `grid` and `utilities/api`, with `$grid-breakpoints` re-pointed at
this design's own boundaries so `media-breakpoint-*` and the max-width mixins agree.

---

## Breakpoints

Desktop-first. Mixins in `scss/base/_mixins.scss`.

| Mixin | Query |
| --- | --- |
| *(base)* | 992px and up |
| `tablet` | `max-width: 991px` |
| `mobile-landscape` | `max-width: 767px` |
| `mobile-portrait` | `max-width: 479px` |
| `wide` / `xwide` | `min-width: 1440px` / `1920px` |

Behaviour changes worth knowing:

- **992px** — the canvas sphere is dropped for a pre-rendered still; the nav collapses behind
  a button; the header CTA moves into the menu; the services bento goes to two columns
  (featured card keeps its span, so it still leads); case studies and testimonials stack.
- **767px** — scroll-driven motion (reveals, Lenis) switches off entirely; the bento goes to
  one column; horizontal rows collapse unless tagged `is-still-horizontal`.

---

## The preloader

Choreography is lifted beat for beat from a reference implementation's page-load
interaction. Implementation: `src/js/components/preloader.js`.

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

The mobile variant runs a 6.00s progress tween with beats at 2.50 / 3.50 / 4.20.

Two details that are easy to get wrong:

- The panel starts leaving at 4.40s while the progress tween still has 0.10s to run. That
  overlap is intentional and is what stops the exit feeling like it waits for the counter.
- It triggers on `window.load` with a 3s cap, so a slow asset can never strand someone
  behind a blank panel.

`prefers-reduced-motion` skips the whole thing and reveals the page immediately.

---

## The particle sphere

`src/js/three/nebula-sphere.js`. 3,500 points spread over a sphere by Fibonacci spiral, spun
about Y, projected with a perspective divide and drawn as arcs to a 2D canvas.

**Not WebGL, on purpose.** At this point count a 2D context with plain `arc()` calls
outperforms per-point WebGL setup. `three` is installed and available for future work but is
not imported, so it is not in the bundle.

Two behaviours sit on the projection: a pointer *tilt* (the cursor's offset from centre
rotates the field by a fraction of a degree per pixel) and a local *warp* (points within
120px of the cursor are pushed radially away and slightly toward the viewer). Both feed a
spring/friction integrator, so points ease back rather than snap.

The loop parks itself when the canvas leaves the viewport or the tab is hidden, and
`destroy()` releases the rAF, the observer and every listener — without that a 3,500-point
loop keeps burning frames behind the fold. A second, centred instance drives the preloader,
assembling from scattered to sphere as the counter climbs.

---

## Reveal animations

`data-reveal` opts an element in — `text` (SplitText by line, masked, staggered), `fade`
(move and fade as one block), or `line` (scale a hairline from an origin).
`data-reveal-delay`, `-start`, `-origin` and `-axis` tune it. All off at 767px and under, and
under `prefers-reduced-motion`.

One trap worth documenting: masking a line needs vertical padding so descenders are not
shaved, and that padding inflates the element's height, moving every section below it. The
fix is padding **plus** a matching negative block margin on the wrapper, and
`display: flow-root` per line — set from JS, because SplitText writes an inline
`display: block` that outranks any stylesheet rule. Without the `flow-root`, adjacent lines'
negative margins collapse into one and a multi-line heading ends up 0.15em too tall.

---

## Provenance

The layout system — spacing scale, container/border treatment, typographic ramp, breakpoint
behaviour, button and marquee mechanics — was built against a reference implementation's own
compiled CSS rather than estimated by eye, and verified against it in headless Chrome: all
content sections and total document height matched to the pixel at 1440 / 1280 / 834 / 390.

That verification is historical now. The content is entirely different, the sections do not
correspond one-to-one, and the numbers no longer line up by design. What carried forward is
the design system and the motion layer, both of which are documented above and stand on
their own.

Bugs the headless-verification pass caught along the way, kept here because they are all
easy to reintroduce:

- **Vite does not rewrite relative `url()` from SCSS partials** on the legacy Sass `@import`
  path. All four webfonts, the background art and the decoration SVGs silently 404'd while
  the build reported success and the page looked *nearly* right, with fallback Times standing
  in for the display face. Fixed by using root-absolute `/src/assets/...` paths.
- **Assets referenced from `data-` attributes are not processed** — the Lottie JSON built
  fine and 404'd in production. Now resolved through `import.meta.glob(..., '?url')`.
- **A `ScrollTrigger.scrollerProxy` on `documentElement`** shifts every trigger: Lenis drives
  real window scroll, so no proxy belongs there.
- **Anchor scrolling double-counted the header offset** — Lenis already honours
  `scroll-margin-top`, so an extra JS offset stacks on top of it.
- **The preloader panel stayed `display: flex` forever**, because the intro wrote that inline
  and `.is-done { display: none }` could not outrank it.

---

## Performance notes

- ~20KB app JS, ~133KB GSAP, ~20KB Lenis. lottie-web (167KB) and Lenis are dynamic imports,
  so phones never fetch either.
- CSS ships as a single file; sub-2KB SVGs are inlined as data URIs.
- The sphere caps DPR at 2 so a 3× phone screen does not quadruple fill-rate, and parks its
  loop off-screen.
- `gsap.ticker.lagSmoothing(0)` — a scroll-linked timeline that catches up in one jump reads
  as a stutter.
- Marquees and the preloader panel are the only elements with `will-change`, applied per
  element rather than globally.
- Resize handlers are debounced and ignore events where no dimension actually changed (iOS
  fires `resize` when the URL bar collapses).

---

## Housekeeping

`src/assets/images/` still contains portraits, product photography and press logos from the
previous content set. Nothing references them, so they are not bundled, but they are dead
weight in the repo and can be deleted once you are sure nothing is coming back.

`ppneuebit-bold.otf` sits at the repo root and is not referenced anywhere; there is also a
duplicate `ppmondwest-regular.otf` there (the one the site uses lives in
`src/assets/fonts/`).

---

## Branches

| Branch | Contents |
| --- | --- |
| `aythronix-website` | **This one.** Blue rebrand + agency content. |
| `botronics-clone` | The original pixel-verified recreation, frozen before any Aythronix change. Kept for reuse in a separate project — do not land rebrand or content commits on it. |
| `main` | The original empty Bootstrap/webpack scaffold, so the whole build is reviewable as a diff. |

`botronics-clone` branches off this history at the commit *before* the rebrand, so it is a
genuine snapshot rather than a revert, and it builds standalone.
