import { storefront } from "./products";

/**
 * Guides -- articles written in Shopify admin (Content > Blog posts) and rendered here, exactly
 * like the policy pages in lib/pages.js and for the same reason: whoever knows how tiles are laid
 * should be able to publish that without a deploy.
 *
 * ONE BLOG. Shopify allows many and names URLs /blogs/<blog>/<article>; we read a single blog and
 * serve /blog/<article>, because two blogs is a merchandising decision nobody has made. If a
 * second one is ever created, this constant becomes an argument -- that is the whole change.
 *
 * The store ships with a default blog handled `news`. Rename the handle in Shopify and this line
 * has to follow it.
 */
export const BLOG_HANDLE = "news";

const ARTICLES_QUERY = `
  query Articles($handle: String!, $first: Int!) {
    blog(handle: $handle) {
      articles(first: $first, sortKey: PUBLISHED_AT, reverse: true) {
        nodes {
          handle
          title
          excerpt
          publishedAt
          image { url altText width height }
        }
      }
    }
  }
`;

const ARTICLE_QUERY = `
  query Article($blog: String!, $handle: String!) {
    blog(handle: $blog) {
      articleByHandle(handle: $handle) {
        handle
        title
        excerpt
        contentHtml
        publishedAt
        image { url altText width height }
        seo { title description }
      }
    }
  }
`;

// Ten minutes, matching the policy pages: editorial copy is corrected in place often enough that a
// day-long cache means a typo outlives the working day, and these pages are read rarely enough that
// revalidating costs nothing.
const REVALIDATE = 600;

/**
 * Newest first. Returns [] when nothing is published -- callers render nothing rather than an empty
 * shelf, so an unwritten blog is invisible instead of broken.
 *
 * `revalidate` is an argument because Next takes the SHORTEST fetch lifetime on a page as the
 * page's own. The footer runs on every route, so this list at ten minutes silently re-cut the
 * homepage from a day to ten minutes and dragged checkout and account down with it. The footer and
 * the homepage strip pass a day; only the blog's own pages want the short one.
 */
export async function getArticles(first = 12, revalidate = REVALIDATE) {
  const data = await storefront("articles", ARTICLES_QUERY, { handle: BLOG_HANDLE, first }, revalidate);
  return data?.blog?.articles?.nodes ?? [];
}

export async function getArticle(handle) {
  const data = await storefront("article", ARTICLE_QUERY, { blog: BLOG_HANDLE, handle }, REVALIDATE);
  // Unpublished articles come back null from the Storefront API, same as unpublished pages: a draft
  // 404s rather than leaking a half-written guide.
  return data?.blog?.articleByHandle ?? null;
}
