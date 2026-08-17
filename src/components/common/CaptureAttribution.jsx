"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";

import { getStoredUtms, saveUtmsFromUrl } from "@/lib/attribution";
import {
  gtmCustomer,
  gtmMarketing,
  pushCustomerData,
  pushMarketingData,
  pushPageView,
} from "@/lib/gtm";

/**
 * Shopify's own page-type vocabulary, because that is what a GTM container's remarketing and feed
 * tags already switch on. `other` rather than a guess for anything unlisted.
 */
const pageType = (pathname) => {
  if (pathname === "/") return "index";
  if (pathname.startsWith("/collections")) return "collection";
  if (pathname.startsWith("/products")) return "product";
  if (pathname === "/checkout/cart") return "cart";
  if (pathname.startsWith("/checkout")) return "checkout";
  if (pathname.startsWith("/blog")) return "article";
  if (pathname.startsWith("/pages")) return "page";
  if (pathname.startsWith("/account")) return "account";
  if (pathname === "/login") return "login";
  return "other";
};

const deviceType = () => {
  if (typeof window === "undefined") return "";
  return window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
};

/**
 * Renders nothing, runs on every navigation, and is the only chance this store gets to read a UTM:
 * the parameters are in the landing URL for one page view and gone the moment the customer clicks
 * anything.
 *
 * On every route change rather than on mount alone, because a campaign link can land anywhere --
 * a PDP, a collection, the homepage -- and an app-router navigation does not remount the layout.
 *
 * pageView and marketingData ride along here rather than in a component of their own: they need
 * exactly the same two hooks on exactly the same schedule, and the capture MUST run first --
 * `marketingData` reads the stored attribution, and reading it before this navigation's UTMs are
 * written would report the previous campaign on the page the new one landed on.
 */
function Capture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useSelector((state) => state.user.user);
  const isAuthenticated = useSelector((state) => state.user.isAuthenticated);

  useEffect(() => {
    saveUtmsFromUrl(searchParams);

    pushPageView({
      page_type: pageType(pathname),
      page_path: pathname,
      page_url: typeof window !== "undefined" ? window.location.href : "",
      page_title: typeof document !== "undefined" ? document.title : "",
      page_referrer: typeof document !== "undefined" ? document.referrer : "",
      device_type: deviceType(),
    });

    // From the STORE, not from this URL. A customer who arrived on a paid ad three pages ago has no
    // utm_source in the address bar any more, and reporting "" for them is what makes a paid
    // funnel look like direct traffic from the second page view onwards.
    pushMarketingData(gtmMarketing(getStoredUtms()));
  }, [pathname, searchParams]);

  // Separate effect, keyed on WHO rather than on where: this is a fact about the session, and
  // re-pushing it on every navigation would bury the events that mean something.
  const lastCustomerRef = useRef(null);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const key = String(user.id ?? user.email ?? "");
    if (lastCustomerRef.current === key) return;
    lastCustomerRef.current = key;

    // Same four fields as login / signup / logout, from the same mapper -- one container variable
    // reads the customer off any of them.
    pushCustomerData({ ...gtmCustomer(user), device_type: deviceType() });
  }, [isAuthenticated, user]);

  return null;
}

export default function CaptureAttribution() {
  // useSearchParams needs a Suspense boundary, or every page using this layout is forced dynamic.
  return (
    <Suspense fallback={null}>
      <Capture />
    </Suspense>
  );
}
