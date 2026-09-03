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

The same applies to every inner page: `about.html`, `services.html`, `portfolio.html`,
`blog.html` and `contact.html` are **placeholder copy holding a finished layout**, each
marked with a `PLACEHOLDER CONTENT` comment at the top of its `<main>`. The portfolio's
engagements deliberately carry no figures — `.case-card_metric` is sized for a real number,
so put one there once there is one to substantiate.

Other placeholders to fill in: `hello@aythronix.com` (the contact page shows it in two
places), and the `x.com/aythronix` and `linkedin.com/company/aythronix` profiles. The
footer's Careers link points at the contact page because there is no careers page yet.

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

### Pages

| File | Nav | Title |
| --- | --- | --- |
| `index.html` | *(the mark)* | Aythronix \| Web, Mobile, AI & E-Commerce Engineering Agency |
| `about.html` | About | About \| Aythronix |
| `services.html` | Services | Services \| Aythronix |
| `portfolio.html` | Portfolio | Portfolio \| Aythronix |
| `blog.html` | Blog | Blog \| Aythronix |
| `contact.html` | Contact | Contact \| Aythronix |
| `legal-notice.html` | *(footer)* | Legal Notice \| Aythronix |
| `policy.html` | *(footer)* | Cookie Policy \| Aythronix |

**A new page has to be added to `rollupOptions.input` in `vite.config.js`.** A multi-page
Rollup build only emits the entries it is given, so a page left out of that map works in
dev and is simply absent from `dist/` in production.

Only `index.html` runs the preloader and the WebGL hero; every other page uses the
page transition instead and never downloads Three. The nav's colour flip keys off
`.hero-section`, which is why the inner pages' banner carries that class alongside
`.page-hero`.

The nav link for the current page carries `aria-current="page"`, which is also what draws
the underline under it — see `scss/components/_nav.scss`.

**The blog's category chips really filter.** Every filterable thing carries `data-category`,
every chip carries `data-filter`, `all` matches everything, and `blog-filters.js` matches the
two — the featured post included, since the chips sit directly above it. State lives on
`aria-pressed`, and the stylesheet draws from that attribute rather than a parallel class, so
what a screen reader is told and what is on screen cannot drift apart. Filtering changes the
document height, so it calls `ScrollTrigger.refresh()`.

### Homepage section order

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

**Case studies (`#Work`) is a scroll stack.** Full-width panels that stick under the header,
each one covered by the next as you scroll. Two things about how it is built:

- **The stacking is `position: sticky` and nothing else.** No pin, no scrubbed layout, no JS
  in the path. The browser composites a sticky element on its own, so it cannot drop frames
  the way a pinned, scrubbed stack does — and it still works from the stylesheet alone.
  GSAP's only job is the depth cue in `animations/card-stack.js`: one scrubbed transform that
  takes the outgoing panel down to `0.94` so it reads as receding behind the arriving one
  rather than being wiped by it. The scrub range is read from the panel's own computed `top`,
  so it cannot drift from the sticky offset.
- **Two ancestor properties keep it alive**, and both are easy to break by accident. A sticky
  element inside a *scroll container* sticks to that container, not the viewport — so `body`
  and `.page-wrapper` clip horizontally with `overflow-x: clip` rather than `hidden`, because
  `clip` never creates one. Adding `overflow: hidden` or `auto` anywhere between the panel and
  the root disables this section with no error. And the panel's background must be **opaque**:
  the grid card's surface is a 5% alpha of the navy, which the panel underneath reads straight
  through. `.case-stack_card` uses `#f2f3f5`, that same colour resolved against the white page.

`.case-stack` sets its own scroll choreography: `gap` is how long each transition takes, and
`padding-bottom` is how long the last panel holds before the section releases it. Both are
invisible — a sticky panel is covering them.

The effect wants three or four panels to really land; there are two, because there are two
case studies and the metrics on them are already flagged above as needing substantiation.
Adding a panel is markup only.

**Testimonials is the one full-bleed band on the site**, and the one place the framed 80rem
column is deliberately dropped — the card row runs edge to edge, so hairlines down each side
would be cut straight through by it, and the band's own edges do the framing instead. It is
dark for contrast rather than decoration: the cards are a pale blue-white gradient, and on the
tinted background this section might otherwise have taken they would sit within a few percent
of their own surface and stop reading as cards. It reuses the hero's exact gradient stack, so
the dark bands down the site read as one family. The heading block is inverted for it; the
cards are unchanged.

The row's edge fade is a `mask-image` rather than two gradient overlays specifically so that
this was possible — an overlay has to be painted the same colour as whatever is behind it, and
would have become two visible smears the moment the background changed.

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
| `footer-logo.svg` | oversized footer wordmark with a masked fade | `1192 × 250` |

Three decisions worth recording:

- **The mark is 1.3× the wordmark's box height.** Side by side at equal heights it reads as a
  small badge; at 1.3 it carries the lockup.
- **The wordmark is centred on its ascender-to-baseline band, not its bounding box.** The box
  includes the `y` descender, which the eye does not read as part of the line — centring the
  box visibly floats the word above the mark.
- **The footer mark's opacity is matched by perceived weight, not by copying a number.** Blue
  is much lighter per unit of alpha than a near-black: `L(a) = 255 − 164.3·a` over white, so
  20% would land at luminance ≈ 222 and read washed out. Solving for 204 gives **31%**.

### Corner radius

A scale, in `base/_tokens.scss`. The step is chosen by what a thing **is**, not by how big it
happens to be:

| Token | Value | Applies to |
| --- | --- | --- |
| `--radius--small` | `6px` | `.button` (all variants, incl. the form submit), `.form-input` / `.form_input` and the textarea, `.label-chip`, `:focus-visible` |
| `--radius--medium` | `12px` | `.service-card`, `.case-card`, `.post-card`, `.testimonial-card`, `.contact-section_form-wrapper` |
| `--radius--large` | `16px` | `.post-card_thumb`, `.featured-post_media`, `.team-card_portrait` |
| `--radius--pill` | `999px` | `.blog-filter` |

**Media curves hardest on purpose.** A picture sharing its corner with the button beside it
reads as a swatch rather than a photograph, and the bigger the box the more radius it takes
before the eye registers any curve at all — 6px across a 400px-wide image is a rounding error
you cannot see.

**`.container-large-bordered` is the one exception and stays square.** It is the frame the
whole layout is built on: its hairlines are what make the stacked sections read as one
continuous grid, and curving their ends breaks every join down the page.

Two knock-on effects worth knowing. `.contact-section_form-wrapper` needed `overflow: hidden`
so the right-hand panel inside follows the curve instead of poking square corners through it —
same for `.service-card`, which already had it. And the buttons' corner brackets
(`.select-button-vector`) are drawn square and sit at the four corners: at 6px they still read
as the same corner, but they are the thing that stops agreeing first if `--radius--small` ever
opens up much further.

### Icons

Lottie, mounted from `data-lottie` in the markup by `js/components/lottie-icons.js` — a player
per glyph, created on intersection and paused off-screen.

The site started with four files cycled across fourteen slots. They came from an icon set, and
their own names say what went wrong: `system-regular-58-call-phone`,
`-76-newspaper`, `-160-trending-up` and `-63-settings-cog` were standing in for Discovery,
Clarity, Blueprinting and Email at the same time. Three of the four have an honest home and
kept it; the rest of the set is generated.

| Slot | Glyph | |
| --- | --- | --- |
| Discovery | `discovery` | magnifier |
| Blueprinting | `blueprint` | plated drawing frame |
| Engineering · Operate | `built-icon` | **original** — settings cog |
| Deployment | `deployment` | arrow off a baseline |
| Delivery | `icon-3` | **original** — trending up |
| Clarity | `clarity` | eye |
| Adaptability | `adaptability` | two-way arrows |
| Focus | `focus` | target |
| Email | `email` | envelope |
| LinkedIn | `network` | two linked nodes |
| Response Time | `icon-1` | **original** — ringing phone |

`icon-2` (newspaper) is the one with no honest home among these ideas, so nothing points at it.
It stays in the folder for a slot that suits it — a blog or press section. It is emitted to
`dist/` because the loader globs the folder, but nothing fetches it, so it costs nothing at
runtime.

**The generated files come from `assets/lottie/glyphs.gen.mjs`** — `node
src/assets/lottie/glyphs.gen.mjs` rewrites them. Source of truth is the SVG path data at the
top of that script; **do not hand-edit the `.json`**, the bezier arrays in them are not
maintainable by hand.

Everything about the output is copied out of the originals rather than guessed at: a 500×500
board at 60fps over 60 frames, the `sh → tm → st → tr` item order inside each shape group,
`[0.02745, 0.39608, 0.92157]` for the brand blue, a `31.3` stroke, `lc`/`lj` 2 for round caps
and joins. The animation is a trim path, which is what three of the four originals already
used: `e` runs 0 → 100 so the line draws on, then `s` runs 0 → 100 so it leaves the way it
arrived rather than rewinding. Two frames of stagger per path keeps the busiest glyph inside
the 60-frame board.

The generator converts SVG arcs to cubic beziers itself (endpoint-to-centre parameterisation,
capped at a quarter turn per segment) because Lottie has no arc primitive. Circles are
therefore written as two 180° arcs and land as five vertices.

**The same script normalises the four imported files, and that fixed a bug they shipped with.**
Every colour in them was driven by an After Effects expression —
`comp('system-regular-…').layer('control').effect('primary')('Color')` — which needs lottie's
expression engine to evaluate. The site loads `lottie_light`, which does not include it, so
those properties never received a value and **rendered black**. Running all twelve through the
real player in jsdom is what surfaced it: the generated glyphs came out `rgb(6,101,235)`, the
four imported ones `rgb(0,0,0)`.

Rather than ship an engine to evaluate one constant, the generator resolves the expression
ahead of time: strips it and writes the brand blue into the value it was reaching for. All 43
expressions across the four files were colour — none drove motion — so nothing else changed.
The pass is idempotent.

Worth keeping in mind for any future icon dropped in from a library: **if it looks black, check
for expressions before anything else.** They fail silently on the light build.

### The studio band (About)

An oversized wordmark with a photograph pulled up over its lower half, so the type reads as
something the image stands in front of rather than a caption above it. Copy sits on the image
at the foot over a scrim.

**The overlap is `em` on the wordmark's own negative bottom margin**, not a pixel value on the
image — `em` resolves against the wordmark's font size, which is a `clamp()`, so the picture
meets the letters at the same point on every viewport instead of swallowing them on a phone
and floating above them on a wide desktop.

**`-0.22em`, which hides the bottom third of the word.** That number took several passes and
is worth not re-litigating: `-0.42em` buried it, `-0.34em` and `-0.28em` took nearly half,
`-0.12em` left the type sitting on top of the image rather than passing behind it. The word
has to stay readable *and* clearly go behind the picture — that is the whole effect, and both
halves of it are easy to lose.

If it ever needs re-deriving: at this face and `line-height: 0.92` the baseline sits `0.079em`
above the line box's bottom edge, so `-0.079em` puts the image exactly on the baseline, and
every `0.052em` past that hides another 10% of the x-height. **Check it by rendering, not by
arithmetic.**

Both layers carry an explicit `z-index`. In normal flow the later element would win anyway,
but only for its own inline content — stating the stack stops a later `position` or
`transform` on either from quietly reversing it.

`.studio-band_inner` carries its own `max-width: var(--container-max)`, because
`.container-large` has no width in this codebase; the page banners use it purely as a hook.

**The copy is a sibling of the picture, not a child of it.** The media box is a fixed 2:1 with
`overflow: hidden`; on a phone the copy moves out from over the image to underneath it, and
nested that move would only have clipped it against the picture's own edge. `.studio-band_frame`
is what the copy positions against.

**The button carries no `data-brackets`.** The corner vectors are drawn in brand blue for a
white page — over a photograph they read as four stray marks floating off the button rather
than as a frame around it.

**The photograph is generated**, not a photograph of anyone, and it is **decorative**:
`alt=""`, and nothing near it claims these are Aythronix people. That is the same line the
team cards draw by carrying initials instead of faces. Replace it with the real studio when
there is one.

It is cropped to **2:1 in the asset** rather than by `object-fit`, so `cover` has nothing left
to take and the composition survives at every width. Three AVIF widths (`-p-800`, `-p-1200`,
full — 23/40/54KB) ship behind a `srcset`, matching the other images here.

**The PNG ships as supplied — not re-encoded, not cropped, not retouched.** It is
`about-banner.png`, 1.85MB, referenced directly.

**Its top third is fully transparent**, which is the one thing you have to know about it. Read
as RGB it looks like a black vignette — the colour channels behind `alpha: 0` are zeros — so a
JPEG proof of it flattens to black and confirms the wrong answer. On the page the white
background shows straight through and the standing figure floats with no room around him.
**When an image looks like it has a black band, check `hasAlpha` before the pixels.**

So the wall it is missing is painted *behind* it, in `.studio-band_media`: a `linear-gradient`
whose stops are the photograph's own wall row sampled across its width, so it meets the
picture at the colour the picture ends on. A flat fill would not do — the wall is lit from the
left and drifts about 40 levels darker by the right edge. Framing is `object-fit: cover` with
`object-position: 50% 37%` rather than a cut file.

Two known costs of leaving the file alone, both fine to accept and both fixable in the source
image if they ever matter:

- **1.85MB**, against roughly 60KB for the same picture as AVIF. It is below the fold and
  lazy-loaded, so it costs nothing until scrolled to.
- **A faint horizontal line** where the PNG's own wall begins. That is a one-pixel bright
  fringe left by the matte in the file (green jumps 165 → 179 → 169), not the CSS join.

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
index.html  about.html  services.html  portfolio.html
blog.html   contact.html  legal-notice.html  policy.html
src/
  critical.css  inlined into every <head> — see below
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
    components/   preloader, page-transition, anchors, icons,
                  contact-form, blog-filters
    animations/   nav, marquee, button-brackets, reveals, card-stack, pulse
    three/        nebula-sphere.js
    utils/        env.js (breakpoints), viewport.js (--vh)
    main.js       boot sequence
  assets/         fonts, images, icons
```

The legal pages' header and footer are generated from `index.html` rather than maintained by
hand, so the three pages cannot drift out of sync.

### Critical CSS (`src/critical.css`)

The stylesheet is imported by the bundle (`import '../scss/main.scss'` in `main.js`). A
production build extracts that to a render-blocking `<link>`, so the first frame is already
styled — but **in dev there is no link at all.** Vite injects the CSS from JavaScript, and a
module script is deferred, so the browser paints the raw document first: images at natural
size, the skip link above the header, the preloader's mark as twelve solid black paths. The
covers that exist to prevent that are themselves in the stylesheet, so they cannot prevent
their own absence.

`src/critical.css` holds only those covers — `.page-transition`, `.preloader`, `.skip-link`
and the couple of things that would paint on top of them — and the `aythronix-critical-css`
plugin in `vite.config.js` inlines it into every page's `<head>`, right after the `no-js`
script. Same result in dev and in production: the first frame is the covered one.

Two rules keep it from becoming a second source of truth:

- **It is injected before the bundle's stylesheet**, so every declaration in it loses to the
  real rule once that arrives. Nothing in `critical.css` can pin a value the stylesheet
  later changes.
- **It covers, it does not style.** Everything underneath the cover can wait for the
  stylesheet, because nobody can see it. Resist growing this into an above-the-fold extract.

Colours are literals rather than tokens — the tokens live in the stylesheet that has not
arrived yet — and are kept in step with `scss/base/_tokens.scss` by hand.

A new page needs the inline `no-js` script in its `<head>`; the build throws if it is
missing rather than shipping a page that flashes.

### The page transition (inner pages)

Five full-height columns that drop in from above to cover the viewport, then lift back out
through the top on the next page — each starting a tenth of a second after the one to its
left, so the edge reads as a rake rather than a straight line.

| | Motion | Timing |
| --- | --- | --- |
| leaving | `y -100% → 0%`, then navigate | 0.85s, 0.1s stagger, `power2.inOut` |
| arriving | `y 0% → -100%` | 1.05s, 0.1s stagger, `power2.inOut` |

This is the transition from `sangiorgiomanpowersolutions.com`, matched: same panel count,
stagger, curve and durations, taken from that build's own compiled output. Only the colour
differs — its dark navy against this site's brand blue, which is what the preloader already
resolves to.

**It costs 1.25s per internal click.** The last column does not land until
`0.85 + 4 × 0.1`, and the navigation waits for it. Turn `STAGGER` or `COVER_DURATION` down
in `js/components/page-transition.js` if that starts to feel slow.

The columns are `flex: 1 1 0` with a 1px overlap. Five flex items at a fractional width
(1366 / 5 = 273.2) land on subpixel boundaries, and a transform animating across those can
leave hairline seams of the page showing through a cover that is meant to be solid.

**Stacking order.** The covers have to be above everything, including the fixed header:

| z-index | |
| --- | --- |
| 1000 | `.nav_component` |
| 1100 | `.page-transition` |
| 1200 | `.preloader` — so a cold home load shows the preloader, not the transition |
| 1300 | `.skip-link` — focus-only, must never be obscured |

The header used to be the highest layer of the four, so it stayed painted on top of a
full-screen transition and rode across every navigation.

### Boot order (`src/js/main.js`)

1. `--vh` is published before anything measures a full-viewport box.
2. Lenis comes up before any ScrollTrigger-backed animation, so triggers register against
   the right scroller.
3. The preloader locks scroll immediately and releases it on completion.
4. The hero's backdrop and its sphere are both **built behind the panel and started after
   it** — construction is expensive and slow, running is expensive and fast, so the cost of
   the first goes where nobody can see it and the second waits until it is not competing
   with the intro. Both take `autoStart: false` and are released by `start()`.
5. Everything else the hand-over triggers runs one step per frame via `runAcrossFrames`.

### Scroll is locked from the head, not from the bundle

`index.html` adds `is-locked` to `<html>` from a second inline script in its head, and the
rule that backs it is in `critical.css`. The `stopScroll()` that used to be the only lock
lives inside `initPreloader`, which is downstream of a deferred module *and* the dynamic
import of Lenis — so on a cold load there was a window, as long as those chunks took, where
the visitor was looking at the preloader and could still scroll the page behind it.

Two consequences worth keeping in mind:

- **The preloader is the only thing that unlocks it.** `initSmoothScroll()` is therefore
  wrapped in a `.catch` in `main.js`: a failed Lenis chunk must not leave a page nobody can
  scroll. Lenis also comes up stopped if the lock is already on.
- **`.preloader` is `100vw`, not `100%`.** `html` carries `scrollbar-gutter: stable`, so the
  gutter stays reserved while the lock is on but has no scrollbar in it. A `100%` fixed
  element resolves against the initial containing block, which excludes that gutter, and left
  a scrollbar-shaped strip of bare page down the side of the panel.

### Fonts are `block`, and the preloader waits for them

`font-display: swap` paints the fallback and re-renders when the real face lands. Mondwest
standing in as Times New Roman is not a refinement — it is the page changing typeface in
front of the visitor, taking the H1's line breaks and every label's width with it, right as
the hero appears.

All four faces are `font-display: block` instead, and `waitForLoad()` in the preloader waits
on `document.fonts.ready` as well as `load` — `load` does not cover fonts, which are fetched
lazily from CSS. The block period therefore happens behind the panel. `LOAD_TIMEOUT` is 3s to
match the browser's block period exactly: if a font never arrives, the fallback paints at the
same moment the panel lifts, so the worst case is a page in Arial rather than a page with
holes in it. **Move one and you have to move the other.**

### Why the hand-over used to stutter

Two things landed on the single frame the preloader lifts on, and between them they are most
of what "the hero glitches for a second" meant:

- **A layout jump.** Scroll is locked with `overflow: hidden` on `html`, which takes the
  scrollbar with it. Releasing it handed ~15px of width back and then took it away again, so
  every centred container and fixed element moved sideways at that exact moment.
  `scrollbar-gutter: stable` on `html` (`base/_reset.scss`) reserves the gutter permanently
  and the width never changes. Safari before 18.2 does not support it and gets the old
  behaviour.
- **A long task.** `initAfterReveal` built 3,500 hero particles and 1,400 orb particles, ran
  SplitText across every heading, booted Lottie and called `ScrollTrigger.refresh()`, all
  synchronously. The sphere moved behind the panel; the rest is spread a step per frame.
- **Two things that animated *into* view rather than being there already.** The sphere was
  built held, but a held sphere never drew — `_tick` returns early when it is not running —
  so 3,500 points appeared from an empty canvas on the frame the panel lifted.
  `paintStill()` draws its resting frame while held, so the ticker is handed to something
  already on screen. And the backdrop's 0.9s crossfade started on the renderer's first frame,
  which is the same frame the preloader stops waiting on — so it began under the panel and
  finished in front of the visitor. It is now gated behind `html.is-loaded`, which
  `initAfterReveal` stamps: no fade while nothing can be seen, and the fade is still there
  for the cases it was written for (a late scene, a restored WebGL context).

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

- ~28KB app JS, ~133KB GSAP, ~20KB Lenis. lottie-web (167KB) and Lenis are dynamic imports, so
  phones never fetch either — and lottie-web only loads once a glyph scrolls into view.
- The twelve glyph JSONs total ~120KB in `dist/`, but a page fetches only the two to four it
  actually shows. The generated ones are 1–3KB each; the four imported originals are 9–38KB,
  because a hand-exported icon carries precomps, null control layers and expressions that a
  generated one does not.
- **`jquery` is in `package.json` but imported nowhere.** `npm uninstall jquery` clears it and
  keeps the lockfile in step, which matters because the deploy runs `npm ci`.
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

