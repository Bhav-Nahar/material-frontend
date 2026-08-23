"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { Heart, LogOut, Search, ShoppingBag, Store, User } from "lucide-react";
import PincodeControl from "./PincodeControl";
import { Icon } from "@/components/ui/icon";
import Image from "next/image";
import Wordmark from "./Wordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import SearchPopup from "./SearchPopup";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useDispatch, useSelector } from "react-redux";
import { openAuthModal } from "@/redux/features/user/userSlice";
import { syncCart, clearCart } from "@/redux/features/cart/cartSlice";
import {
  mergeGuestWishlist,
  restoreGuestWishlist,
  clearWishlist,
} from "@/redux/features/wishlist/wishlistSlice";
import { useDebounce } from "@/hooks/useDebounce";
import { apiFetch, fetchSearchResults } from "@/lib/api";

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

// Custom SVG Icons





const SEARCH_PLACEHOLDERS = [
  "Marble-look tiles",
  "Anti-skid bathroom tiles",
  "Wood-look laminates",
  "600 x 600 floor tiles",
  "Textured wallpaper",
];

export default function MainHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout: authLogout, openLogin } = useAuth();
  const [isFocused, setIsFocused] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const dispatch = useDispatch();
  const { totalQuantity, totalAmount, items } = useSelector((state) => state.cart);
  const wishlistItems = useSelector((state) => state.wishlist.items);
  // Counts come from localStorage via redux-persist: absent server-side, so gate them or the
  // whole tree fails hydration and every Swiper on the page is rebuilt into an empty box.
  const hasMounted = useHasMounted();
  // Anything that renders differently for a signed-in customer must wait for the mount, or the
  // server (always signed out) and the first client render (session already restored) disagree and
  // React throws a hydration mismatch -- a <button> on the server against an <a> on the client.
  //
  // redux-persist restores from localStorage in a microtask, which lands BEFORE hydration commits,
  // so this is not a race we can win by ordering. We deliberately have no <PersistGate> (it would
  // cost SSR on every page -- see src/redux/provider.js), and this is the price: render logged-out
  // first, swap on the next paint. Event handlers can read `user` directly; markup must use this.
  const signedIn = hasMounted && Boolean(user);

  const guestWishlistItems = useSelector((state) => state.wishlist.guestItems);

  const displayItems = items || [];

  const displayQuantity = displayItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  // COUNTS, MOUNT-GATED IN ONE PLACE. The badge digits were already guarded but the aria-labels were
  // not, so every page logged a hydration mismatch: the server rendered "Wishlist, 0 items" and the
  // client, whose localStorage had four, rendered "Wishlist, 4 items". React does not patch
  // attributes on a mismatch -- it warns and leaves the server's value -- so a screen reader was
  // being told the wrong number by the one part of this control that only a screen reader reads.
  // Derived here rather than guarded at each use, which is the mistake that produced the bug.
  const wishlistCount = hasMounted ? wishlistItems.length : 0;
  const cartCount = hasMounted ? displayQuantity : 0;

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // The cart id is an httpOnly cookie, so this is what tells the badge what is in it. Once per
  // mount: /api/cart is uncached, and a PDP add returns the new cart itself rather than asking
  // the header to re-read it.
  useEffect(() => {
    dispatch(syncCart());
  }, [dispatch]);

  useEffect(() => {
    // Handle Wishlist Sync
    if (user?.id) {
      if (wishlistItems.length === 0) {
        dispatch(mergeGuestWishlist());
      }
    } else {
      if (guestWishlistItems.length > 0) {
        if (wishlistItems.length !== guestWishlistItems.length) {
          dispatch(restoreGuestWishlist());
        }
      } else if (wishlistItems.length > 0) {
        dispatch(clearWishlist());
      }
    }
  }, [dispatch, user?.id, guestWishlistItems.length]);

  // No avatar fetch. It called /api/customer/profile/avatar, which this backend does not serve, so
  // every single login ended in a "Not Found" in the console -- and it was chasing a feature that
  // does not exist here: nothing in Material uploads an avatar, and AvatarFallback already renders
  // the customer's initials. Bring it back with the account pages, if those ever want one.

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    // `stale` kills the response race: type "mar" then "marble", and if "mar" resolves second it
    // must not overwrite "marble"'s results.
    let stale = false;
    const performSearch = async () => {
      if (debouncedSearchQuery.length > 1) {
        setIsSearching(true);
        try {
          const data = await fetchSearchResults(debouncedSearchQuery);
          if (!stale) setSearchResults(data.results || []);
        } catch (err) {
          console.error("Search error:", err);
          if (!stale) setSearchResults([]);
        } finally {
          if (!stale) setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    performSearch();
    return () => {
      stale = true;
    };
  }, [debouncedSearchQuery]);

  const suggestionData = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const getAutocompleteSuggestion = (title, query) => {
      const titleLower = title.toLowerCase();
      const queryLower = query.toLowerCase();

      if (titleLower.startsWith(queryLower)) {
        return {
          suffix: title.slice(query.length),
          completeText: title
        };
      }

      const words = title.split(" ");
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.toLowerCase().startsWith(queryLower)) {
          const suffixOfWord = word.slice(query.length);
          const remainingWords = words.slice(i + 1).join(" ");
          const suffix = suffixOfWord + (remainingWords ? " " + remainingWords : "");
          return {
            suffix: suffix,
            completeText: title
          };
        }
      }
      return null;
    };

    // 1. Try matched collections
    const matchedCol = searchResults.find(item => item.isCollection);
    if (matchedCol) {
      const match = getAutocompleteSuggestion(matchedCol.title, searchQuery);
      if (match) return match;
    }

    // 2. Try predefined placeholders
    for (const p of SEARCH_PLACEHOLDERS) {
      const match = getAutocompleteSuggestion(p, searchQuery);
      if (match) return match;
    }

    // 3. Try products
    const matchedProd = searchResults.find(item => !item.isCollection);
    if (matchedProd) {
      const match = getAutocompleteSuggestion(matchedProd.title, searchQuery);
      if (match) return match;
    }

    return null;
  }, [searchQuery, searchResults]);

  const suggestionSuffix = suggestionData ? suggestionData.suffix : "";

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e) => {
    // ArrowRight only -- Tab must remain "leave the field", never "accept the ghost text".
    if (e.key === "ArrowRight" && suggestionSuffix) {
      e.preventDefault();
      setSearchQuery(searchQuery + suggestionSuffix);
    } else if (e.key === "Enter" && searchQuery.trim().length > 0) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsFocused(false);
    }
  };

  const handleLogout = async () => {
    try {
      // No body: the backend reads nothing from it, and PII in a logout request is PII in access
      // logs for no reason.
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      authLogout();
      dispatch(clearCart());
      dispatch(restoreGuestWishlist());
      const currentPath = window.location.pathname;
      if (currentPath.startsWith("/account")) {
        router.push("/login");
      } else {
        router.refresh();
      }
    }
  };

  const showSearch = isFocused;

  return (
    <div className="bg-white relative">
      <div className="container-main flex items-center py-3 border-b border-[var(--line)]">

        {/* Logo */}
        <div className="flex items-center mr-8 lg:mr-16 shrink-0">
          <Wordmark href="/" />
        </div>

        {/* Search Input and Dropdown Wrapper */}
        <div className={`flex-1 max-w-137.5 relative ${showSearch ? "z-1001 overflow-visible" : "z-10"}`}>
          {/* Blur is handled here, on the wrapper of input + popup: it only closes when focus
              actually leaves both, so a click inside the popup never races a timeout. */}
          <div
            className="relative w-full"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false);
            }}
          >
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-900 pointer-events-none z-30">
              <Icon as={Search} />
            </div>
            <div className="relative w-full bg-paper focus-within:bg-white focus-within:ring-1 focus-within:ring-gray-200 rounded-sm transition-all h-10">
              <input
                type="text"
                placeholder=""
                className="w-full h-full pl-11.25 pr-2.5 py-2 bg-transparent text-base font-medium outline-none relative z-20"
                onFocus={() => setIsFocused(true)}
                onClick={() => {
                  setIsFocused(true);
                }}
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
              />

              {/* Autocomplete Ghost Suggestion */}
              {isFocused && searchQuery && suggestionSuffix && (
                <div className="absolute inset-0 flex items-center pointer-events-none z-10 pl-11.25 pr-2.5 py-2 text-base font-medium whitespace-pre">
                  <span className="text-transparent">{searchQuery}</span>
                  <span className="text-gray-400 select-none">{suggestionSuffix}</span>
                </div>
              )}

              {/* Animated Placeholder Ticker */}
              {!isFocused && !searchQuery && (
                <div className="absolute inset-0 flex items-center pointer-events-none z-30 overflow-hidden pl-11.25">
                  <span className="text-base text-gray-500 font-medium whitespace-nowrap">Search for&nbsp;</span>
                  <div className="relative h-full flex items-center overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={placeholderIndex}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="text-base text-gray-500 font-medium whitespace-nowrap"
                      >
                        {SEARCH_PLACEHOLDERS[placeholderIndex]}...
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showSearch && (
                <SearchPopup
                  onClose={() => setIsFocused(false)}
                  searchQuery={searchQuery}
                  searchResults={searchResults}
                  isSearching={isSearching}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Icons */}
        <div className="flex items-center justify-end ml-auto lg:gap-3 xl:gap-6 text-sm">

          {/* FIRST in the cluster, left of the account and cart icons -- CaratLane's order, and the
              reason is the reading order: "can you deliver to me" is answered before "what is in my
              bag". Hidden below lg because MobileHeader carries its own compact version; two of them
              on a tablet would both be live and disagree about which one the customer just used. */}
          <PincodeControl className="hidden lg:flex text-subtle" />


          {signedIn ? (
            <div className="relative group flex items-center">
              <Link href="/account" prefetch={false}>
                <Avatar className="h-9 w-9 cursor-pointer border border-gray-100">
                  {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                  <AvatarFallback className="bg-ink text-white font-bold text-xs">{getInitials(user?.name)}</AvatarFallback>
                </Avatar>
              </Link>

              <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 bg-white shadow-xl rounded-lg opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all duration-200 z-50">
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold">Hi, {user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>

                <Link
                  href="/account"
                  prefetch={false}
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-gray-50"
                >
                  <Icon as={User} /> My Account
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-gray-50"
                >
                  <LogOut size={19} /> Logout
                </button>
              </div>
            </div>
          ) : (
            /* Signed-out account panel, CaratLane's arrangement: hovering the icon opens a card that
               greets you, offers ONE primary action, and lists what an account holds. Two bare text
               rows made the visitor do the deciding; this makes "Log in" the obvious click and puts
               "Create account" underneath as the alternative.
               No click-to-open needed on desktop, but the icon still opens the dialog for anyone who
               clicks it, and group-focus-within keeps the panel reachable by keyboard.
               pt-2 on the wrapper is a deliberate hover bridge -- a gap between icon and card would
               close the panel as the pointer crosses it. */
            <div className="group relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-label="Log in or create an account"
                className="cursor-pointer p-1"
                onClick={() => openLogin()}
              >
                <Icon as={User} />
              </button>

              <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {/* Structure taken from CaratLane's signed-out account hover, checked in the browser
                    rather than assumed: a heading, ONE line of purpose, and two side-by-side buttons.
                    No list of account links -- a signed-out visitor cannot open My Orders, so every
                    such link is a destination that is really just this dialog again.

                    SIGN UP IS THE PRIMARY, Log In the outline. That is CaratLane's ordering and it is
                    the right one here too: a returning customer hunts for "Log In" and finds it
                    regardless, while a first-time visitor needs to be told an account is on offer. */}
                <div className="w-[300px] bg-surface p-5 shadow-[0_8px_28px_rgba(28,27,25,0.14)]">
                  <p className="font-display text-lg text-ink">Your Account</p>
                  <p className="mt-1 text-sm text-subtle">
                    Access your account and track your orders.
                  </p>

                  <div className="mt-4 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => dispatch(openAuthModal({ mode: "signup", source: "header" }))}
                      className="flex-1 bg-action py-2.5 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90"
                    >
                      Sign Up
                    </button>
                    <button
                      type="button"
                      onClick={() => openLogin()}
                      className="flex-1 border border-ink bg-surface py-2.5 text-xs uppercase tracking-wide text-ink transition-colors hover:bg-paper"
                    >
                      Log In
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {signedIn ? (
            <Link href="/account/wishlist" prefetch={false} aria-label={`Wishlist, ${wishlistCount} items`} className="relative group p-1">
              <Icon as={Heart} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              aria-label={`Wishlist, ${wishlistCount} items`}
              onClick={() => {
                const path = window.location.pathname;
                if (path !== "/login") {
                  openLogin();
                }
              }}
              className="relative group p-1"
            >
              <Icon as={Heart} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>
          )}
          <Link
            href="/checkout/cart"
            prefetch={false}
            aria-label={`Cart, ${cartCount} items`}
            className="relative group p-1"
          >
            <Icon as={ShoppingBag} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

    </div>
  );
}
