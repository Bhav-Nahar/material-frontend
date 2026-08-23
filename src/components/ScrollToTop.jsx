"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Every route change starts at the top.
 *
 * The App Router is supposed to do this itself, and mostly does -- but navigating to `/` below
 * 1024px it skips the reset entirely, so a shopper deep in a collection who tapped the wordmark
 * landed in the homepage footer. Next decides whether to scroll by measuring the changed segment
 * and leaving the page alone if it looks like it is already in view; on that one route the
 * measurement says "in view" when it is 2800px above. Rather than fight the heuristic, assert the
 * thing we actually want on every navigation.
 *
 * TWO CASES ARE LEFT ALONE, because in both the browser is right and we are not:
 *   - back/forward, where the whole point is to land where you were. Next restores that offset, and
 *     the listing pages restore their own (see lib/plpScroll); resetting here would undo both.
 *   - a URL with a hash, which names its own destination.
 *
 * ponytail: `instant`, not smooth -- a new page animating its way up from the old page's offset
 * reads as a glitch, not a transition.
 */
function Reset() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const isPop = useRef(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    const onPop = () => {
      isPop.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    // Same path, different query = a filter/sort toggle on a listing page. Those pushes pass
    // { scroll: false } on purpose (CollectionPage) -- yanking a shopper to the top on every
    // checkbox tap turns multi-facet filtering into scroll ping-pong. Only a PATH change resets.
    const pathChanged = pathname !== prevPath.current;
    prevPath.current = pathname;
    if (isPop.current) {
      isPop.current = false;
      return;
    }
    if (!pathChanged) return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, search]);

  return null;
}

export default function ScrollToTop() {
  // useSearchParams needs a Suspense boundary, or every page under this layout is forced dynamic --
  // same reason CaptureAttribution wraps itself.
  return (
    <Suspense fallback={null}>
      <Reset />
    </Suspense>
  );
}
