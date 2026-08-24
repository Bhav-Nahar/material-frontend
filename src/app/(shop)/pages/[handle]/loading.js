import { Skeleton, TextSkeleton } from "@/components/ui/skeleton";

/** A content page -- policy, contact, returns. Title then prose, no imagery to reserve. */
export default function Loading() {
  return (
    <div className="container-main mt-8 animate-pulse pb-16">
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-8 w-2/3" />
        <TextSkeleton lines={4} className="mt-8" />
        <TextSkeleton lines={6} className="mt-8" />
        <TextSkeleton lines={3} className="mt-8" />
      </div>
    </div>
  );
}
