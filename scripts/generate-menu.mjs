#!/usr/bin/env node
/**
 * Generates src/data/menu-data.json in Shopify's menu shape, so the jewelry build's lib/menus.js
 * transform runs against it unedited.
 *
 * The jewelry build generates its equivalent by querying Shopify metafields (7,804 lines). We
 * define the tree here instead until the collections exist; swap this for the Shopify query later
 * and the consuming code does not change.
 *
 * Sub-links point at PLP facet URLs rather than one collection per permutation -- fewer Shopify
 * collections to create and keep in sync. They 404 until the PLP exists.
 *
 * Run: npm run menu
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://material.in';
const CDN = 'https://cdn.shopify.com/s/files/1/0778/7636/3401/files';

const CATEGORIES = [
  {
    title: 'Tiles', handle: 'tiles', live: true,
    image: `${CDN}/tiles.png?v=1786039457`,
    groups: {
      'Shop by room': [['Bathroom','room=bathroom'],['Kitchen','room=kitchen'],['Living room','room=living'],['Balcony','room=balcony'],['Outdoor','room=outdoor']],
      'Shop by look': [['Marble','look=marble'],['Cement','look=cement'],['Wood-look','look=wood'],['Terrazzo','look=terrazzo'],['Zellige','look=zellige']],
      'Shop by finish': [['Matte','finish=matte'],['Glossy','finish=glossy'],['Textured','finish=textured'],['Anti-skid','slip=r11']],
      'Shop by size': [['300 × 600 mm','size=300x600'],['600 × 600 mm','size=600x600'],['800 × 800 mm','size=800x800'],['1200 × 600 mm','size=1200x600']],
    },
  },
  {
    title: 'Laminates', handle: 'laminates', live: true,
    image: `${CDN}/Laminates.png?v=1786039520`,
    groups: {
      'Shop by look': [['Woodgrain','look=woodgrain'],['Solid colour','look=solid'],['Fluted','look=fluted'],['Stone-look','look=stone']],
      'Shop by finish': [['Matte','finish=matte'],['Gloss','finish=gloss'],['Textured','finish=textured']],
      'Shop by use': [['Wardrobe','use=wardrobe'],['Kitchen shutters','use=kitchen'],['Wall panelling','use=wall']],
    },
  },
  {
    title: 'Wallpaper', handle: 'wallpaper', live: true,
    image: `${CDN}/wallpaper.png?v=1786039458`,
    groups: {
      'Shop by room': [['Bedroom','room=bedroom'],['Living room','room=living'],["Children's room",'room=kids']],
      'Shop by pattern': [['Plain and textured','pattern=plain'],['Floral','pattern=floral'],['Geometric','pattern=geometric'],['Mural','pattern=mural']],
    },
  },
  // Not stocked yet. Present so the nav shows where the catalogue is going.
  { title: 'Stone', handle: 'stone', live: false, groups: {} },
  { title: 'Wood', handle: 'wood', live: false, groups: {} },
  { title: 'Hardware', handle: 'hardware', live: false, groups: {} },
];

const leaf = (title, url) => ({ title, url, resource: null, items: [] });

const items = CATEGORIES.map((c) => ({
  title: c.title,
  url: `${ORIGIN}/collections/${c.handle}`,
  resource: {
    __typename: 'Collection',
    handle: c.handle,
    productsCount: null,
    ...(c.image ? { image: { url: c.image } } : { image: null }),
    metafields: { nodes: [] },
  },
  items: Object.entries(c.groups).map(([group, links]) => ({
    title: group,
    url: `${ORIGIN}#`,
    resource: null,
    items: links.map(([label, q]) => leaf(label, `${ORIGIN}/collections/${c.handle}?${q}`)),
  })),
}));

const out = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src', 'data', 'menu-data.json');
writeFileSync(out, JSON.stringify({ success: true, menus: [{ handle: 'main-menu-official', items }], updatedAt: new Date(0).toISOString() }, null, 2));

const links = items.reduce((n, i) => n + i.items.reduce((m, g) => m + g.items.length, 0), 0);
console.log(`menu-data.json: ${items.length} categories, ${links} sub-links`);
