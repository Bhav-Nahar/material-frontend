/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Build output directory, overridable per invocation.
  //
  // `next dev` and `next build` both write to .next, so running a verification build while a dev
  // server is up corrupts the dev server's state -- it manifests as the app mysteriously failing
  // to compile. Automated checks set NEXT_DIST_DIR=.next-verify so they never share a directory
  // with an interactive session.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  // Shopify's CDN already resizes and re-encodes on the fly via its own query params, so
  // routing images through Vercel's optimiser pays per-image for work that is already done.
  // See docs/performance/budget.md. The jewelry build wrote this loader and never wired it up.
  images: {
    loader: 'custom',
    loaderFile: './src/utils/shopifyLoader.js',
    // No `formats`: it only configures Vercel's optimiser, which the custom loader bypasses.
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }],
  },

  // The brand system ships no dark mode (§22), so there is no theme-flash problem to solve
  // and no reason to allow a client-side theme switch.
  compress: true,

  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
