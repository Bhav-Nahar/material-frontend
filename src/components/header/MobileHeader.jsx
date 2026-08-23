"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Menu, Search, Heart, ShoppingBag, Home, X, ChevronRight, ChevronLeft, User as UserIcon, LogOut, MessageCircle, Package, Store, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { clearCart } from "@/redux/features/cart/cartSlice";
import { restoreGuestWishlist } from "@/redux/features/wishlist/wishlistSlice";
import { openAuthModal } from "@/redux/features/user/userSlice";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Wordmark from "./Wordmark";
import PincodeControl from "./PincodeControl";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet as MobileSheet } from "react-modal-sheet";
import { useAuth } from "@/hooks/useAuth";
import { useHasMounted } from "@/hooks/useHasMounted";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { apiFetch, fetchSearchResults } from "@/lib/api";
import { transformMenuData } from "@/lib/menus";
import { CATEGORY_IMAGES, SEARCH_CATEGORIES, POPULAR_SEARCHES } from "@/data/catalog";
import { WHATSAPP_NUMBER } from "@/data/footer";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { Icon } from "@/components/ui/icon";
import { OPEN_MOBILE_MENU } from "@/lib/events";

// Scroll depths that drive the PDP mobile search bar. It starts collapsed to a
// bare icon beside the wishlist and expands into the full bar past EXPAND_Y,
// collapsing again below COLLAPSE_Y. The two values are deliberately apart so
// scrolling right around the boundary can't flicker the bar open and shut.
const SEARCH_EXPAND_Y = 64;
const SEARCH_COLLAPSE_Y = 40;
const SEARCH_EASE = "transition-[width,background-color] duration-[450ms] ease-[cubic-bezier(0.33,1,0.68,1)]";
const SEARCH_FADE = "transition-opacity duration-300";


const SEARCH_PLACEHOLDERS = [
  "Marble-look tiles",
  "Anti-skid bathroom tiles",
  "Wood-look laminates",
  "Textured wallpaper",
];

function SafeImage({ src, alt, fallback = null, ...props }) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      onError={() => {
        if (!hasError && fallback) {
          setHasError(true);
          setImgSrc(fallback);
        }
      }}
    />
  );
}






const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

const HighlightMatch = ({ text, query, reverse = false }) => {
  if (!query) return <span className="text-ink">{text}</span>;
  // Escaped: an unescaped "(" or "[" typed into search throws inside RegExp.
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <span className="text-ink">
      {parts.map((part, i) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        if (reverse) {
          return isMatch ? (
            part
          ) : (
            <strong key={i} className="font-bold text-black">
              {part}
            </strong>
          );
        } else {
          return isMatch ? (
            <strong key={i} className="font-semibold text-black">
              {part}
            </strong>
          ) : (
            part
          );
        }
      })}
    </span>
  );
};

export default function MobileHeader({ menuData }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const isProductPage = pathname.startsWith('/products/');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Expand the PDP search bar on scroll, collapse it again near the top. The
  // header row itself stays pinned on PDP (Header.jsx uses top: -40px, which
  // only scrolls the TopBar away), so the transition stays on screen.
  useEffect(() => {
    if (!isProductPage) {
      setIsSearchExpanded(false);
      return;
    }
    const sync = () => {
      const y = window.scrollY;
      setIsSearchExpanded((expanded) => (expanded ? y > SEARCH_COLLAPSE_Y : y > SEARCH_EXPAND_Y));
    };
    // Sync once up front as well: a restored scroll offset (back button) fires
    // no scroll event, so the bar would otherwise render collapsed halfway
    // down the page.
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [isProductPage, pathname]);

  // Order and contents come straight from the CMS menu. The jewelry build's version filtered out
  // Bestsellers and hand-ranked jewelry categories here; none of those labels exist in
  // our menu, so the filter and sort were both no-ops.
  const MEGA_MENU = useMemo(() => transformMenuData(menuData || []), [menuData]);

  const { user, logout: authLogout, openLogin } = useAuth();
  const { totalQuantity, items, totalAmount } = useSelector((state) => state.cart);
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

  const [activeMenuPath, setActiveMenuPath] = useState([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [menuDirection, setMenuDirection] = useState(1);

  useEffect(() => {
    if (!isMenuOpen) {
      setActiveMenuPath([]);
      setMenuDirection(1);
    }
  }, [isMenuOpen]);

  // The collection page's bottom bar has a Categories button, and categories ARE this menu -- a
  // second copy would be a second list to keep in step with menu-data.json.
  //
  // ponytail: a DOM event, not context or a redux slice. The header is mounted from layout.js and
  // the button is deep inside the page tree, so sharing state means a provider wrapping the whole
  // app to carry one boolean. `window` is already the thing both trees have in common.
  useEffect(() => {
    const open = () => setIsMenuOpen(true);
    window.addEventListener(OPEN_MOBILE_MENU, open);
    return () => window.removeEventListener(OPEN_MOBILE_MENU, open);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
    const matchedProd = searchResults.find(item => !item.isCollection && !item.isContent);
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
      setShowSearch(false);
    }
  };

  const handleResultClick = (href) => {
    if (!href) return;
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    router.push(href);
  };

  const renderSearchContent = () => {
    const productsOnly = searchResults.filter(item => !item.isCollection && !item.isContent);
    const contentResults = searchResults.filter(item => item.isContent);
    const matchedCollections = searchResults
      .filter(item => item.isCollection)
      .sort((a, b) => {
        const aExact = a.title.toLowerCase() === searchQuery.toLowerCase();
        const bExact = b.title.toLowerCase() === searchQuery.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });

    return (
      <div className="flex flex-col h-full bg-white px-4">
        <div className="flex items-center gap-3 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => setShowSearch(false)} className="p-1">
            <ChevronLeft size={24} strokeWidth={1.5} />
          </button>
          <div className="relative flex-grow bg-gray-50 focus-within:ring-1 focus-within:ring-gray-200 rounded-full h-11">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-30">
              <Icon as={Search} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tiles, laminates, wallpaper"
              className="w-full h-full bg-transparent pl-10 pr-10 rounded-full text-sm outline-none relative z-20"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {/* Autocomplete Ghost Suggestion */}
            {searchQuery && suggestionSuffix && (
              <div className="absolute inset-0 flex items-center pointer-events-none z-10 pl-10 pr-10 py-2 text-sm font-medium whitespace-pre">
                <span className="text-transparent">{searchQuery}</span>
                <span className="text-gray-400 select-none">{suggestionSuffix}</span>
              </div>
            )}
            {searchQuery && (
              <button
                aria-label="Clear search"
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 z-30"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <div className="grow overflow-y-auto py-4 pb-20">
          {searchQuery.length > 0 ? (
            <div className="space-y-8">
              {isSearching ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-4 animate-pulse px-2">
                      <div className="w-14 h-14 bg-gray-100 rounded-lg" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                        <div className="h-2.5 bg-gray-100 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (matchedCollections.length > 0 || productsOnly.length > 0 || contentResults.length > 0) ? (
                <>
                  {/* Collections Section */}
                  {matchedCollections.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Collections</h3>
                      <div className="space-y-2">
                        {matchedCollections.slice(0, 6).map((col) => (
                          <button
                            type="button"
                            key={col.id}
                            onClick={() => handleResultClick(col.url)}
                            className="group block p-3 bg-zinc-50 rounded-lg border border-zinc-100 active:bg-white transition-all duration-300 w-full text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-gray-900">
                                <HighlightMatch text={col.title} query={searchQuery} reverse={true} />
                              </h4>
                              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mt-1">
                                Collection
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products Section */}
                  {productsOnly.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Products</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {productsOnly.slice(0, 6).map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => handleResultClick(item.url)}
                            className="flex items-center gap-3 p-2 rounded-md active:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors w-full text-left"
                          >
                            <div className="w-16 h-16 relative rounded-md overflow-hidden shrink-0 bg-paper">
                              {item.image && (
                                <Image
                                  src={item.image}
                                  alt={item.title}
                                  fill
                                  className="object-cover w-full h-full"
                                />
                              )}
                            </div>
                            <div className="grow min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                <HighlightMatch text={item.title} query={searchQuery} />
                              </h4>
                              <p className="text-xs text-gray-500 font-bold mt-1">{item.price}</p>
                            </div>
                            <ChevronRight size={16} className="text-gray-300" strokeWidth={1.5} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blogs & Pages Section */}
                  {contentResults.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Blogs & Pages</h3>
                      <div className="space-y-2">
                        {contentResults.slice(0, 5).map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => handleResultClick(item.url)}
                            className="group block p-3 bg-zinc-50 rounded-lg border border-zinc-100 active:bg-white transition-all duration-300 w-full text-left"
                          >
                            <h4 className="text-sm font-medium text-gray-900">
                              <HighlightMatch text={item.title} query={searchQuery} />
                            </h4>
                            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mt-1">
                              {item.contentType}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleResultClick(`/search?q=${encodeURIComponent(searchQuery.trim())}`)}
                      className="w-full text-center text-primary font-bold text-sm py-3 uppercase tracking-widest hover:underline decoration-primary/30 underline-offset-4"
                    >
                      View All Results for &ldquo;{searchQuery}&rdquo;
                    </button>
                  </div>
                </>
              ) : searchQuery.length > 1 && (
                <div className="text-center py-20">
                  <p className="text-gray-500">No results found for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Categories</h3>
                <div className="grid grid-cols-3 gap-3">
                  {SEARCH_CATEGORIES.map((cat, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => handleResultClick(cat.href)}
                      className="group flex flex-col items-center w-full text-left"
                    >
                      <div className="aspect-square w-full relative rounded-md overflow-hidden mb-2 bg-transparent border border-transparent hover:border-gray-100 transition-all">
                        <Image
                          src={cat.image}
                          alt={cat.title}
                          fill
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-400"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-gray-700 text-center uppercase tracking-tight leading-tight">
                        {cat.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Popular searches. Was a "Bestseller Products" fetch against the jewelry build's
                  `bestseller` collection, which does not exist here -- it could only ever
                  render its empty state, at the cost of a request per search-panel open. */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Popular searches</h3>
                <div className="grid grid-cols-1 gap-4">
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      type="button"
                      key={item.term}
                      onClick={() => handleResultClick(item.href)}
                      className="flex items-center gap-3 p-2 rounded-md active:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors w-full text-left"
                    >
                      <div className="w-16 h-16 relative rounded-md overflow-hidden shrink-0 bg-paper">
                        {item.image && (
                          <Image src={item.image} alt="" fill className="object-cover w-full h-full" />
                        )}
                      </div>
                      <div className="grow min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">{item.term}</h4>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
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

  const getCurrentMenu = () => {
    let current = MEGA_MENU;
    for (const index of activeMenuPath) {
      const item = current[index];
      if (item.columns) {
        current = item.columns;
      } else if (item.items) {
        current = item.items;
      } else if (item.featured) {
        current = item.featured;
      }
    }
    return current;
  };

  const getActiveItem = () => {
    if (activeMenuPath.length === 0) return null;
    let current = MEGA_MENU;
    let item = null;
    for (let i = 0; i < activeMenuPath.length; i++) {
      item = current[activeMenuPath[i]];
      if (i < activeMenuPath.length - 1) {
        if (item.columns) current = item.columns;
        else if (item.items) current = item.items;
        else if (item.featured) current = item.featured;
      }
    }
    return item;
  };

  const getMenuTitle = () => {
    const activeItem = getActiveItem();
    return activeItem ? (activeItem.label || activeItem.title) : <Wordmark className="w-6" />;
  };

  const handleBack = () => {
    setMenuDirection(-1);
    setActiveMenuPath(prev => prev.slice(0, -1));
  };

  const handleItemClick = (item, index) => {
    if (item.columns || item.items || (item.featured && Array.isArray(item.featured))) {
      setMenuDirection(1);
      setActiveMenuPath(prev => [...prev, index]);
    } else if (item.href) {
      setIsMenuOpen(false);
      router.push(item.href);
    }
  };

  const renderSubMenu = (activeItem) => {
    return (
      <div className="flex flex-col px-4 py-2">
        <Accordion type="multiple" className="w-full" defaultValue={activeItem.columns?.map((_, i) => `item-${i}`)}>
          {activeItem.columns?.map((col, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`} className="border-none">
              <AccordionTrigger className="text-sm font-semibold capitalize tracking-widest hover:no-underline py-4">
                {col.title}
              </AccordionTrigger>
              <AccordionContent>
                {col.type === "icon" && (
                  <div className="grid grid-cols-3 gap-y-6 gap-x-2 pt-2">
                    {col.items.map((item, i) => {
                      const iconPath = item.menuIcon || item.megaMenuImage || item.icon;
                      const isBlogOrPage = item.href?.includes("/blogs/") || item.href?.includes("/pages/");
                      return (
                        <Link
                          key={i}
                          href={item.href || "#"}
                          prefetch={false}
                          onClick={() => setIsMenuOpen(false)}
                          className="flex flex-col items-center gap-2"
                        >
                          <div className={cn(
                            "relative flex items-center justify-center overflow-hidden",
                            isBlogOrPage ? "w-20 h-20 rounded-lg" : "w-20 h-20"
                          )}>
                            <SafeImage
                              src={iconPath}
                              alt={item.label}
                              className={cn(
                                "w-full h-full",
                                isBlogOrPage ? "object-cover" : "object-contain"
                              )}
                            />
                          </div>
                          <span className="text-[13px] text-center font-normal leading-tight">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {col.type === "text" && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {col.items.map((item, i) => (
                      <Link
                        key={i}
                        href={item.href || "#"}
                        prefetch={false}
                        onClick={() => setIsMenuOpen(false)}
                        className="bg-gray-50 px-3 py-2 text-[11px] font-medium text-center rounded-sm"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}

          {activeItem.featured && (Array.isArray(activeItem.featured) ? activeItem.featured.length > 0 : activeItem.featured.items?.length > 0) && (
            <>
              <AccordionItem value="featured" className="border-none">
                <AccordionTrigger className="text-sm font-bold uppercase tracking-widest hover:no-underline py-4">
                  {activeItem.featured.title || "Featured"}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col space-y-3 pt-2">
                    {(Array.isArray(activeItem.featured) ? activeItem.featured : activeItem.featured.items).map((f, i) => {
                      const fIcon = f.menuIcon || f.icon || f.megaMenuImage;
                      const isBlogOrPage = f.href?.includes("/blogs/") || f.href?.includes("/pages/");
                      return (
                        <Link key={i} href={f.href || "#"} prefetch={false} onClick={() => setIsMenuOpen(false)} className="text-sm font-medium text-gray-900 flex items-center gap-3">
                          {fIcon && (
                            <div className={cn(
                              "relative flex items-center justify-center bg-gray-50 overflow-hidden shrink-0",
                              isBlogOrPage ? "w-10 h-10 rounded-lg" : "w-8 h-8 rounded-full"
                            )}>
                              <SafeImage
                                src={fIcon}
                                alt={f.label}
                                className={cn(
                                  "w-full h-full",
                                  isBlogOrPage ? "object-cover" : "object-contain p-1"
                                )}
                              />
                            </div>
                          )}
                          {f.label}
                        </Link>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {!Array.isArray(activeItem.featured) && activeItem.featured.featuredIn && activeItem.featured.featuredIn.items?.length > 0 && (
                <AccordionItem value="featuredIn" className="border-none">
                  <AccordionTrigger className="text-sm font-bold uppercase tracking-widest hover:no-underline py-4">
                    {activeItem.featured.featuredIn.title || "Featured In"}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col space-y-3 pt-2">
                      {activeItem.featured.featuredIn.items.map((f, i) => {
                        const fIcon = f.menuIcon || f.icon || f.megaMenuImage;
                        return (
                          <Link key={i} href={f.href || "#"} prefetch={false} onClick={() => setIsMenuOpen(false)} className="text-sm font-medium text-gray-900 flex items-center gap-3">
                            {fIcon && (
                              <div className="w-8 h-8 relative flex items-center justify-center bg-gray-50 rounded-full overflow-hidden shrink-0">
                                <SafeImage
                                  src={fIcon}
                                  alt={f.label}
                                  className="w-6 h-6 object-contain"
                                />
                              </div>
                            )}
                            {f.label}
                          </Link>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </>
          )}
        </Accordion>
      </div>
    );
  };

  const isAuthPage = pathname === "/login";

  const handleAuthTrigger = () => {
    if (isAuthPage) return;
    openLogin();
  };

  const renderCollectionsGrid = (activeItem) => {
    const items = activeItem.items || activeItem.cards || [];
    // Cotton Candy is desktopOnly here because on mobile it already has a card
    // in the image grid above.
    const quickLinks = (activeItem.quickLinks || []).filter((q) => !q.desktopOnly);
    return (
      <div className="flex flex-col pb-8">
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          {items.map((item, index) => {
            const label = item.title || item.label;
            const image = item.image || CATEGORY_IMAGES[label] || null;
            return (
              <Link
                key={index}
                href={item.href || "#"}
                prefetch={false}
                onClick={() => setIsMenuOpen(false)}
                className="relative aspect-4/4 overflow-hidden rounded-lg group bg-zinc-100"
              >
                <Image
                  src={image}
                  alt={label}
                  fill
                  className="object-cover transition-transform group-active:scale-105"
                />
                <div className="drawer-menu-image absolute inset-0 bg-black/10 group-active:bg-black/20 transition-colors" />
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="absolute bottom-0 left-0 text-white text-sm leading-none tracking-normal font-medium capitalize sm:static sm:text-base sm:leading-normal sm:tracking-wide">
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {quickLinks.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 px-4">
            {quickLinks.map((link, index) => (
              <Link
                key={index}
                href={link.href || "#"}
                prefetch={false}
                onClick={() => setIsMenuOpen(false)}
                className="bg-paper rounded-xl p-2 flex items-center gap-2 active:bg-gray-200 transition-all border border-gray-50/50"
              >
                <span className="relative w-10 h-10 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={link.image}
                    alt={link.label}
                    fill
                    className="object-contain p-0.5"
                  />
                </span>
                <span className="text-[13px] font-medium text-zinc-900 leading-tight truncate">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMainMenu = () => {
    return (
      <div className="flex flex-col pb-8">
        {/* Text Category Links Grid */}
        <div className="grid grid-cols-2 gap-2.5 px-4 py-4">
          {MEGA_MENU.map((item, index) => {
            const label = item.label || item.title;
            const isBadged = false;
            const isExpress = false;
            const icon = item.menuIcon || null;

            return (
              <button
                key={index}
                onClick={() => {
                  handleItemClick(item, index);
                }}
                className="bg-paper rounded-xl p-2 text-left flex items-center gap-2 active:bg-gray-200 transition-all border border-gray-50/50"
              >
                <div className={cn(
                  "relative shrink-0 overflow-hidden rounded-lg flex items-center justify-center p-1",
                  isExpress ? "w-10 h-10" : "w-11 h-11"
                )}>
                  {icon && (
                    <Image
                      src={icon}
                      alt={label}
                      fill
                      className={cn(
                        "object-contain",
                        isExpress ? "p-2" : "p-0.5"
                      )}
                    />
                  )}
                </div>
                <div className="flex flex-col grow min-w-0">
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-[13px] font-semibold leading-tight text-gray-900 line-clamp-2">
                      {label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-6">
          <div className="px-4">
          </div>
          <div className="bg-paper mx-4 p-4 space-y-4 rounded-lg">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                if (!user) {
                  handleAuthTrigger();
                } else {
                  router.push("/account/orders");
                }
              }}
              className="w-full text-left block tracking-wider border-b border-gray-200 pb-3 font-medium text-sm leading-none align-middle capitalize text-black"
            >
              Track Your Order
            </button>
            {/* /pages/contact, the handle the footer links and Shopify publishes — /pages/contact-us 404'd. */}
            <Link href="/pages/contact" prefetch={false} onClick={() => setIsMenuOpen(false)} className="block tracking-wider border-b border-gray-200 pb-3 font-medium text-sm leading-none align-middle capitalize text-black">
              Contact Us
            </Link>
            <Link href="/pages/faqs" prefetch={false} onClick={() => setIsMenuOpen(false)} className="block text-[16px] tracking-wider font-medium text-sm leading-none align-middle capitalize text-black">
              FAQs
            </Link>
          </div>

          <div className="px-4 space-y-1">
            {/* The REAL number from data/footer.js — this shipped pointing at +91 0000000000, so
                every enquiry from the menu's most prominent contact card silently died. */}
            <a href={buildWhatsappLink(WHATSAPP_NUMBER, ["I want to know more about Material"])} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 border border-gray-100 rounded-lg group active:bg-gray-50 bg-paper">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_1043_46659)">
                      <path d="M0.427148 9.88041C0.42668 11.5608 0.86918 13.2016 1.71059 14.6478L0.34668 19.589L5.44293 18.2631C6.85249 19.0245 8.43179 19.4235 10.0367 19.4236H10.0409C15.3389 19.4236 19.6517 15.1458 19.6539 9.88793C19.655 7.3401 18.6559 4.94428 16.8407 3.1418C15.0259 1.33948 12.6122 0.346378 10.0405 0.345215C4.74184 0.345215 0.429414 4.62273 0.427227 9.88041" fill="url(#paint0_linear_1043_46659)"></path>
                      <path d="M0.0835938 9.87721C0.0830469 11.6181 0.541406 13.3175 1.41281 14.8155L0 19.9339L5.27898 18.5605C6.73352 19.3474 8.37117 19.7622 10.0376 19.7629H10.0419C15.53 19.7629 19.9977 15.3312 20 9.88512C20.0009 7.24574 18.9659 4.7638 17.0859 2.89674C15.2057 1.02992 12.7057 0.00108527 10.0419 0C4.55281 0 0.0857813 4.43101 0.0835938 9.87721ZM3.22742 14.5575L3.03031 14.2471C2.20172 12.9398 1.76437 11.4291 1.765 9.87783C1.76672 5.35109 5.47953 1.66822 10.045 1.66822C12.2559 1.66915 14.3337 2.52434 15.8966 4.07597C17.4593 5.62775 18.3192 7.69054 18.3187 9.8845C18.3166 14.4112 14.6037 18.0946 10.0419 18.0946H10.0386C8.5532 18.0938 7.09641 17.698 5.82594 16.95L5.52359 16.7721L2.39094 17.5871L3.22742 14.5575Z" fill="url(#paint1_linear_1043_46659)"></path>
                      <path d="M7.55254 5.74776C7.36613 5.33668 7.16996 5.32838 6.9927 5.32117C6.84754 5.31497 6.6816 5.31544 6.51582 5.31544C6.34988 5.31544 6.08027 5.37738 5.85238 5.62427C5.62426 5.87141 4.98145 6.46862 4.98145 7.68327C4.98145 8.89792 5.87309 10.0719 5.99738 10.2368C6.12184 10.4013 7.71871 12.9737 10.2478 13.9633C12.3496 14.7857 12.7774 14.6222 13.2336 14.5809C13.6898 14.5399 14.7057 13.9839 14.913 13.4074C15.1204 12.8309 15.1204 12.3368 15.0582 12.2336C14.9961 12.1307 14.8301 12.0689 14.5813 11.9455C14.3325 11.8221 13.1091 11.2247 12.8811 11.1423C12.6529 11.06 12.4871 11.0189 12.3211 11.2661C12.1552 11.513 11.6787 12.0689 11.5335 12.2336C11.3884 12.3986 11.2432 12.4192 10.9944 12.2957C10.7454 12.1718 9.9441 11.9114 8.9934 11.0704C8.25371 10.416 7.75434 9.60784 7.60918 9.36063C7.46402 9.11381 7.59363 8.98001 7.7184 8.85699C7.8302 8.74637 7.9673 8.56869 8.09184 8.42459C8.2159 8.2804 8.2573 8.17753 8.34027 8.01288C8.42332 7.84807 8.38176 7.70389 8.31965 7.5804C8.2573 7.45691 7.77379 6.2359 7.55254 5.74776Z" fill="white"></path>
                    </g>
                    <defs>
                      <linearGradient id="paint0_linear_1043_46659" x1="965.71" y1="1924.73" x2="965.71" y2="0.345215" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#1FAF38"></stop>
                        <stop offset="1" stopColor="#60D669"></stop>
                      </linearGradient>
                      <linearGradient id="paint1_linear_1043_46659" x1="1000" y1="1993.39" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#F9F9F9"></stop>
                        <stop offset="1" stopColor="white"></stop>
                      </linearGradient>
                      <clipPath id="clip0_1043_46659">
                        <rect width="20" height="20" fill="white"></rect>
                      </clipPath>
                    </defs>
                  </svg>
                </div>
                <div>
                  <h4 className="block mb-2 font-semibold text-sm leading-none align-middle text-black">WhatsApp Us</h4>
                  <p className="mt-3 font-normal text-[12px] leading-[1.4] align-middle text-black">Chat with us for stock, sizes, prices or a quick question.</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-black" strokeWidth={1.5} />
            </a>

          </div>

          <div className="px-4 pb-8">
            {signedIn ? (
              <button onClick={handleLogout} className="w-full bg-ink text-white py-4 rounded font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                <LogOut size={20} strokeWidth={1.5} /> Logout
              </button>
            ) : (
              /* Same ordering as MainHeader's signed-out panel: Sign Up primary, Log In outline. */
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setIsMenuOpen(false); if (!isAuthPage) dispatch(openAuthModal({ mode: "signup", source: "header" })); }} className="bg-ink text-white py-4 rounded font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                  <UserIcon size={20} strokeWidth={1.5} /> Sign Up
                </button>
                <button onClick={() => { setIsMenuOpen(false); handleAuthTrigger(); }} className="border border-ink text-ink py-4 rounded font-bold uppercase tracking-widest text-sm flex items-center justify-center">
                  Log In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const activeItem = getActiveItem();

  return (
    <div className="bg-white border-b border-gray-200 lg:hidden">
      {/* container-main, not px-4: their flat 16px left the wordmark 7px outboard of every
          section below it, because the page gutter is fluid (clamp(1rem, 3vw, 2.5rem)) and only
          equals 16px on a phone. The mismatch showed from ~533px up. */}
      <div className={cn("container-main flex items-center justify-between py-3", isProductPage && "gap-3")}>
        <div className={cn("flex items-center shrink-0", isProductPage ? "gap-2.5" : "gap-4")}>
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button aria-label="Open menu" className="p-1">
                <Menu size={24} strokeWidth={1.5} />
              </button>
            </SheetTrigger>
            {/* aria-describedby={undefined}: same as CategorySheet -- Radix warns when a
                DialogContent has no description, and a nav sheet has nothing to describe.
                h-dvh, not h-screen: 100vh includes the area behind iOS Safari's toolbar,
                which clipped the menu's bottom row. */}
            <SheetContent side="left" className="w-full p-0 border-none" showCloseButton={false} aria-describedby={undefined}>
              <div className="flex flex-col h-dvh bg-white overflow-hidden">
                <SheetHeader className="px-4 py-4 border-b border-gray-200 flex flex-row items-center justify-between sticky top-0 bg-white z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    {activeMenuPath.length > 0 ? (
                      <>
                        <button aria-label="Back" onClick={handleBack} className="p-1 mr-1">
                          <ChevronLeft size={20} strokeWidth={1.5} />
                        </button>
                        <SheetTitle className="text-sm capitalize tracking-widest font-semibold leading-none align-middle">
                          {getMenuTitle()}
                        </SheetTitle>
                      </>
                    ) : (
                      <SheetTitle className="flex items-center">
                        <Wordmark />
                      </SheetTitle>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {signedIn ? (
                      <Link href="/account" prefetch={false} onClick={() => setIsMenuOpen(false)} className="p-1">
                        <Avatar className="h-7 w-7 cursor-pointer border border-gray-100">
                          {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                          <AvatarFallback className="bg-ink text-white font-bold text-[10px]">{getInitials(user?.name)}</AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <button onClick={() => { setIsMenuOpen(false); handleAuthTrigger(); }} className="p-1">
                        <Icon as={UserIcon} />
                      </button>
                    )}
                    <Link href="/checkout/cart" prefetch={false} onClick={() => setIsMenuOpen(false)} className="relative p-1">
                      <Icon as={ShoppingBag} />
                      {cartCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                          {cartCount}
                        </span>
                      )}
                    </Link>
                    <SheetClose asChild>
                      <button aria-label="Close menu" className="p-1">
                        <X size={24} strokeWidth={1.5} />
                      </button>
                    </SheetClose>
                  </div>
                </SheetHeader>

                <ScrollArea className="grow h-full overflow-y-auto overflow-x-hidden">
                  <AnimatePresence mode="wait" initial={false} custom={menuDirection}>
                    <motion.div
                      key={activeMenuPath.join('-') || 'root'}
                      custom={menuDirection}
                      variants={{
                        initial: (dir) => ({ x: dir === 1 ? '100%' : '-100%', opacity: 0.5 }),
                        animate: { x: 0, opacity: 1 },
                        exit: (dir) => ({ x: dir === 1 ? '-30%' : '100%', opacity: 0 }),
                      }}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
                    >
                      {activeMenuPath.length === 0 ? renderMainMenu() : (
                        (activeItem?.type === 'image-grid' || (activeItem?.label || activeItem?.title || '').toLowerCase().trim() === 'collections')
                          ? renderCollectionsGrid(activeItem)
                          : renderSubMenu(activeItem)
                      )}
                    </motion.div>
                  </AnimatePresence>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" prefetch={false} className="flex items-center shrink-0">
            {isProductPage ? (
              // ONE wordmark behind an animating clip. The wrapper's width is the whole
              // animation: 114px shows MATERIAL entire (measured at text-2xl), 20px leaves
              // exactly the M -- the first letter IS the logo-mark, so there is no second
              // element to cross-fade and nothing to mis-position. The previous version
              // stacked two unpositioned wordmarks here and clipped both mid-word.
              <span
                className={cn("relative block h-9 overflow-hidden", SEARCH_EASE)}
                style={{ width: isSearchExpanded ? 20 : 114 }}
              >
                <Wordmark className="h-9 whitespace-nowrap" />
              </span>
            ) : (
              <Wordmark />
            )}
          </Link>
        </div>

        {isProductPage && (
          // The bar always lives in this flexible middle slot and is right-aligned
          // inside it, so at its collapsed 40px it sits flush beside the wishlist
          // icon and grows leftwards from there. One element morphing, not two
          // cross-fading. Height is pinned at h-10 in both states so the header
          // never changes height and the PDP content below never jumps.
          <div className="grow min-w-0 flex">
            <button
              type="button"
              aria-label="Search"
              aria-expanded={isSearchExpanded}
              onClick={() => {
                setShowSearch(true);
              }}
              className={cn(
                "ml-auto h-10 px-2.5 rounded-md flex items-center cursor-pointer overflow-hidden gap-2.5",
                SEARCH_EASE,
                isSearchExpanded ? "bg-paper" : "bg-transparent"
              )}
              style={{ width: isSearchExpanded ? "100%" : 40 }}
            >
              <div className="text-gray-500 shrink-0 flex items-center justify-center">
                <Icon as={Search} />
              </div>
              <span
                className={cn(
                  "text-[14px] text-gray-500 font-medium whitespace-nowrap",
                  SEARCH_FADE,
                  isSearchExpanded ? "opacity-100 delay-100" : "opacity-0"
                )}
              >
                Search here
              </span>
            </button>
          </div>
        )}

        <div className={cn("flex items-center shrink-0", isProductPage ? "gap-3" : "gap-4")}>
          {!isProductPage && (
            <>

              {/* COMPACT: the pin glyph alone until a pincode is set, then the six digits beside it.
                  Not on the PDP -- that page has PincodeCheck in its own buy box, and two controls
                  for one value on one screen is how they end up disagreeing.

                  CaratLane ships NOTHING here: their mobile header has no pincode at all, and they
                  push the job onto a per-card "Check Delivery Date" link plus an auto-popup. That
                  works when every card carries a delivery promise; ours do not, so the header is the
                  only place a phone customer can answer this without opening a product. */}
              <PincodeControl compact className="p-1 text-subtle" />

              {/* NO ACCOUNT SLOT HERE AT ALL (user, 2026-08-23). Both faces of it -- the signed-out
                  person icon and the signed-in avatar -- lived here and both were a second route to
                  something the menu already carries: the menu's footer has "Log In" and "Sign Up" in
                  words, and its own header carries the avatar. On a 360px bar, four icons compete
                  with the wordmark; three do not. Account is a place you go deliberately, not
                  something you need one tap from on every page -- unlike the cart, which is where the
                  money is, and the wishlist, which is the thing the heart on every card feeds. */}
            </>
          )}

          {/* A real Link only when there is somewhere to go. Signed out, href="#" scroll-jumped
              to the top and left a stray hash -- a button opens the login dialog and nothing else. */}
          {signedIn ? (
            <Link href="/account/wishlist" prefetch={false} aria-label={`Wishlist, ${wishlistCount} items`} className="relative p-1">
              <Icon as={Heart} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {wishlistCount}
                </span>
              )}
            </Link>
          ) : (
            <button type="button" onClick={handleAuthTrigger} aria-label={`Wishlist, ${wishlistCount} items`} className="relative p-1">
              <Icon as={Heart} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {wishlistCount}
                </span>
              )}
            </button>
          )}
          <Link href="/checkout/cart" prefetch={false} aria-label={`Cart, ${cartCount} items`} className="relative p-1">
            <Icon as={ShoppingBag} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {!isProductPage && (
        <div className="px-4 py-2 bg-white">
          <button
            type="button"
            aria-label="Search"
            onClick={() => {
              setShowSearch(true);
            }}
            className="relative w-full bg-paper h-10 pl-10 pr-4 rounded-sm flex items-center cursor-pointer border border-transparent transition-all overflow-hidden"
          >
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Icon as={Search} />
            </div>
            <div className="relative h-full w-full flex items-center overflow-hidden ml-0.5">
              <span className="text-[14px] text-gray-500 font-medium whitespace-nowrap">Search for&nbsp;</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholderIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="text-[14px] text-gray-500 font-medium whitespace-nowrap"
                >
                  {SEARCH_PLACEHOLDERS[placeholderIndex]}...
                </motion.span>
              </AnimatePresence>
            </div>
          </button>
        </div>
      )}

      <MobileSheet
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        detents={[1]}
      >
        <MobileSheet.Container>
          <MobileSheet.Header />
          <MobileSheet.Content>
            {renderSearchContent()}
          </MobileSheet.Content>
        </MobileSheet.Container>
        <MobileSheet.Backdrop />
      </MobileSheet>
    </div>
  );
}