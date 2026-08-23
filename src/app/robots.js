const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * robots.txt.
 *
 * ONE wildcard group, and that is the whole AEO position: GPTBot, ClaudeBot, PerplexityBot,
 * OAI-SearchBot, Google-Extended, Applebot-Extended and every other answer-engine crawler are
 * allowed here, because `User-agent: *` already allows them and we are choosing not to opt out. A
 * shop that wants to be the source an assistant cites has no reason to block the crawlers doing the
 * citing.
 *
 * WHY NOT LIST THEM INDIVIDUALLY, which is the usual advice: a named group REPLACES the wildcard
 * group for that agent rather than adding to it. Nine named groups means the /account and /checkout
 * disallows have to be repeated nine times, and the first one someone forgets to update is a
 * crawler walking someone's order history. One group cannot drift out of sync with itself. Add a
 * named group only to say something DIFFERENT about a specific bot -- a block, or a crawlDelay.
 *
 * The disallow list must match what sitemap.js omits. Same set, two files, no third place.
 *
 * ponytail: no crawlDelay and no per-bot throttling. Add one if a crawler ever shows up in the logs
 * as a load problem; guessing at it now just slows down indexing for free.
 */
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account/', // behind a login; personal
        '/checkout/', // a cart is one person's, and half of it is client state anyway
        '/login',
        '/api/', // endpoints, not pages
        '/search', // results are for the searcher; the page also sets noindex
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
    // Which of several domains is the real one. Only meaningful once the site is not on localhost.
    host: SITE,
  };
}
