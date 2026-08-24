import { Skeleton, TextSkeleton } from "@/components/ui/skeleton";

/**
 * The fallback skeleton for shop routes that do not ship their own.
 *
 * Inside (shop), NOT at the root, and that placement is the whole point: this is the Suspense
 * fallback for the children of app/(shop)/layout.js, so the header and footer stay on screen while
 * the next page's Shopify fetch resolves. A root loading.js would blank the chrome on every single
 * navigation, which reads as the site reloading rather than moving.
 *
 * Routes with a shape worth matching -- PDP, PLP, search, blog, content pages -- override this with
 * their own loading.js in their own folder. What is left here is everything else, so this stays
 * deliberately generic: a heading and some body, which is what an unknown page is made of.
 *
 * NOT A SPINNER any more. A spinner says "wait"; a skeleton says "here is what is arriving", and
 * on a slow connection that is the difference between a page loading and a page broken.
 *
 * Checkout deliberately has none. Its steps are client components with state already in Redux --
 * there is nothing to wait for, and a skeleton between "shipping" and "payment" would be inventing
 * a delay.
 */
export default function Loading() {
  return (
    <div className="container-main mt-8 min-h-[60vh] animate-pulse pb-16">
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <TextSkeleton lines={4} className="mt-8" />
      <TextSkeleton lines={3} className="mt-8" />
    </div>
  );
}
