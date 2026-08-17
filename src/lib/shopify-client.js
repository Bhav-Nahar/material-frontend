// Store domain from env, never hardcoded -- the jewelry build hardcodes its own handle here.
const SHOP =
  process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.replace(/\.myshopify\.com$/, "") ??
  process.env.SHOPIFY_STORE_DOMAIN?.replace(/\.myshopify\.com$/, "") ??
  "";
const rawStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE || SHOP;
const SHOP_DOMAIN = rawStore.includes(".") ? rawStore : `${rawStore}.myshopify.com`;

export async function shopifyStorefrontFetch(query, variables = {}, retries = 3, delayMs = 500) {
  let token = process.env.NEXT_PUBLIC_STOREFRONT_TOKEN;
  
  const isCustomerOrBlog = /customer|blog|article|address/i.test(query);
  if (isCustomerOrBlog && process.env.NEXT_PUBLIC_SHOPIFY_RW_STOREFRONT_TOKEN) {
    token = process.env.NEXT_PUBLIC_SHOPIFY_RW_STOREFRONT_TOKEN;
  }
  
  if (!token) {
    console.error("NEXT_PUBLIC_STOREFRONT_TOKEN is not defined");
    return null;
  }

  if (process.env.NODE_ENV === "development" && retries === 3) {
    console.log(`[shopifyStorefrontFetch] Fetching from ${SHOP_DOMAIN}`);
  }

  try {
    const res = await fetch(`https://${SHOP_DOMAIN}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await res.json();

    if (data.errors) {
      const hasConflict = data.errors.some(e => e.extensions?.code === "CONFLICT");
      
      if (hasConflict && retries > 0) {
        // Add random jitter to delay to prevent concurrent retries from conflicting again
        const jitter = Math.floor(Math.random() * 200);
        const nextDelay = delayMs + jitter;
        
        console.warn(`[shopifyStorefrontFetch] Cart conflict detected. Retrying in ${nextDelay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, nextDelay));
        return shopifyStorefrontFetch(query, variables, retries - 1, delayMs * 2);
      }

      if (process.env.NODE_ENV === "development") {
        console.error("[shopifyStorefrontFetch] GraphQL Errors:", JSON.stringify(data.errors, null, 2));
      }
      return null;
    }
    return data.data;
  } catch (err) {
    console.error("Shopify Storefront Fetch Error:", err);
    // On network failure, we could also retry, but CONFLICT is specifically what we want to solve
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return shopifyStorefrontFetch(query, variables, retries - 1, delayMs * 2);
    }
    return null;
  }
}

/**

/**
 * WHAT USED TO FOLLOW HERE, and why it is gone (user, 2026-08-15).
 *
 * 264 lines of GraphQL constants carried over from the jewelry build this project was adapted
 * from: CART_QUERY, CART_CREATE / LINES_ADD / LINES_UPDATE / LINES_REMOVE / ATTRIBUTES_UPDATE,
 * CUSTOMER_QUERY, CUSTOMER_ORDERS_QUERY, four ADDRESS_* mutations and CUSTOMER_UPDATE_MUTATION,
 * plus a toShopifyGid helper.
 *
 * Every one of them was dead. The cart ones had a single consumer -- the seven browser-side cart
 * thunks in cartSlice -- and those went the same day; /api/cart declares its own CART_QUERY server
 * side, against the CART_FIELDS fragment it actually renders. The customer and address ones never
 * had a consumer in this project at all.
 *
 * They were also dead in a way that would have failed if anything HAD called them: this module
 * reads NEXT_PUBLIC_STOREFRONT_TOKEN, which is deliberately never set -- the Storefront token is
 * server-only here (see the note in lib/products.js). Reinstating any of these means moving the
 * query to a server route, not restoring the constant.
 *
 * What is left is shopifyStorefrontFetch, which lib/contentSearch.js uses, and nothing else.
 */
