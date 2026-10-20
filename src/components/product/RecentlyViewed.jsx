"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addRecentlyViewed } from "@/redux/features/recentlyViewed/recentlyViewedSlice";
import { useHasMounted } from "@/hooks/useHasMounted";
import { toCardProduct } from "@/lib/product";
import ProductRail from "./ProductRail";

/**
 * "Recently viewed", under the related rail: the customer's own research trail, which for tiles is
 * the shelf that matters most -- nobody buys the first floor they open, they circle back.
 *
 * One component does both halves of the job: it RECORDS the product being viewed and RENDERS the
 * ones viewed before it (never the one on screen -- a rail that leads back to this page is a dead
 * click).
 *
 * RECORDING waits for redux-persist to rehydrate. There is no PersistGate (see redux/provider.js),
 * so a dispatch on mount would land in the empty pre-rehydrate state and the REHYDRATE that follows
 * would overwrite it -- the trail would only ever be one product long.
 *
 * RENDERING waits for useHasMounted, which is a SEPARATE condition and not redundant with the one
 * above. `rehydrated` says the store has read localStorage; it says nothing about whether React has
 * hydrated yet, and redux-persist resolves in a microtask, so on a warm load it is already true
 * during the FIRST client render. The server rendered null there, the client rendered a whole rail,
 * and React threw the entire tree away and rebuilt it -- production console showed a React #418, and
 * per useHasMounted's own note that is exactly what detaches every Swiper on the page and leaves the
 * gallery and the rails blank. useHasMounted is false on the server AND on the first client render,
 * so both agree on null and the rail appears on the pass after.
 *
 * WITHOUT a `product` (the homepage, 2026-10-20) it only renders: nothing to record, nothing to
 * leave out, and the trail shown whole under its own `title`. A first-time visitor has no trail, so
 * the section is simply absent for them.
 */
export default function RecentlyViewed({ product = null, title = "Recently viewed", className = "mt-6 lg:mt-8" }) {
  const dispatch = useDispatch();
  const hasMounted = useHasMounted();
  const rehydrated = useSelector((state) => state._persist?.rehydrated);
  const products = useSelector((state) => state.recentlyViewed.products);

  useEffect(() => {
    if (rehydrated && product) dispatch(addRecentlyViewed(toCardProduct(product)));
  }, [rehydrated, product, dispatch]);

  const viewedBefore = products.filter((p) => p.handle !== product?.handle);
  if (!hasMounted || !rehydrated || viewedBefore.length === 0) return null;

  return (
    <section aria-label={title} className={`container-main ${className}`}>
      <h2 className="font-display text-lg tracking-[-0.02em] lg:text-xl">{title}</h2>
      <div className="mt-4">
        <ProductRail products={viewedBefore} priorityCount={0} list="rail:recently-viewed" />
      </div>
    </section>
  );
}
