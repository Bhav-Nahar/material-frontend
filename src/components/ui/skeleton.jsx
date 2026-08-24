/**
 * Loading placeholders, shaped like the thing that is coming.
 *
 * One `animate-pulse` on the OUTER wrapper, never per-bar: a grid of nine cards each pulsing to
 * its own clock reads as a glitch, one pulse across the whole block reads as a page arriving.
 * That is why `Skeleton` itself does not animate -- the caller wraps.
 */
export function Skeleton({ className = "" }) {
  return <div className={`bg-line ${className}`} />;
}

/** One product tile: square image, title line, price line. Matches ProductCard's proportions. */
export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="mt-3 h-4 w-4/5" />
      <Skeleton className="mt-2 h-4 w-2/5 opacity-60" />
    </div>
  );
}

/**
 * A grid of them, on `grid-products` -- the same utility the real PLP grid uses, so the skeleton
 * and the page it stands in for cannot fall out of step on how many columns there are.
 *
 * `className` still overrides for the grids that are not the PLP (search runs one wider).
 */
export function ProductGridSkeleton({ count = 8, className = "" }) {
  return (
    <div className={`grid-products gap-x-4 gap-y-8 lg:gap-x-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** `lines` stacked bars, the last one short, the way a paragraph actually ends. */
export function TextSkeleton({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"} opacity-60`} />
      ))}
    </div>
  );
}

/** The account area's list rows -- orders, addresses, coupons are all a stack of bordered cards. */
export function RowsSkeleton({ count = 3, height = "h-24" }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`w-full ${height} opacity-60`} />
      ))}
    </div>
  );
}

/**
 * A checkout step: form column on the left, order summary on the right.
 *
 * Shipping earns this more than the others -- it waits on the address book from the backend, which
 * on a cold Render instance is the longest wait in the whole funnel. A spinner there, on the screen
 * between the cart and the money, is the worst place on the site to look broken.
 */
export function CheckoutSkeleton({ rows = 3 }) {
  return (
    <div className="container-main mt-6 min-h-[50vh] animate-pulse pb-16 lg:mt-8">
      <Skeleton className="h-7 w-48" />
      <div className="mt-6 flex flex-col gap-10 lg:flex-row">
        <div className="flex-1 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full opacity-60" />
          ))}
          <Skeleton className="h-12 w-48" />
        </div>
        <Skeleton className="h-80 w-full opacity-60 lg:w-80 lg:shrink-0" />
      </div>
    </div>
  );
}
