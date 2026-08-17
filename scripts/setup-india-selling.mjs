/**
 * Makes the store actually able to sell in India. Without this the catalogue renders fine but every
 * cart silently totals zero, because Shopify resolves a market, then a location that can fulfil it,
 * then a shipping zone that covers it -- and any missing link fails without an error.
 *
 *   node scripts/setup-india-selling.mjs
 *
 * Three things, each of which was broken on this store:
 *   1. an India market (INR)              -- created separately, checked here
 *   2. a location that ships, IN India    -- stock sat at a Canadian location with shipsInventory=false
 *   3. a shipping zone covering IN        -- zones were US-only, the International zone was empty
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

const gql = async (query, variables = {}) => {
  const r = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN },
      body: JSON.stringify({ query, variables }),
    },
  );
  const j = await r.json();
  if (j.errors) throw new Error("GraphQL: " + JSON.stringify(j.errors));
  for (const v of Object.values(j.data ?? {})) {
    if (v?.userErrors?.length) throw new Error("userErrors: " + JSON.stringify(v.userErrors));
  }
  return j.data;
};

/* 1. market ------------------------------------------------------------------------------------ */
const { markets } = await gql(`{ markets(first: 20) { nodes { name status currencySettings { baseCurrency { currencyCode } } } } }`);
const india = markets.nodes.find((m) => m.name === "India");
console.log(`market India: ${india ? `${india.status} / ${india.currencySettings.baseCurrency.currencyCode}` : "MISSING"}`);

/* 2. a location that actually ships ------------------------------------------------------------ */
const { locations } = await gql(`{ locations(first: 20) { nodes { id name shipsInventory address { countryCode } } } }`);
let mumbai = locations.nodes.find((l) => l.name === "Mumbai warehouse");

if (!mumbai) {
  const { locationAdd } = await gql(
    `mutation($input: LocationAddInput!) {
       locationAdd(input: $input) { location { id name } userErrors { field message } }
     }`,
    {
      input: {
        name: "Mumbai warehouse",
        fulfillsOnlineOrders: true,
        address: { address1: "Andheri East", city: "Mumbai", countryCode: "IN", provinceCode: "MH", zip: "400069" },
      },
    },
  );
  mumbai = locationAdd.location;
  console.log("created location:", mumbai.name);
} else {
  console.log("location exists :", mumbai.name);
}

/* 3. move the stock there ----------------------------------------------------------------------- */
const { productByIdentifier: product } = await gql(
  `query($h: String!) {
     productByIdentifier(identifier: {handle: $h}) {
       variants(first: 10) { nodes { id title inventoryItem { id } } }
     }
   }`,
  { h: "wood-floor-tile-nordic-honey-1200x200" },
);

for (const v of product.variants.nodes) {
  const qty = /1200/.test(v.title) ? 40 : 25;
  await gql(
    `mutation($id: ID!, $loc: ID!, $qty: Int!) {
       inventoryActivate(inventoryItemId: $id, locationId: $loc, available: $qty) {
         inventoryLevel { quantities(names: "available") { quantity } }
         userErrors { field message }
       }
     }`,
    { id: v.inventoryItem.id, loc: mumbai.id, qty },
  );
  console.log(`stocked ${String(qty).padStart(3)} boxes of ${v.title} at ${mumbai.name}`);
}

/* 4. a shipping zone that covers India ---------------------------------------------------------- */
const { deliveryProfiles } = await gql(
  `{ deliveryProfiles(first: 5) { nodes { id name default
       profileLocationGroups { locationGroup { id }
         locationGroupZones(first: 20) { nodes { zone { id name countries { code { countryCode } } } } } } } } }`,
);
const profile = deliveryProfiles.nodes.find((p) => p.default);
const group = profile.profileLocationGroups[0];
const covered = group.locationGroupZones.nodes.flatMap((z) => z.zone.countries.map((c) => c.code.countryCode));

if (covered.includes("IN")) {
  console.log("shipping zone   : India already covered");
} else {
  await gql(
    `mutation($id: ID!, $profile: DeliveryProfileInput!) {
       deliveryProfileUpdate(id: $id, profile: $profile) {
         profile { id } userErrors { field message }
       }
     }`,
    {
      id: profile.id,
      profile: {
        locationGroupsToUpdate: [
          {
            id: group.locationGroup.id,
            zonesToCreate: [
              {
                name: "India",
                countries: [{ code: "IN", includeAllProvinces: true }],
                methodDefinitionsToCreate: [
                  {
                    name: "Standard delivery",
                    active: true,
                    rateDefinition: { price: { amount: 0, currencyCode: "INR" } },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  );
  console.log("shipping zone   : created India zone with a free standard rate");
}

console.log("\nnow run:  node scripts/verify-cart.mjs");
