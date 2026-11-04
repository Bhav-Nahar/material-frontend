import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * 404 — both for URLs that match no route and for notFound() thrown by a page whose handle is not
 * in the catalog (products/[handle], collections/[handle], blog/[handle], pages/[handle]).
 *
 * At the ROOT rather than inside (shop), because an unmatched URL matches no route group either, so
 * a (shop)/not-found.js would never be reached for the case that actually happens most. Same trade
 * as error.js: no header here, so it carries its own way out.
 *
 * ponytail: a link home, not a search box or "products you might like". Add those if the 404 rate
 * ever justifies them; it will not until the site has enough URLs to mistype.
 */
export const metadata = {
  title: 'Page not found — Texture House',
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-sm text-action-ink">404</p>
      <h1 className="font-display text-2xl font-semibold text-ink">
        This page doesn&apos;t exist
      </h1>
      <p className="text-sm text-subtle">
        The link may be out of date, or the product may no longer be in stock.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
