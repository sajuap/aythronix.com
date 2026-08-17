import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Inlines src/critical.css into every page's <head>.
 *
 * The stylesheet is imported by the bundle, so in dev it is injected from
 * JavaScript and does not exist at the first paint — the browser shows one frame
 * of raw document before it lands. The covers that exist to prevent that are
 * themselves in the stylesheet, so they cannot prevent their own absence. See
 * the header of critical.css for the full reasoning.
 *
 * Placed immediately after the inline `no-js` script, which is already inline
 * and parser-blocking for exactly this reason. That also puts it ahead of the
 * bundle's own stylesheet — Vite appends that at the end of <head> — so every
 * critical declaration loses to the real rule once it arrives.
 *
 * Both failure modes throw rather than degrading quietly: a missing file or a
 * page without the anchor would otherwise produce a build that looks fine and
 * flashes on load, which is the bug this exists to fix.
 */
function inlineCriticalCss() {
  const ANCHOR = "<script>document.documentElement.classList.remove('no-js');</script>";
  const source = resolve(__dirname, 'src/critical.css');

  return {
    name: 'aythronix-critical-css',

    // `pre`, so the tags Vite injects itself are not in the string we search.
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // Read per page rather than once at config time: in dev this handler
        // runs on every request, so an edit to critical.css is picked up by a
        // reload instead of needing the server restarted.
        const css = readFileSync(source, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();

        if (!html.includes(ANCHOR)) {
          throw new Error(
            `[critical-css] ${ctx.path} has no no-js script to anchor to. ` +
              'Copy the inline <script> from index.html into its <head>.'
          );
        }

        return html.replace(ANCHOR, `${ANCHOR}\n    <style>\n${css}\n    </style>`);
      },
    },
  };
}

export default defineConfig({
   plugins: [inlineCriticalCss()],

  root: '.',
  publicDir: 'public',
  base: './',

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@scss': resolve(__dirname, 'src/scss'),
      '@js': resolve(__dirname, 'src/js'),
      '@assets': resolve(__dirname, 'src/assets'),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 still uses @import and the legacy colour functions;
        // silence only those so our own real warnings stay visible.
        silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
        quietDeps: true,
      },
    },
    devSourcemap: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    target: 'es2019',
    rollupOptions: {
      // Every page has to be listed here — a multi-page Rollup build only emits
      // the entries it is given, so an HTML file left out of this map is simply
      // absent from dist and 404s in production while working fine in dev.
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        services: resolve(__dirname, 'services.html'),
        portfolio: resolve(__dirname, 'portfolio.html'),
        blog: resolve(__dirname, 'blog.html'),
        // One detail page standing in for every post. A real blog needs one
        // entry per article here — see the note at the top of its <main>.
        blogPost: resolve(__dirname, 'blog-post.html'),
        contact: resolve(__dirname, 'contact.html'),
        legal: resolve(__dirname, 'legal-notice.html'),
        policy: resolve(__dirname, 'policy.html'),
      },
      output: {
        manualChunks: {
          gsap: ['gsap', 'gsap/ScrollTrigger', 'gsap/ScrollToPlugin', 'gsap/SplitText', 'gsap/CustomEase'],
          // `jquery` is deliberately not here: nothing imports it, and a name in
          // this list that is not in the module graph is silently a no-op, which
          // is how it sat here unnoticed. It can come out of package.json too.
          vendor: ['lenis', 'lottie-web'],
        },
        assetFileNames: (info) => {
          const name = info.name || '';
          if (/\.(woff2?|ttf|otf|eot)$/i.test(name)) return 'assets/fonts/[name]-[hash][extname]';
          if (/\.(png|jpe?g|avif|webp|gif|svg)$/i.test(name)) return 'assets/img/[name]-[hash][extname]';
          if (/\.css$/i.test(name)) return 'assets/css/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
  },

  server: {
    port: 5173,
    open: true,
    host: true,
    proxy: {
      '/send-mail.php': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 4173,
  },
});
