# Aythronix logo exports

PNG exports of the marks in `src/assets/icons/`. The SVGs there are the source —
these are for places that cannot take one: decks, documents, app stores, social
profiles, anyone asking for "the logo as a PNG".

All are transparent except the app icons.

## Primary — the mark alone

The symbol on its own, 2000 × 2000, 12% clear space.

| File | Use |
| --- | --- |
| `aythronix-mark.png` | Brand blue. The default. |
| `aythronix-mark-white.png` | On the navy sections, photographs, any dark ground. |

## Secondary — the lockup

Mark and wordmark side by side, 3200 × 760, 10% clear space. Use this wherever
the name has to be read, which is most places the primary mark is not.

| File | Use |
| --- | --- |
| `aythronix-lockup.png` | Brand blue. |
| `aythronix-lockup-white.png` | On dark. |

## Construction

The mark over the grid it is built on, 2400 × 2400.

| File | |
| --- | --- |
| `aythronix-mark-construction.png` | Mark held back so the guides read across it. |
| `aythronix-mark-construction-blue.png` | Same sheet at full strength. |

The grid is not decoration. Its module is the mark's own stroke width, measured
off the artwork by scanline rather than chosen: 1,985 of 2,000 horizontal cuts
through the shape return the same width. Everything else on the sheet is a
multiple of that module, and the mark comes out **5.05 × 5.21 modules**.

So the sheet is checkable. If a redraw ever stops landing on those lines, the
drawing has moved, not the grid.

## Favicon

The mark at browser-tab sizes, tighter margins so it still reads small.

`aythronix-favicon-512.png`, `-180.png`, `-64.png`, `-32.png`

180 is the iOS home-screen size; 32 is the tab. The site itself serves
`src/assets/icons/logo-mark.svg` and does not need these — they are for anything
that will not take an SVG.

## App icon

White mark on a brand-blue rounded tile, the way an installed app wants it.

`aythronix-app-icon-1024.png`, `-512.png`

1024 is what the app stores ask for.

## Colours

| | Hex | |
| --- | --- | --- |
| Brand blue | `#0765EB` | The logo colour, straight off the source SVG. |
| White | `#FFFFFF` | Reversed, on dark. |

Those two only. There is no navy logo — the mark is blue.

## Regenerating

These are rendered from the SVGs rather than drawn, so they never drift from the
source. If the logo changes, re-export rather than editing a PNG.
