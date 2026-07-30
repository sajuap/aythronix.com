/**
 * Looping Lottie glyphs in the milestones list.
 *
 * Four of them, all `loop: 1, autoplay: 1, renderer: svg` in the reference.
 * lottie-web is imported lazily and only when a player is actually needed, and
 * each animation is created on intersection rather than up front — four SVG
 * players decoding during the intro is a measurable hit for something below the
 * fold.
 */

/**
 * Resolve the animation JSON through the bundler.
 *
 * These files are referenced from a `data-lottie` attribute, which the HTML
 * pipeline does not rewrite the way it rewrites `src`/`srcset` — a literal
 * `/src/assets/...` path in the markup builds fine and then 404s in production.
 * Globbing them here gives real hashed URLs, and the markup only carries a name.
 */
const LOTTIE_URLS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/lottie/*.json', {
      eager: true,
      query: '?url',
      import: 'default',
    })
  ).map(([path, url]) => [path.split('/').pop().replace(/\.json$/, ''), url])
);

let lottiePromise = null;

function loadLottie() {
  if (!lottiePromise) {
    // The light build: SVG renderer only, which is all these need.
    lottiePromise = import('lottie-web/build/player/lottie_light.min.js').then(
      (m) => m.default || m
    );
  }
  return lottiePromise;
}

export function initLottieIcons() {
  const hosts = document.querySelectorAll('[data-lottie]');
  if (!hosts.length) return;

  const players = new Map();

  const create = async (host) => {
    if (players.has(host)) return;
    players.set(host, null); // claim the slot before the await

    const name = host.dataset.lottie;
    const src = LOTTIE_URLS[name];

    if (!src) {
      console.warn('[lottie] no animation bundled under the name', name);
      return;
    }

    try {
      const lottie = await loadLottie();
      const anim = lottie.loadAnimation({
        container: host,
        renderer: 'svg',
        loop: host.dataset.lottieLoop !== 'false',
        autoplay: true,
        path: src,
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
          progressiveLoad: true,
        },
      });
      players.set(host, anim);
    } catch (err) {
      // A missing glyph should not take the page down — the bracketed square it
      // sits in still reads fine empty.
      console.warn('[lottie] could not load', src, err);
    }
  };

  if (typeof IntersectionObserver === 'undefined') {
    hosts.forEach(create);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const anim = players.get(entry.target);
        if (entry.isIntersecting) {
          if (players.has(entry.target)) anim?.play();
          else create(entry.target);
        } else {
          anim?.pause();
        }
      });
    },
    { rootMargin: '200px' }
  );

  hosts.forEach((host) => io.observe(host));
}
