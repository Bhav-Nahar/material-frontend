const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-01";

/**
 * Newsletter signup.
 *
 * Subscribers become Shopify CUSTOMERS with email marketing consent, which means they appear in the
 * same admin list the merchant already uses, export like any other segment, and are there waiting
 * on the day a mail tool is chosen. The jewelry build posts this to a Fastify service; ours needs
 * no service, and adding Klaviyo or Mailchimp to collect an email before the shop has even launched
 * would be a subscription bought to hold a list of nothing.
 *
 * ADMIN token, not Storefront: the Storefront API has no "subscribe an email" mutation --
 * customerCreate there wants a password and makes an account, which is not what this is. The token
 * is server-only and never leaves this file's process.
 */
// ponytail: in-memory per-IP rate limit -- this route writes SUBSCRIBED customers into the
// merchant's admin via the Admin API, and without a cap a bot loop floods the customer list and
// poisons sender reputation. Resets on redeploy and is per-instance; move to a shared store
// (Upstash) if the site ever runs many instances.
const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const throttled = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear(); // memory backstop
  return recent.length > MAX_PER_WINDOW;
};

export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));

  // Same shape the browser's type="email" enforces. Repeated here because a POST does not have to
  // come from our form.
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (throttled(ip)) {
    return Response.json({ error: "Too many signups. Try again later." }, { status: 429 });
  }

  if (!DOMAIN || !TOKEN) {
    console.warn("[newsletter] SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN missing");
    return Response.json({ error: "Signup is unavailable right now." }, { status: 503 });
  }

  try {
    const res = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
      body: JSON.stringify({
        query: SUBSCRIBE,
        variables: {
          input: {
            email: email.trim(),
            emailMarketingConsent: {
              marketingState: "SUBSCRIBED",
              // Single opt-in: there is no confirmation email to send yet. Switch to
              // CONFIRMED_OPT_IN when a mail tool is wired up and can send one.
              marketingOptInLevel: "SINGLE_OPT_IN",
            },
          },
        },
      }),
    });

    const { data, errors } = await res.json();
    if (errors?.length) {
      console.warn("[newsletter]", errors[0].message);
      return Response.json({ error: "Signup is unavailable right now." }, { status: 502 });
    }

    const userErrors = data?.customerCreate?.userErrors ?? [];
    // "Email has already been taken" is a SUCCESS from where the shopper is standing -- they are on
    // the list. Saying so out loud would also confirm to anyone who asks which addresses the shop
    // holds, which is not ours to tell.
    const alreadyOnList = userErrors.some((e) => /taken|already/i.test(e.message));

    if (userErrors.length > 0 && !alreadyOnList) {
      console.warn("[newsletter]", userErrors[0].message);
      return Response.json({ error: userErrors[0].message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[newsletter]", err);
    return Response.json({ error: "Signup is unavailable right now." }, { status: 502 });
  }
}

const SUBSCRIBE = `
  mutation Subscribe($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;
