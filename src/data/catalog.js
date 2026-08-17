/**
 * Material's category imagery and menu content, in one place.
 *
 * The jewelry build scatters this across four files as hardcoded Shopify URLs pointing at its own
 * store (files/1/0739/8516/3482/...). Centralising it means there is exactly one place to check
 * that nothing references another brand's assets.
 */

const CDN = "https://cdn.shopify.com/s/files/1/0778/7636/3401/files";

/** Live categories. Keep in step with src/data/menu-data.json (npm run menu). */
export const CATEGORIES = [
  { title: "Tiles", handle: "tiles", image: `${CDN}/tiles.png?v=1786039457` },
  { title: "Laminates", handle: "laminates", image: `${CDN}/Laminates.png?v=1786039520` },
  { title: "Wallpaper", handle: "wallpaper", image: `${CDN}/wallpaper.png?v=1786039458` },
];

/**
 * Photos for the looks/patterns shown in the Shop by category sheet, keyed by the menu label.
 *
 * Nothing else in the project carries facet imagery -- menu-data.json has no icon or image
 * metafields on these items, and there are no products yet to borrow a featured image from. Upload
 * one photo per look and add it here; anything missing falls back to the parent category photo, so
 * a half-filled map renders rather than breaking.
 */
export const LOOK_IMAGES = {
  // Marble: `${CDN}/look-marble.png`,
  // Cement: `${CDN}/look-cement.png`,
  // "Wood-look": `${CDN}/look-wood.png`,
  // Terrazzo: `${CDN}/look-terrazzo.png`,
  // Zellige: `${CDN}/look-zellige.png`,
  // Woodgrain: `${CDN}/look-woodgrain.png`,
  // "Solid colour": `${CDN}/look-solid.png`,
  // Fluted: `${CDN}/look-fluted.png`,
  // "Stone-look": `${CDN}/look-stone.png`,
  // "Plain and textured": `${CDN}/pattern-plain.png`,
  // Floral: `${CDN}/pattern-floral.png`,
  // Geometric: `${CDN}/pattern-geometric.png`,
  // Mural: `${CDN}/pattern-mural.png`,
};

/**
 * What to show under each room in Shop by room -- Material Depot's "Start With a room" pattern,
 * where picking a room swaps the row beneath it.
 *
 * THIS IS MERCHANDISING, and it is the one thing on this page that cannot be derived. The menu says
 * which rooms exist and which facets exist, but nothing links them: "bathroom" and "anti-skid" are
 * both real, and only a human knows they belong together. Depot curates the same mapping in their
 * CMS. Edit freely -- it is meant to be argued with.
 *
 * Every href is composed of facet parameters that ALREADY EXIST in the menu (see menu-data.json),
 * so nothing here invents a filter the collection page will not understand. Labels describe the
 * filter honestly rather than dressing it up.
 *
 * Keyed by the room slug in the menu's own ?room= values. A room with no picks is dropped from the
 * section rather than rendered as an empty shelf.
 */
export const ROOM_PICKS = {
  bathroom: [
    { label: "Anti-skid floor tiles", href: "/collections/tiles?room=bathroom&slip=r11" },
    { label: "Marble-look tiles", href: "/collections/tiles?room=bathroom&look=marble" },
    { label: "Zellige wall tiles", href: "/collections/tiles?room=bathroom&look=zellige" },
    { label: "300 × 600 wall tiles", href: "/collections/tiles?room=bathroom&size=300x600" },
    { label: "Matte finish", href: "/collections/tiles?room=bathroom&finish=matte" },
  ],
  kitchen: [
    { label: "Backsplash tiles", href: "/collections/tiles?room=kitchen&size=300x600" },
    { label: "Anti-skid floor tiles", href: "/collections/tiles?room=kitchen&slip=r11" },
    { label: "Kitchen shutters", href: "/collections/laminates?use=kitchen" },
    { label: "Woodgrain laminates", href: "/collections/laminates?use=kitchen&look=woodgrain" },
    { label: "Cement-look tiles", href: "/collections/tiles?room=kitchen&look=cement" },
  ],
  living: [
    { label: "1200 × 600 floor tiles", href: "/collections/tiles?room=living&size=1200x600" },
    { label: "Marble-look tiles", href: "/collections/tiles?room=living&look=marble" },
    { label: "Textured wallpaper", href: "/collections/wallpaper?room=living&pattern=plain" },
    { label: "Geometric wallpaper", href: "/collections/wallpaper?room=living&pattern=geometric" },
    { label: "Fluted wall panelling", href: "/collections/laminates?use=wall&look=fluted" },
  ],
  bedroom: [
    { label: "Floral wallpaper", href: "/collections/wallpaper?room=bedroom&pattern=floral" },
    { label: "Textured wallpaper", href: "/collections/wallpaper?room=bedroom&pattern=plain" },
    { label: "Mural wallpaper", href: "/collections/wallpaper?room=bedroom&pattern=mural" },
    { label: "Wardrobe laminates", href: "/collections/laminates?use=wardrobe" },
    { label: "Woodgrain laminates", href: "/collections/laminates?use=wardrobe&look=woodgrain" },
  ],
  kids: [
    { label: "Mural wallpaper", href: "/collections/wallpaper?room=kids&pattern=mural" },
    { label: "Geometric wallpaper", href: "/collections/wallpaper?room=kids&pattern=geometric" },
    { label: "Solid colour laminates", href: "/collections/laminates?look=solid" },
    { label: "Wardrobe laminates", href: "/collections/laminates?use=wardrobe" },
  ],
  balcony: [
    { label: "Anti-skid tiles", href: "/collections/tiles?room=balcony&slip=r11" },
    { label: "Cement-look tiles", href: "/collections/tiles?room=balcony&look=cement" },
    { label: "Terrazzo tiles", href: "/collections/tiles?room=balcony&look=terrazzo" },
    { label: "Textured finish", href: "/collections/tiles?room=balcony&finish=textured" },
  ],
  outdoor: [
    { label: "Anti-skid tiles", href: "/collections/tiles?room=outdoor&slip=r11" },
    { label: "800 × 800 pavers", href: "/collections/tiles?room=outdoor&size=800x800" },
    { label: "Cement-look tiles", href: "/collections/tiles?room=outdoor&look=cement" },
    { label: "Textured finish", href: "/collections/tiles?room=outdoor&finish=textured" },
  ],
};

/** Search overlay tiles, shown before a query is typed. */
export const SEARCH_CATEGORIES = CATEGORIES.map((c) => ({
  title: c.title,
  image: c.image,
  href: `/collections/${c.handle}`,
}));

/** Keyed by UPPERCASE label, matching how the mobile menu looks these up. */
export const CATEGORY_IMAGES = Object.fromEntries(
  CATEGORIES.map((c) => [c.title.toUpperCase(), c.image]),
);

/** Banner rail inside the mobile menu. */
export const MENU_BANNERS = CATEGORIES.map((c) => ({
  title: c.title,
  image: c.image,
  href: `/collections/${c.handle}`,
}));

/**
 * Popular searches. Each carries its own destination and thumbnail, so the image matches the term
 * -- rotating through categories positionally put a laminate photo next to "marble-look tiles".
 *
 * §18 voice: specific, no filler. Terms are the ones a customer actually types.
 */
export const POPULAR_SEARCHES = [
  { term: "Marble-look tiles", href: "/collections/tiles?look=marble", category: "tiles" },
  { term: "Anti-skid bathroom tiles", href: "/collections/tiles?slip=r11", category: "tiles" },
  { term: "Wood-look laminates", href: "/collections/laminates?look=woodgrain", category: "laminates" },
  { term: "600 × 600 floor tiles", href: "/collections/tiles?size=600x600", category: "tiles" },
  { term: "Textured wallpaper", href: "/collections/wallpaper?pattern=plain", category: "wallpaper" },
].map((p) => ({ ...p, image: CATEGORIES.find((c) => c.handle === p.category)?.image }));

/**
 * Terms used to build query completions, so "marble" offers "marble tiles",
 * "marble laminates" and so on. Drawn from the same facet vocabulary as the mega menu.
 *
 * CaratLane's search suggests completions rather than previewing products -- typing "gold" gives
 * "gold coin", "gold earrings", "gold rings". Same idea, our vocabulary.
 */
export const SUGGESTION_TERMS = [
  { label: "tiles", href: "/collections/tiles" },
  { label: "laminates", href: "/collections/laminates" },
  { label: "wallpaper", href: "/collections/wallpaper" },
  { label: "bathroom tiles", href: "/collections/tiles?room=bathroom" },
  { label: "kitchen tiles", href: "/collections/tiles?room=kitchen" },
  { label: "outdoor tiles", href: "/collections/tiles?room=outdoor" },
  { label: "floor tiles", href: "/collections/tiles?size=600x600" },
  { label: "wall tiles", href: "/collections/tiles?room=bathroom" },
  { label: "marble-look tiles", href: "/collections/tiles?look=marble" },
  { label: "wood-look tiles", href: "/collections/tiles?look=wood" },
  { label: "cement-look tiles", href: "/collections/tiles?look=cement" },
  { label: "matte tiles", href: "/collections/tiles?finish=matte" },
  { label: "glossy tiles", href: "/collections/tiles?finish=glossy" },
  { label: "anti-skid tiles", href: "/collections/tiles?slip=r11" },
  { label: "woodgrain laminates", href: "/collections/laminates?look=woodgrain" },
  { label: "fluted laminates", href: "/collections/laminates?look=fluted" },
  { label: "floral wallpaper", href: "/collections/wallpaper?pattern=floral" },
  { label: "textured wallpaper", href: "/collections/wallpaper?pattern=plain" },
];
