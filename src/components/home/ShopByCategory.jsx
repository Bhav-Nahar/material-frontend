import { CATEGORIES, LOOK_IMAGES } from "@/data/catalog";
import { getMenu, transformMenuData } from "@/lib/menus";
import CategorySheet from "./CategorySheet";

/**
 * Shop by category. Wakefit's arrangement, not Material Depot's: a flat grid of photo + label whose
 * tiles open a panel of sub-collections. Depot has two goes at this -- six small outlined CIRCLES
 * ("Explore our categories"), which §06's 2px radius rules out, and "Start With a room" (room tabs
 * filtering a tile row), which needs room-tagged collections we do not have.
 *
 * The sub-collections come from the SAME menu data the mega menu reads, so there is one tree to
 * keep current rather than a hand-written copy that drifts from the nav.
 *
 * CategoryRail still carries the small swatches above the hero on a phone; this is the shelf, and
 * it is the only place either width can reach a facet without going through the nav.
 *
 * ponytail: getMenu reads a static JSON import, so calling it here as well as in layout costs
 * nothing. Drop to CATEGORIES alone if that ever becomes a real fetch.
 */
export default async function ShopByCategory({ title = "Shop by category" }) {
  if (CATEGORIES.length === 0) return null;

  const menu = transformMenuData(await getMenu());

  // Menu hrefs are Shopify's, stripped to a path by transformMenuData; match on the handle rather
  // than on the title, which is what the merchandiser edits.
  const categories = CATEGORIES.map((category) => {
    const columns = menu.find((m) => m.href === `/collections/${category.handle}`)?.columns ?? [];

    // ONE column, the visual one: "Shop by look" for tiles and laminates, "Shop by pattern" for
    // wallpaper. Room, finish, size and use are word facets -- they have nothing to photograph, and
    // the mega menu already carries all four for anyone who wants them.
    const looks = columns.find((c) => /look|pattern/i.test(c.title));

    return {
      ...category,
      lookTitle: looks?.title ?? null,
      looks: (looks?.items ?? []).map((item) => ({
        ...item,
        image: LOOK_IMAGES[item.label] ?? category.image,
      })),
    };
  });

  return (
    // No top pad: the section above already closes with one, and two stacked read as a gap twice
    // the size either intends. One section owns the space between them, and every home section
    // spends the SAME pb-4 at every width -- one 16px rhythm, not the 6/6/10/12 ladder it grew by
    // accident. No lg: variant on purpose; the gap is the same on a phone and a desktop.
    <section aria-labelledby="shop-by-category" className="container-main pb-4">
      {/* The heading is a prop because the PDP mounts this same block as "Explore our range" --
          on a product page "shop by category" reads like the nav, and the shelf is doing a
          different job there: it is the way out of a dead end, not a way in. */}
      <h2 id="shop-by-category" className="mb-4 text-xl lg:mb-5 lg:text-2xl">
        {title}
      </h2>

      <CategorySheet categories={categories} />
    </section>
  );
}
