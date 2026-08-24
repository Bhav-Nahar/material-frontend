import { ProductGridSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * The PLP's own skeleton -- title row, desktop filter rail, then the 2/3-col card grid, shaped
 * like CollectionPage so the real page lands in place instead of reflowing. Overrides the (shop)
 * spinner for this route only.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="container-main mt-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full opacity-60" />
      </div>
      <div className="container-main mt-6 flex gap-10 pb-16">
        <div className="hidden w-56 shrink-0 flex-col gap-4 lg:flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full opacity-60" />
          ))}
        </div>
        <div className="flex-1"><ProductGridSkeleton count={12} /></div>
      </div>
    </div>
  );
}
