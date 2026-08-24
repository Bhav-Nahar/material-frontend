import { ProductGridSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Search results: heading then the same four-up grid the results render into. */
export default function Loading() {
  return (
    <div className="container-main mt-6 animate-pulse pb-16">
      <Skeleton className="h-7 w-72 max-w-full" />
      <ProductGridSkeleton count={8} className="mt-8 lg:grid-cols-3 xl:grid-cols-4" />
    </div>
  );
}
