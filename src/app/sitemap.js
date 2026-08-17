import { storefront } from '@/lib/products';
import { BLOG_HANDLE } from '@/lib/blog';

/**
 * The list of URLs we are asking to be indexed.
 *
 * ONE Storefront request for the whole catalogue, not four. Products, collections, policy pages and
 * guides are all reachable from the same GraphQL root, so asking for them separately would cost
 * four round trips to build one file. `updatedAt` comes back on the same nodes, which is the point
 * of reading them from Shopify at all -- a sitemap with no lastmod tells a crawler nothing it
 * couldn't guess, and a lastmod invented at build time ("now") is a lie that trains crawlers to
 * ignore the field.
 *
 * WHAT IS DELIBERATELY ABSENT: /account/*, /checkout/*, /login and /api/*. They are behind a login,
 * personal, or not pages at all -- and robots.js disallows the same set. Listing a URL in the
 * sitemap while disallowing it in robots.txt is the single most common way to earn a Search Console
 * warning, so those two files have to agree; if you add a private route, edit both.
 *
 * WHY NO priority/changeFrequency. Google has said since 2023 that it ignores both. They exist in
 * the protocol, cost a line each to invent, and would be maintained forever for no reader.
 *
 * ponytail: first 250 products/collections, 100 articles -- one page of results each, which is what
 * one request buys. The store has nothing near those numbers. Paginate with `pageInfo`/`after` when
 * a count actually approaches the cap; until then the cursor loop is code that can only be wrong.
 * A sitemap must not exceed 50,000 URLs, so the real ceiling is far above these anyway.
 */

const SITEMAP_QUERY = `
  query Sitemap($blog: String!) {
    products(first: 250, query: "published_status:published") {
      nodes { handle updatedAt }
    }
    collections(first: 250) {
      nodes { handle updatedAt }
    }
    pages(first: 50) {
      nodes { handle updatedAt }
    }
    blog(handle: $blog) {
      articles(first: 100, sortKey: PUBLISHED_AT, reverse: true) {
        nodes { handle publishedAt }
      }
    }
  }
`;

/**
 * A day, matching the catalogue's own cache in lib/products.js. A sitemap that regenerates faster
 * than the pages it points at is describing something that isn't there yet.
 *
 * Written out as a literal below in `export const revalidate` as well as being held here: Next
 * parses segment config exports STATICALLY, so `export const revalidate = REVALIDATE` fails the
 * build with "Invalid segment configuration export" even though the value is a constant. The two
 * have to be kept the same by hand; there is no way to reference one from the other.
 */
const REVALIDATE = 86400;
export const revalidate = 86400;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Routes that exist in the file tree rather than in Shopify. Hand-listed because there are five of
 * them and Next gives no API to enumerate its own static routes -- a directory walk would be more
 * code than the list it replaces, and would happily index /login.
 *
 * /pages/faqs is here and NOT covered by the pages(first: 50) block: it is its own route file that
 * reads a Shopify page and reshapes it into an FAQ, so Shopify's own handle for it would 404.
 */
const STATIC_ROUTES = ['/', '/blog', '/pages/faqs'];

/** Shopify timestamps are ISO strings; Next wants something Date-shaped, and tolerates a bad one badly. */
function lastModified(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
}

function entries(nodes, prefix, stamp = 'updatedAt') {
  return (nodes ?? []).map((node) => ({
    url: `${SITE}${prefix}/${node.handle}`,
    lastModified: lastModified(node[stamp]),
  }));
}

export default async function sitemap() {
  const data = await storefront('sitemap', SITEMAP_QUERY, { blog: BLOG_HANDLE }, REVALIDATE);

  // storefront() returns null on any failure. A sitemap listing only the static routes is a worse
  // sitemap; one that throws is a 500 on a URL Google polls daily, which is worse still.
  return [
    ...STATIC_ROUTES.map((path) => ({
      url: `${SITE}${path}`,
      lastModified: new Date(),
    })),
    ...entries(data?.products?.nodes, '/products'),
    ...entries(data?.collections?.nodes, '/collections'),
    ...entries(data?.pages?.nodes, '/pages'),
    ...entries(data?.blog?.articles?.nodes, '/blog', 'publishedAt'),
  ];
}
