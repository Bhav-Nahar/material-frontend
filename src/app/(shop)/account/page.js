"use client";

import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";

import { logoutApi } from "@/lib/api";
import { pushLogout } from "@/lib/gtm";
import { logout } from "@/redux/features/user/userSlice";
import { clearCart } from "@/redux/features/cart/cartSlice";
import { ACCOUNT_SECTIONS } from "./nav";

/**
 * The account hub: the whole area in one screen.
 *
 * Rows on a phone, cards on desktop -- the same three links either way, so nothing is ever hidden
 * behind a scroll or a drawer. Each row carries a one-line hint, because "My profile" and
 * "My addresses" both sound like "where my details are" until one of them says what it is for.
 */
export default function AccountHub() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector((state) => state.user.user);

  const signOut = async () => {
    // Before the dispatch that clears it -- `logout` empties the user slice, so reading it after
    // would report an empty customer on every sign-out.
    pushLogout(user);
    // Best-effort: the cookie is the server's copy, and failing to clear it must not strand someone
    // in a session they have asked to leave.
    await logoutApi().catch(() => {});
    dispatch(logout());
    dispatch(clearCart());
    router.replace("/");
  };

  return (
    <div className="mt-5">
      <ul className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {ACCOUNT_SECTIONS.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              prefetch={false}
              className="flex items-center gap-4 border border-line bg-surface p-4 transition-colors hover:border-line-strong lg:h-full lg:flex-col lg:items-start lg:gap-3 lg:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center border border-line bg-paper text-ink">
                <Icon size={18} strokeWidth={1.6} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink lg:text-base">{label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-subtle">{hint}</span>
              </span>

              {/* The chevron is the phone affordance -- a row that navigates has to look like it
                  navigates. On desktop the card shape already says so. */}
              <ChevronRight size={18} strokeWidth={1.5} className="shrink-0 text-meta lg:hidden" />
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={signOut}
        className="mt-6 flex w-full items-center justify-center gap-2 border border-line bg-surface py-3 text-sm text-subtle transition-colors hover:border-bad hover:text-bad lg:w-auto lg:px-6"
      >
        <LogOut size={15} strokeWidth={1.6} />
        Log out
      </button>
    </div>
  );
}
