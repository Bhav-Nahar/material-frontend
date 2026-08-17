import { Spinner } from '@/components/ui/spinner';

/**
 * Navigation feedback for the shop routes.
 *
 * Inside (shop), NOT at the root, and that placement is the whole point: this is the Suspense
 * fallback for the children of app/(shop)/layout.js, so the header and footer stay on screen while
 * the next page's Shopify fetch resolves. A root loading.js would blank the chrome on every single
 * navigation, which reads as the site reloading rather than moving.
 *
 * Checkout deliberately has none. Its steps are client components with state already in Redux --
 * there is nothing to wait for, and a spinner between "shipping" and "payment" would be inventing
 * a delay.
 *
 * ponytail: one spinner, not per-route skeletons. A PLP skeleton that matches the real grid is
 * worth building if the collection pages ever feel slow enough to notice; a wrong-shaped skeleton
 * is worse than a spinner.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="size-6 text-meta" />
    </div>
  );
}
