import Image from "next/image";
import Link from "next/link";
import { CATEGORIES, LOOK_IMAGES } from "@/data/catalog";
import { getMenu, transformMenuData } from "@/lib/menus";

/**
 * Trending collections. Material Depot's arrangement: a centred heading over square cards with
 * centred captions, and a list that deliberately CROSSES materials -- theirs runs Subway Tiles,
 * Highlighter Tiles, Marble Laminates, Wooden Louvers, Wallpapers.
 *
 * The centring is the point of the section as much as the content. Every other heading on this page
 * is flush left with its "see all" link flung to the right, and by the fifth one the eye has learnt
 * where to skip. Depot centres this one and it stops the scroll for that reason alone.
 *
 * Same look/pattern facet as the Shop by category sheet, read from the same menu, so the two cannot
 * disagree about what looks exist -- but sliced the other way: the sheet is one category's looks
 * behind a tap, this is every category's looks laid flat.
 *
 * ponytail: "trending" is MENU ORDER interleaved across the three materials, not traffic. Nothing
 * in the project measures what is actually trending, and a hand-typed list would be a second copy
 * of labels the menu already owns. When there is real data, this is the one function to change --
 * sort `perCategory` by it, or replace this with a curated array beside ROOM_PICKS, which is where
 * the other un-derivable merchandising already lives.
 */
export default async function TrendingCollections({ limit = 8 }) {
  const menu = transformMenuData(await getMenu());

  const perCategory = CATEGORIES.map((category) => {
    // "Shop by look" for tiles and laminates, "Shop by pattern" for wallpaper -- the visual facet.
    // Room, size and finish are word facets with nothing to photograph.
    const column = menu
      .find((m) => m.href === `/collections/${category.handle}`)
      ?.columns?.find((c) => /look|pattern/i.test(c.title));

    return (column?.items ?? []).map((item) => ({
      label: item.label,
      href: item.href,
      material: category.title,
      image: LOOK_IMAGES[item.label] ?? category.image,
    }));
  });

  // Round-robin, one from each material in turn. Taking the first eight in menu order instead gives
  // eight tile looks and no laminate or wallpaper at all, which reads as a tiles shelf mislabelled.
  const collections = [];
  for (let depth = 0; collections.length < limit; depth++) {
    const before = collections.length;
    for (const list of perCategory) {
      if (list[depth] && collections.length < limit) collections.push(list[depth]);
    }
    // Every category ran out. Without this the loop never ends when limit exceeds what exists.
    if (collections.length === before) break;
  }

  if (collections.length === 0) return null;

  return (
    <section aria-labelledby="trending-collections" className="container-main pb-6">
      <h2 id="trending-collections" className="mb-6 text-center text-xl lg:mb-8 lg:text-2xl">
        Trending collections
      </h2>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {collections.map((collection) => (
          <li key={collection.href}>
            <Link href={collection.href} prefetch={false} className="group block">
              {/* Square, like Depot's. The caption centred beneath rather than flush left is what
                  keeps the card reading as part of a centred section. */}
              <span className="relative block aspect-swatch overflow-hidden rounded-sm border border-line bg-surface">
                <Image
                  src={collection.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 300px, 45vw"
                  className="object-cover"
                />
              </span>
              <span className="mt-3 block text-center text-sm text-ink underline-offset-4 group-hover:underline lg:text-base">
                {collection.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
