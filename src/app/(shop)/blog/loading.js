import { Skeleton } from "@/components/ui/skeleton";

/** The blog index: heading, then the article card grid. */
export default function Loading() {
  return (
    <div className="container-main mt-6 animate-pulse pb-16">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full opacity-60" />
      <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[3/2] w-full" />
            <Skeleton className="mt-4 h-5 w-11/12" />
            <Skeleton className="mt-2 h-4 w-3/5 opacity-60" />
          </div>
        ))}
      </div>
    </div>
  );
}
