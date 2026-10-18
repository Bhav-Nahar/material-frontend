import { Skeleton } from "@/components/ui/skeleton";

/**
 * The PDP's own skeleton, drawn from the page as it actually renders (2026-10-19) so the real page
 * lands on top of it rather than reflowing:
 *
 *   breadcrumb   page.js renders it ABOVE ProductPage, so it is part of what this replaces --
 *                leaving it out made everything below jump down when the page arrived
 *   gallery      desktop: the flush two-column mosaic in one bordered block (ProductGallery);
 *                mobile: one swatch-shaped image and the 56px thumbnail strip under it
 *   buy box      category, a title that wraps (product titles here run to three lines), the
 *                ₹/sq ft headline with the pack price opposite, chips, one row per option
 *                (Size, then Colour with its swatch), pincode, Add to cart, the sample row
 *
 * Same grid, gaps and top margins as ProductPage; `aspect-swatch` is the gallery's own ratio.
 */
export default function Loading() {
  return (
    <div className="animate-pulse pb-16">
      <div className="container-main flex items-center gap-2 py-1.5 lg:py-3">
        <Skeleton className="h-3 w-10 opacity-60" />
        <Skeleton className="h-3 w-16 opacity-60" />
        <Skeleton className="h-3 w-56 opacity-60" />
      </div>

      <div className="container-main mt-2 grid grid-cols-1 items-start gap-8 lg:mt-3 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          {/* Butted tiles, so alternate the tone or four bars read as one grey slab. */}
          <div className="hidden grid-cols-2 overflow-hidden rounded-sm border border-line lg:grid">
            {["", "opacity-70", "opacity-70", ""].map((tone, i) => (
              <Skeleton key={i} className={`aspect-swatch w-full ${tone}`} />
            ))}
          </div>
          <div className="lg:hidden">
            <Skeleton className="aspect-swatch w-full" />
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="aspect-swatch w-14 shrink-0 rounded-sm opacity-60" />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <Skeleton className="h-3 w-20 opacity-60" />
          <Skeleton className="mt-2.5 h-6 w-full lg:h-7" />
          <Skeleton className="mt-2 h-6 w-11/12 lg:h-7" />
          <Skeleton className="mt-2 h-6 w-3/5 lg:h-7" />

          <div className="mt-5 flex items-start justify-between">
            <div>
              <Skeleton className="h-8 w-28" />
              <Skeleton className="mt-2 h-3 w-24 opacity-60" />
            </div>
            <div className="flex flex-col items-end">
              <Skeleton className="h-4 w-36 opacity-75" />
              <Skeleton className="mt-2 h-3 w-24 opacity-60" />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Skeleton className="h-6 w-16 rounded-sm opacity-60" />
            <Skeleton className="h-6 w-16 rounded-sm opacity-60" />
            <Skeleton className="h-6 w-20 rounded-sm opacity-60" />
          </div>

          <Skeleton className="mt-6 h-3 w-16 opacity-60" />
          <div className="mt-2.5 flex gap-2.5">
            <Skeleton className="h-10 w-20 rounded-sm" />
            <Skeleton className="h-10 w-20 rounded-sm" />
          </div>

          <Skeleton className="mt-4 h-3 w-24 opacity-60" />
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex h-11 w-36 items-center gap-2 rounded-sm border border-line px-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-full opacity-60" />
              </div>
            ))}
          </div>

          <Skeleton className="mt-7 h-4 w-28 opacity-60" />
          <Skeleton className="mt-2.5 h-11 w-full opacity-75" />
          <Skeleton className="mt-4 h-12 w-full" />
          <Skeleton className="mt-6 h-14 w-full opacity-60" />
        </div>
      </div>
    </div>
  );
}
