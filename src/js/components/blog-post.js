/**
 * The article page, filled from `?post=<slug>`.
 *
 * blog-post.html is one template rather than seven pages. Every card on the
 * listing points at it with a slug, and this reads that slug out of the query and
 * writes the post into the page: title, lead, meta line, cover, body, author,
 * share links, and the three related cards at the foot.
 *
 * A slug that names nothing — a stale link, a typo, someone arriving at
 * `blog-post.html` bare — gets the featured post rather than an empty page. There
 * is no such thing as a broken article URL here, only one that lands somewhere
 * else.
 *
 * The head is updated too. `document.title`, the description and the canonical
 * are what a share or a bookmark carries, and leaving all seven posts sharing one
 * title is the kind of thing nobody notices until the link is already out.
 */

import { POSTS, findPost } from '../data/posts.js';

/** Fill an element's text, if the page has one. */
function setText(root, selector, value) {
  const el = root.querySelector(selector);
  if (el) el.textContent = value;
}

/** Point a `<head>` tag at a new value, creating nothing that is not already there. */
function setMeta(selector, attr, value) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

/**
 * Build one listing card. The same markup the blog and portfolio grids use, so
 * the hover zoom and the lift come along without anything being restated.
 */
function card(post) {
  const link = document.createElement('a');
  link.className = 'post-card';
  link.href = `blog-post.html?post=${encodeURIComponent(post.slug)}`;

  link.innerHTML = `
    <div class="post-card_thumb">
      <img src="${post.card.src}" width="800" height="500" loading="lazy" decoding="async" alt="${post.card.alt}" />
    </div>
    <div class="label-chip is-small">${post.category}</div>
    <div class="post-card_title">${post.title}</div>
    <p class="post-card_excerpt">${post.excerpt}</p>
  `;

  return link;
}

export function initBlogPost() {
  const article = document.querySelector('[data-post]');
  if (!article) return;

  const slug = new URLSearchParams(window.location.search).get('post');
  const post = findPost(slug);

  // --- The page itself ---------------------------------------------------

  setText(article, '[data-post-title]', post.title);
  setText(article, '[data-post-lead]', post.lead);
  setText(article, '[data-post-date]', post.date);
  setText(article, '[data-post-category]', post.category);
  setText(article, '[data-post-readtime]', post.readTime);
  setText(article, '[data-post-author]', post.author.name);
  setText(article, '[data-post-author-bio]', post.author.bio);

  const cover = article.querySelector('[data-post-cover]');
  if (cover) {
    cover.src = post.cover.src;
    cover.alt = post.cover.alt;
  }

  const time = article.querySelector('[data-post-datetime]');
  if (time) time.setAttribute('datetime', post.dateISO);

  // Authored here, never from a visitor — see the note at the top of
  // data/posts.js.
  const prose = article.querySelector('[data-post-body]');
  if (prose) prose.innerHTML = post.body;

  // --- The head ----------------------------------------------------------

  const url = `https://www.aythronix.com/blog-post?post=${post.slug}`;

  document.title = `${post.title} | Aythronix`;
  setMeta('meta[name="description"]', 'content', post.lead);
  setMeta('link[rel="canonical"]', 'href', url);

  // --- Sharing -----------------------------------------------------------
  //
  // Both links carried this page's bare address, so every article shared as the
  // same one.
  const share = encodeURIComponent(url);
  const text = encodeURIComponent(post.title);

  const linkedin = article.querySelector('[data-share="linkedin"]');
  if (linkedin) linkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${share}`;

  const x = article.querySelector('[data-share="x"]');
  if (x) x.href = `https://x.com/intent/tweet?url=${share}&text=${text}`;

  // --- Keep reading ------------------------------------------------------
  //
  // Three others, nearest first in the order they were published, and never the
  // one already open.
  const related = document.querySelector('[data-post-related]');
  if (related) {
    related.replaceChildren(
      ...POSTS.filter((other) => other.slug !== post.slug)
        .slice(0, 3)
        .map(card)
    );
  }
}
