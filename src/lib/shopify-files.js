/**
 * Putting a file in Shopify Files, and getting its public CDN url back.
 *
 * Its own module so the verify script can drive the SAME code the route runs. A copy of this dance
 * in a test script would prove only that the copy works, and this is the part most likely to be
 * subtly wrong: it is three chained calls against an API nobody here has used before.
 */
const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-01";

/** Configured at all? The route 503s rather than throwing when the Admin token is absent. */
export const shopifyFilesEnabled = () => Boolean(DOMAIN && TOKEN);

/**
 * Shopify's three-step upload: ask for a signed target, PUT the bytes at it, then register the
 * result as a File. There is no one-shot endpoint; `fileCreate` only accepts a resourceUrl that
 * `stagedUploadsCreate` has already issued.
 *
 * Returns the public CDN URL. `fileCreate` answers before the image has finished processing, so
 * `image.url` can still be null on the first read -- hence the poll below.
 */
export async function uploadToShopifyFiles(file) {
  const admin = async (query, variables) => {
    const res = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
      body: JSON.stringify({ query, variables }),
    });
    const { data, errors } = await res.json();
    /**
     * `errors` COMES BACK IN TWO SHAPES and this cost a debugging session. A GraphQL-level error is
     * the documented array of {message}; an AUTH failure is a bare STRING -- "[API] Invalid API key
     * or access token". `errors[0].message` on a string reads character zero and then `.message`
     * off it, which is undefined, so an expired Admin token surfaced as `Error: ` with no text and
     * looked like the upload itself was broken.
     *
     * The status is included because that is what actually names the fault: a 401 here means the
     * Admin token has expired, which on this store happens every 24h -- run
     * `node scripts/shopify-token.mjs --write` to mint a fresh one.
     */
    if (errors) {
      const detail = typeof errors === "string" ? errors : (errors[0]?.message ?? JSON.stringify(errors));
      throw new Error(`shopify admin ${res.status}: ${detail}`);
    }
    return data;
  };

  // The filename is OURS, never the customer's. An uploaded name is attacker-controlled text that
  // would end up in the shop's file list and in a public URL.
  const ext = { "image/png": "png", "image/webp": "webp" }[file.type] ?? "jpg";
  const filename = `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const staged = await admin(STAGED_UPLOAD, {
    input: [
      {
        filename,
        mimeType: file.type,
        resource: "IMAGE",
        httpMethod: "POST",
        fileSize: String(file.size),
      },
    ],
  });

  const target = staged?.stagedUploadsCreate?.stagedTargets?.[0];
  const stagedErrors = staged?.stagedUploadsCreate?.userErrors ?? [];
  if (stagedErrors.length) throw new Error(stagedErrors[0].message);
  if (!target) throw new Error("no staged upload target");

  // Shopify's staged target is an S3-style POST form: every parameter it hands back must be
  // appended BEFORE the file, in order, or the bucket rejects the request.
  const body = new FormData();
  for (const { name, value } of target.parameters) body.append(name, value);
  body.append("file", file, filename);

  const put = await fetch(target.url, { method: "POST", body });
  if (!put.ok) throw new Error(`staged upload responded ${put.status}`);

  const created = await admin(FILE_CREATE, {
    files: [{ contentType: "IMAGE", originalSource: target.resourceUrl, alt: "Customer review" }],
  });
  const fileErrors = created?.fileCreate?.userErrors ?? [];
  if (fileErrors.length) throw new Error(fileErrors[0].message);

  const id = created?.fileCreate?.files?.[0]?.id;
  if (!id) throw new Error("fileCreate returned no id");

  return pollForUrl(admin, id);
}

/**
 * Wait for Shopify to finish processing the image and hand back a CDN url.
 *
 * `fileCreate` returns while status is still UPLOADED, with `image.url` null. Returning that null
 * would send Judge.me nothing to fetch, and since their ingest is a background job with no error
 * channel, the review would simply appear one day without its photograph.
 *
 * ponytail: five tries, 600ms apart -- ~3s worst case, well inside a serverless request. If Shopify
 * is slower than that the upload fails loudly here, which is recoverable, rather than quietly
 * later, which is not.
 */
async function pollForUrl(admin, id) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const data = await admin(FILE_STATUS, { id });
    const node = data?.node;
    if (node?.fileStatus === "FAILED") throw new Error("shopify rejected the image");
    const url = node?.image?.url;
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw new Error("image still processing");
}

const STAGED_UPLOAD = `
  mutation stage($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE = `
  mutation create($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id fileStatus }
      userErrors { field message }
    }
  }
`;

const FILE_STATUS = `
  query status($id: ID!) {
    node(id: $id) {
      ... on MediaImage { fileStatus image { url } }
    }
  }
`;
