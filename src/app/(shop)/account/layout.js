"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { ChevronLeft } from "lucide-react";

import { useRehydrated } from "@/hooks/useRehydrated";
import { ACCOUNT_SECTIONS } from "./nav";

/**
 * The customer account area.
 *
 * NAMED /account, NOT /admin. The jewelry build calls this /admin, which is why its header links
 * point there -- but it is the customer's own area, not a back office, and a shopper landing on a
 * URL that says "admin" reasonably assumes they have found something they should not have.
 *
 * NAVIGATION IS A HUB ON A PHONE, A RAIL ON DESKTOP.
 *   - /account is a tappable list of sections. One screen, one job, nothing off-screen.
 *   - a section screen shows a back link and nothing else, so the content gets the full width.
 * The first attempt was a horizontally scrolling tab strip, which is the worst of both: items sit
 * off the edge with no affordance saying so, and on a 414px screen the third tab is invisible. A
 * slide-out drawer was the other option and is worse here -- it costs a tap to reach anything, and
 * this site already has a drawer for the main menu. Two different drawers is a coin toss for the
 * customer.
 *
 * THE GATE WAITS FOR REHYDRATION, and gates both the redirect and the render. `isAuthenticated` is
 * false on the first render even for a signed-in customer (no PersistGate -- see
 * src/redux/provider.js), so acting on it directly would bounce a logged-in customer to /login every
 * time they opened their own account, and the page would fetch with no token.
 */
export default function AccountLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const rehydrated = useRehydrated();
  const isAuthenticated = useSelector((state) => state.user.isAuthenticated);
  const user = useSelector((state) => state.user.user);

  const isHub = pathname === "/account";
  const section = ACCOUNT_SECTIONS.find((s) => pathname.startsWith(s.href));

  useEffect(() => {
    if (rehydrated && !isAuthenticated) router.replace("/login");
  }, [rehydrated, isAuthenticated, router]);

  // Nothing until we know. A flash of the account shell followed by a bounce to /login reads as a
  // bug even when the outcome is correct.
  if (!rehydrated || !isAuthenticated) return <div className="min-h-[60vh]" />;

  return (
    <main className="container-main mt-4 pb-16 lg:mt-8 lg:pb-24">
      {/* Phone, on a section screen: a back link instead of the page heading. The section names
          itself in its own <h2>, so repeating it here would be the third time on one screen. */}
      {!isHub && (
        <Link
          href="/account"
          className="mb-4 inline-flex items-center gap-1 text-sm text-subtle hover:text-ink lg:hidden"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Account
        </Link>
      )}

      {isHub && (
        <header className="border-b border-line pb-5">
          <h1 className="font-display text-xl tracking-[-0.02em] text-ink lg:text-2xl">
            {user?.name ? `Hello, ${user.name.split(" ")[0]}` : "Your account"}
          </h1>
          <p className="num mt-1 text-sm text-subtle">
            {[user?.mobile ? `+91 ${String(user.mobile).replace(/^91/, "")}` : null, user?.email]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>
      )}

      <div className={isHub ? "" : "grid gap-8 lg:grid-cols-12 lg:gap-10"}>
        {/* The rail is desktop-only and never on the hub, where the cards already are the navigation. */}
        {!isHub && (
          <nav className="hidden lg:col-span-3 lg:block">
            <ul className="flex flex-col gap-1">
              {ACCOUNT_SECTIONS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      prefetch={false}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center gap-2.5 border px-3.5 py-2.5 text-sm transition-colors ${
                        active
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-surface text-subtle hover:border-line-strong hover:text-ink"
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.6} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <section className={isHub ? "" : "lg:col-span-9"}>
          {/* Desktop keeps a heading on section screens; the mobile back link covers it there. */}
          {section && (
            <h1 className="mb-5 hidden font-display text-xl text-ink lg:block">{section.label}</h1>
          )}
          {children}
        </section>
      </div>
    </main>
  );
}
