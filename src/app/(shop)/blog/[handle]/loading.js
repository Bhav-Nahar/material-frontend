import { Skeleton, TextSkeleton } from "@/components/ui/skeleton";

/** A single article: title block, hero image, then prose at reading width. */
export default function Loading() {
  return (
    <div className="container-main mt-8 animate-pulse pb-16">
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-4 w-32 opacity-60" />
        <Skeleton className="mt-4 h-8 w-full" />
        <Skeleton className="mt-3 h-8 w-3/4" />
        <Skeleton className="mt-8 aspect-[16/9] w-full" />
        <TextSkeleton lines={4} className="mt-8" />
        <TextSkeleton lines={5} className="mt-8" />
      </div>
    </div>
  );
}
