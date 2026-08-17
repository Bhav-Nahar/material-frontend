'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * What renders when a page throws.
 *
 * Sits at the ROOT, not inside (shop), so it covers checkout too -- a crash on the payment step is
 * the one that costs money. The trade is that this boundary is OUTSIDE app/(shop)/layout.js, so
 * when it catches, the header and footer go with the page. That is why the fallback carries its own
 * two links: whoever lands here still has to be able to leave.
 *
 * `reset` re-renders the segment. Worth offering because most of what throws here is a failed
 * Shopify fetch, which is usually transient.
 *
 * ponytail: no error reporting service, console only. Wire Sentry (or whatever) into the effect
 * below when someone is actually on call for this site -- the hook is deliberately already here so
 * that is a one-line change.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="text-sm text-subtle">
        This page didn&apos;t load. It is usually temporary — try again, and if it keeps happening,
        message us on WhatsApp.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
      {/* The digest is what a server-side error leaves behind for the logs; without it a support
          conversation has nothing to match against. Absent for client-side errors. */}
      {error?.digest ? (
        <p className="font-mono text-xs text-meta">Reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
