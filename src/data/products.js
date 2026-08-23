/**
 * PLACEHOLDER PRODUCTS -- development only.
 *
 * The Shopify store (material-lygawaz9) currently has ONE product and ONE collection (`tiles`), so
 * there is almost nothing real to render. These exist so the homepage sections can be designed and
 * reviewed now; `src/lib/products.js` uses them ONLY when NODE_ENV !== "production", and returns
 * real Storefront data (or nothing) otherwise. Nothing invented can reach the live site.
 *
 * `collection` is the Shopify collection handle a product would belong to -- it is what lets
 * getCollectionProducts("tiles") fall back to only the tiles.
 *
 * `tags` carry the LOOK ("Marble", "Cement", "Wood-look", "Terrazzo", "Zellige") because that is
 * what the homepage look tabs filter on, and what real products will be tagged with. Merchandising
 * tags stay FIRST where a product has one: ProductCard shows tags[0] as its corner chip, so a look
 * tag in front of "Bestseller" would quietly replace the chip.
 *
 * EVERYTHING is quoted per square foot -- tiles, laminates, wallpaper alike. `packPrice` is what
 * the customer actually pays for one box / sheet / roll, and is the only place a pack name appears.
 * Quoting laminate per sheet and wallpaper per roll made every card a different shape; one unit
 * makes them comparable, which is the whole point of the number.
 *
 *   laminate sheet  8 × 4 ft   = 32 sq ft
 *   wallpaper roll  10 m × 53 cm ≈ 57 sq ft
 *   tile box        varies, see packPrice ÷ price
 *
 * Delete this file once the catalogue is live.
 */
const CDN = "https://cdn.shopify.com/s/files/1/0778/7636/3401/files";
const TILE = `${CDN}/tiles.png?v=1786039457`;
const LAMINATE = `${CDN}/Laminates.png?v=1786039520`;
const PAPER = `${CDN}/wallpaper.png?v=1786039458`;

export const PLACEHOLDER_PRODUCTS = [
  // Tiles -- ten, covering all five looks, so the look tabs have something to filter.
  { handle: "carrara-matte-600", collection: "tiles", title: "Carrara matte 600 × 600 Splendore", category: "Floor tiles", sku: "TL 00412 A", price: 82, comparePrice: 105, packPrice: 1180, packCompare: 1511, unit: "sq ft", packUnit: "box", images: [TILE, LAMINATE, PAPER], tags: ["Bestseller", "Marble"], inStock: true },
  { handle: "statuario-gloss-1200", collection: "tiles", title: "Statuario gloss 1200 × 600", category: "Floor tiles", sku: "TL 00427 D", price: 134, comparePrice: 168, packPrice: 3216, packCompare: 4032, unit: "sq ft", packUnit: "box", images: [TILE, PAPER], tags: ["Marble"], inStock: true },
  { handle: "travertine-beige-600", collection: "tiles", title: "Travertine beige 600 × 600 Matte", category: "Wall tiles", sku: "TL 00461 B", price: 91, comparePrice: 0, packPrice: 1310, packCompare: 0, unit: "sq ft", packUnit: "box", images: [TILE], tags: ["Marble"], inStock: true },
  { handle: "terrazzo-grey-600", collection: "tiles", title: "Terrazzo grey 600 × 600 Matte", category: "Floor tiles", sku: "TL 00518 C", price: 96, comparePrice: 0, packPrice: 1382, packCompare: 0, unit: "sq ft", packUnit: "box", images: [TILE], tags: ["New", "Terrazzo"], inStock: true },
  { handle: "anti-skid-slate-300", collection: "tiles", title: "Anti-skid slate 300 × 600 R11", category: "Bathroom tiles", sku: "TL 00733 B", price: 74, comparePrice: 88, packPrice: 888, packCompare: 1056, unit: "sq ft", packUnit: "box", images: [TILE, PAPER], tags: ["Anti-skid", "Cement"], inStock: true },
  { handle: "cement-look-800", collection: "tiles", title: "Cement-look 800 × 800 Matte", category: "Floor tiles", sku: "TL 00905 F", price: 118, comparePrice: 140, packPrice: 2265, packCompare: 2687, unit: "sq ft", packUnit: "box", images: [TILE, PAPER, LAMINATE], tags: ["Cement"], inStock: true },
  { handle: "oak-plank-1200", collection: "tiles", title: "Oak plank 1200 × 200 wood-look", category: "Floor tiles", sku: "TL 01102 A", price: 88, comparePrice: 112, packPrice: 1584, packCompare: 2016, unit: "sq ft", packUnit: "box", images: [TILE, LAMINATE], tags: ["Bestseller", "Wood-look"], inStock: true },
  { handle: "teak-plank-800", collection: "tiles", title: "Teak plank 800 × 200 Matte", category: "Floor tiles", sku: "TL 01147 E", price: 79, comparePrice: 0, packPrice: 1422, packCompare: 0, unit: "sq ft", packUnit: "box", images: [TILE], tags: ["Wood-look"], inStock: false },
  { handle: "zellige-emerald-100", collection: "tiles", title: "Zellige emerald 100 × 100 glazed", category: "Wall tiles", sku: "TL 01330 C", price: 168, comparePrice: 210, packPrice: 2688, packCompare: 3360, unit: "sq ft", packUnit: "box", images: [TILE, PAPER], tags: ["New", "Zellige"], inStock: true },
  { handle: "zellige-ivory-100", collection: "tiles", title: "Zellige ivory 100 × 100 handmade", category: "Wall tiles", sku: "TL 01358 A", price: 155, comparePrice: 0, packPrice: 2480, packCompare: 0, unit: "sq ft", packUnit: "box", images: [TILE], tags: ["Zellige"], inStock: true },

  { handle: "woodgrain-oak", collection: "laminates", title: "Woodgrain oak 8 × 4 ft, 1 mm", category: "Laminates", sku: "LM 01204 D", price: 45, comparePrice: 56, packPrice: 1450, packCompare: 1804, unit: "sq ft", packUnit: "sheet", images: [LAMINATE, TILE], tags: ["Bestseller", "Woodgrain"], inStock: true },
  { handle: "fluted-walnut", collection: "laminates", title: "Fluted walnut 8 × 4 ft panel", category: "Laminates", sku: "LM 01877 A", price: 66, comparePrice: 0, packPrice: 2100, packCompare: 0, unit: "sq ft", packUnit: "sheet", images: [LAMINATE, PAPER, TILE], tags: ["Fluted"], inStock: false },

  { handle: "plain-textured-linen", collection: "wallpaper", title: "Plain textured linen, 10 m roll", category: "Wallpaper", sku: "WP 00291 E", price: 56, comparePrice: 68, packPrice: 3200, packCompare: 3886, unit: "sq ft", packUnit: "roll", images: [PAPER, LAMINATE], tags: ["New", "Plain and textured"], inStock: true },
  { handle: "floral-mural-sage", collection: "wallpaper", title: "Floral mural, sage", category: "Wallpaper", sku: "WP 00644 B", price: 84, comparePrice: 0, packPrice: 0, packCompare: 0, unit: "sq ft", packUnit: null, images: [PAPER], tags: ["Made to measure", "Floral"], inStock: true },
];
