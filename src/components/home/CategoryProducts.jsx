import { CATEGORIES } from "@/data/catalog";
import { getMenu, transformMenuData } from "@/lib/menus";
import { getCollectionProducts } from "@/lib/products";
import CategoryProductTabs from "./CategoryProductTabs";

/**
 * One category's best sellers, with look tabs above them. GlassQuick's homepage arrangement: a
 * section per category ("Best Selling Mirrors", "New Arrivals / Doors") rather than one mixed
 * bestseller shelf -- a customer shopping tiles does not care that a laminate outsold them.
 *
 * The tabs are the SAME look/pattern facet the Shop by category sheet uses, read from the same menu
 * data, so the two cannot disagree about what looks exist.
 *
 * ponytail: one section, wired for `handle` and `title`. Once tiles reads right, laminates and
 * wallpaper are two more lines in page.js -- no new component. "New arrivals" is the same section
 * with a different heading for the same reason.
 */
export default async function CategoryProducts({ handle, title, first = 24 }) {
  const category = CATEGORIES.find((c) => c.handle === handle);
  if (!category) return null;

  const heading = title ?? `Top selling ${category.title.toLowerCase()}`;
  // Derived from the heading, not the handle: the page renders this section twice off the SAME
  // collection, and two `best-tiles` ids on one document is a duplicate-id bug that breaks the
  // aria-labelledby on whichever one loses.
  const headingId = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const products = await getCollectionProducts(handle, first);
  if (products.length === 0) return null;

  const menu = transformMenuData(await getMenu());
  const looks =
    menu
      .find((m) => m.href === `/collections/${handle}`)
      ?.columns.find((c) => /look|pattern/i.test(c.title))
      ?.items.map((i) => i.label) ?? [];

  // Only looks that actually have stock behind them. GlassQuick shows every chip whether or not it
  // filters to anything; a tab that empties the shelf is a dead end, so those are dropped here
  // rather than left for the customer to find.
  const tabs = looks.filter((look) => products.some((p) => hasTag(p, look)));

  return (
    // pt because both places this section is used sit under a full-bleed band that owns no outer
    // space -- the WhyMaterial strip above the top-selling shelf, the HelpMeChoose banner above
    // New arrivals. Everything else on the page is pb-only; see ShopByCategory.
    <section aria-labelledby={headingId} className="container-main pt-6 pb-6">
      <div className="mb-5 flex items-baseline justify-between gap-4 lg:mb-6">
        <h2 id={headingId} className="text-xl lg:text-2xl">
          {heading}
        </h2>
        {/* Kept as a link rather than GlassQuick's filled "View All" button: §06 reserves fills for
            the one primary action on a page, and a shelf heading is not it.

            Reads "Shop all" -- naming the category was redundant beside "Top selling tiles" and
            wrong beside "New arrivals", which is not a tiles heading. The aria-label keeps the
            accessible name specific, because a screen reader listing links out of context gets a
            page of identical "Shop all"s otherwise. */}
        <a
          href={`/collections/${handle}`}
          aria-label={`Shop all ${category.title.toLowerCase()}`}
          className="shrink-0 text-xs font-medium text-action-ink underline decoration-line-strong underline-offset-4 hover:decoration-current lg:text-sm"
        >
          Shop all
        </a>
      </div>

      <CategoryProductTabs products={products} tabs={tabs} />
    </section>
  );
}

/** Case-insensitive so "wood-look" and "Wood-look" both match the menu's label. */
function hasTag(product, tag) {
  return (product.tags ?? []).some((t) => t.toLowerCase() === tag.toLowerCase());
}
