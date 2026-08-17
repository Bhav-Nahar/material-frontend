import { storefront } from "./products";

/**
 * Policy and information pages, written in Shopify admin and rendered here.
 *
 * WHY SHOPIFY HOLDS THE WORDS. A returns policy is edited by whoever answers the phone about
 * returns, not by whoever can run a deploy. Keeping the copy in Shopify means the breakage rule can
 * be corrected in a minute, and the version customers read is the version the business agreed to.
 *
 * UNPUBLISHED PAGES DO NOT EXIST here: the Storefront API only returns published ones, so a draft
 * policy 404s rather than leaking half-written terms. That is the behaviour we want -- see
 * material-backend/scripts/seed-policy-pages.js, which deliberately creates them hidden.
 */
const PAGE_QUERY = `
  query Page($handle: String!) {
    page(handle: $handle) {
      title
      handle
      body
      bodySummary
      updatedAt
      seo { title description }
    }
  }
`;

const PAGE_HANDLES = `
  query PageHandles { pages(first: 50) { nodes { handle } } }
`;

// Ten minutes, not the catalogue's day. A policy correction -- a wrong phone number, a bad
// threshold -- should reach customers in the time it takes to make tea, and these pages are read
// rarely enough that the extra requests cost nothing.
const REVALIDATE = 600;

export async function getPage(handle) {
  const data = await storefront("page", PAGE_QUERY, { handle }, REVALIDATE);
  return data?.page ?? null;
}

/**
 * Splits the FAQ page's body into sections of questions, so /pages/faqs can render an accordion
 * instead of a 60-question wall of prose.
 *
 * THE CONTRACT, and it is a real one: <h2> starts a section, <h3> is a question, everything until
 * the next heading is its answer. That shape is written into a comment at the top of the `faqs`
 * entry in material-backend/scripts/seed-policy-pages.js, because whoever edits the page in Shopify
 * has to keep it.
 *
 * ponytail: string splitting, not a DOM parser. The input is one page we author against a shape we
 * fixed; jsdom to read our own headings would be a dependency to avoid two `split()` calls. If this
 * ever has to survive arbitrary merchant HTML, that is the day to reach for a parser.
 */
const stripTags = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .trim();

export function parseFaqSections(body) {
  if (!body) return { lead: "", sections: [] };

  const [lead, ...chunks] = body.split(/<h2[^>]*>/i);

  const sections = chunks.map((chunk) => {
    const [heading, rest = ""] = chunk.split(/<\/h2>/i);
    const [intro, ...questions] = rest.split(/<h3[^>]*>/i);

    return {
      heading: stripTags(heading),
      // The closing section is a single paragraph with no questions under it; it renders as prose.
      intro: intro.trim(),
      items: questions.map((q) => {
        const [question, answer = ""] = q.split(/<\/h3>/i);
        return { question: stripTags(question), answer: answer.trim() };
      }),
    };
  });

  return { lead: lead.trim(), sections };
}

export async function getPageHandles() {
  const data = await storefront("page-handles", PAGE_HANDLES, {}, REVALIDATE);
  return (data?.pages?.nodes ?? []).map((n) => n.handle);
}
