export default function shopifyLoader({ src, width, quality }) {
  // A relative path (something out of /public) is not resizable by Shopify's CDN and `new URL`
  // would throw on it at render time -- serve it as-is.
  if (src.startsWith('/')) return src;
  const url = new URL(src);
  url.searchParams.set('width', width.toString());
  if (quality) {
    url.searchParams.set('quality', quality.toString());
  }
  return url.toString();
}
