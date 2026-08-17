import { CATEGORIES, LOOK_IMAGES, ROOM_PICKS } from "@/data/catalog";
import { getMenu, transformMenuData } from "@/lib/menus";
import ShopByRoomPicker from "./ShopByRoomPicker";

/**
 * Shop by room. The one cut on this page that goes ACROSS materials rather than slicing the same
 * three again -- nobody wakes up wanting laminate, they wake up doing their bathroom.
 *
 * Material Depot's "Start With a room end with a masterpiece" arrangement: the room is a selector,
 * not a link, and choosing one swaps a row of picks beneath it. Their headline keeps the
 * exclamation mark; §18 does not, so ours is "Shop by room".
 *
 * Two sources, deliberately:
 *   - WHICH ROOMS EXIST comes from the menu's own "Shop by room" columns, so it cannot drift from
 *     the nav. Tiles contributes five, wallpaper three, overlapping on Living room; laminates has
 *     none (its equivalent column is "Shop by use").
 *   - WHAT SITS UNDER EACH ROOM comes from ROOM_PICKS, because it cannot be derived. The menu knows
 *     "bathroom" and "anti-skid" both exist and nothing more; only a person knows they go together.
 *     Deriving it instead -- every look of every category serving the room -- was the first thing I
 *     tried, and it gives all five tile rooms an identical row, which makes the selector look
 *     broken rather than useful.
 */
export default async function ShopByRoom() {
  const menu = transformMenuData(await getMenu());

  const rooms = [];
  for (const item of menu) {
    for (const column of item.columns ?? []) {
      if (!/room/i.test(column.title)) continue;
      for (const sub of column.items) {
        // The slug is the menu's own ?room= value -- the one the collection page will read.
        const slug = new URLSearchParams(sub.href.split("?")[1] ?? "").get("room");
        const picks = ROOM_PICKS[slug];
        // No picks means nothing to show on selection, so the room is dropped rather than offered.
        if (!slug || !picks?.length || rooms.some((r) => r.slug === slug)) continue;

        rooms.push({
          slug,
          label: sub.label,
          picks: picks.map(decorate),
        });
      }
    }
  }

  if (rooms.length === 0) return null;

  return (
    <section aria-labelledby="shop-by-room" className="container-main pb-6">
      <h2 id="shop-by-room" className="mb-6 text-xl lg:mb-8 lg:text-2xl">
        Shop by room
      </h2>

      <ShopByRoomPicker rooms={rooms} />
    </section>
  );
}

/**
 * A pick's category and its photo, both read off the collection its href points at.
 *
 * The CATEGORY is the point of this section and used to be invisible: a row reading "Backsplash
 * tiles / Kitchen shutters / Woodgrain laminates" spans all three materials, which is the one thing
 * Shop by room does that Shop by category cannot, and nothing on the card said so. It is an eyebrow
 * now.
 *
 * The photo falls back to the CATEGORY's rather than rotating -- a laminate photo under "Woodgrain
 * laminates" is true, where one under "Zellige wall tiles" would not be.
 */
function decorate(pick) {
  const handle = pick.href.split("?")[0].replace("/collections/", "");
  const category = CATEGORIES.find((c) => c.handle === handle);

  return {
    ...pick,
    material: category?.title ?? null,
    image: LOOK_IMAGES[pick.label] ?? category?.image ?? CATEGORIES[0].image,
  };
}
