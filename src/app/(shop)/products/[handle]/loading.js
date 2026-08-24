import { Skeleton, TextSkeleton } from "@/components/ui/skeleton";

/**
 * The PDP's own skeleton -- gallery left, buy box right, on the same 12-col grid ProductPage uses
 * so the real page lands in place rather than reflowing. Overrides the (shop) spinner here.
 */
export default function Loading() {
  return (
    <div className="container-main mt-4 grid animate-pulse grid-cols-1 gap-8 pb-16 lg:mt-6 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        <Skeleton className="aspect-square w-full" />
        <div className="mt-3 hidden gap-3 lg:flex">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="size-20 opacity-60" />
          ))}
        </div>
      </div>
      <div className="lg:col-span-5">
        <Skeleton className="h-4 w-24 opacity-60" />
        <Skeleton className="mt-3 h-7 w-11/12" />
        <Skeleton className="mt-2 h-7 w-3/5" />
        <Skeleton className="mt-5 h-6 w-40" />
        <div className="mt-6 flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 opacity-60" />
          ))}
        </div>
        <Skeleton className="mt-8 h-12 w-full" />
        <Skeleton className="mt-3 h-12 w-full opacity-60" />
        <TextSkeleton lines={4} className="mt-8" />
      </div>
    </div>
  );
}
