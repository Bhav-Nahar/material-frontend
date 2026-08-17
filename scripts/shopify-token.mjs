/**
 * Exchanges app credentials for an Admin API access token using Shopify's client_credentials
 * grant -- no browser round-trip, no redirect URI.
 *
 *   node scripts/shopify-token.mjs          # exchange and report
 *   node scripts/shopify-token.mjs --write  # also save it to .env.local as SHOPIFY_ADMIN_TOKEN
 *
 * Reads SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET from .env.local. Never prints the secret or
 * the full token -- only a prefix, so the output is safe to paste into a chat or an issue.
 *
 * Tokens from this grant carry an expiry. Re-run when it lapses.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = new URL("../.env.local", import.meta.url);
const raw = readFileSync(ENV_PATH, "utf8");

const env = Object.fromEntries(
  raw
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

const DOMAIN = env.SHOPIFY_STORE_DOMAIN;
const ID = env.SHOPIFY_CLIENT_ID;
const SECRET = env.SHOPIFY_CLIENT_SECRET;

const missing = [
  ["SHOPIFY_STORE_DOMAIN", DOMAIN],
  ["SHOPIFY_CLIENT_ID", ID],
  ["SHOPIFY_CLIENT_SECRET", SECRET],
].filter(([, v]) => !v);

if (missing.length) {
  console.error("Missing in .env.local: " + missing.map(([k]) => k).join(", "));
  process.exit(1);
}

const res = await fetch(`https://${DOMAIN}/admin/oauth/access_token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: ID,
    client_secret: SECRET,
  }),
});

const body = await res.json().catch(() => ({}));

if (!res.ok || !body.access_token) {
  console.error(`HTTP ${res.status}`);
  console.error(JSON.stringify(body, null, 2));
  console.error("\nIf this says the grant is unsupported, the app's distribution may not allow");
  console.error("client_credentials -- fall back to Develop apps > Reveal token.");
  process.exit(1);
}

const token = body.access_token;
const mask = `${token.slice(0, 9)}…${token.slice(-4)} (${token.length} chars)`;
console.log("token obtained :", mask);
if (body.expires_in) {
  const hrs = (body.expires_in / 3600).toFixed(1);
  console.log("expires in     :", `${body.expires_in}s (~${hrs}h) — re-run this script to refresh`);
}
if (body.scope) console.log("scopes         :", body.scope);

// Confirm it actually works before anyone relies on it.
const probe = await fetch(
  `https://${DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION ?? "2026-01"}/graphql.json`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: "{ shop { name myshopifyDomain currencyCode } }" }),
  },
);
const probed = await probe.json().catch(() => ({}));
console.log(
  "admin api check:",
  probed?.data?.shop
    ? `ok — ${probed.data.shop.name} (${probed.data.shop.currencyCode})`
    : `FAILED — ${JSON.stringify(probed?.errors ?? probed).slice(0, 200)}`,
);

if (process.argv.includes("--write")) {
  const line = `SHOPIFY_ADMIN_TOKEN=${token}`;
  const next = /^SHOPIFY_ADMIN_TOKEN=.*$/m.test(raw)
    ? raw.replace(/^SHOPIFY_ADMIN_TOKEN=.*$/m, line)
    : raw.trimEnd() + `\n${line}\n`;
  writeFileSync(ENV_PATH, next);
  console.log("written        : SHOPIFY_ADMIN_TOKEN in .env.local (gitignored)");
}
