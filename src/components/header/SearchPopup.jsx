"use client";

import { useState, useEffect } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SEARCH_CATEGORIES, POPULAR_SEARCHES } from "@/data/catalog";

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

export default function SearchPopup({
  onClose,
  searchQuery,
  searchResults,
  isSearching,
}) {
  // Extract matched collections, products and editorial content (blogs / pages)
  const productsOnly = searchResults.filter((item) => !item.isCollection && !item.isContent);
  const contentResults = searchResults.filter((item) => item.isContent);

  // Prioritize exact matches in collections
  const matchedCollections = searchResults
    .filter((item) => item.isCollection)
    .sort((a, b) => {
      const aExact = a.title.toLowerCase() === searchQuery.toLowerCase();
      const bExact = b.title.toLowerCase() === searchQuery.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-screen max-w-225 bg-white rounded-lg shadow-2xl z-999 border border-gray-100 overflow-hidden pointer-events-auto max-h-[85vh] md:max-h-none flex flex-col"
    >
      <div className="p-5 md:p-8 overflow-y-auto">
        <div className="animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8 md:gap-10">
            {/* Left Column: Products (Shows when typing) */}
            <div className="md:pr-10 lg:border-r border-gray-100 flex flex-col">
              <h3 className="text-sm md:text-base font-semibold mb-4 md:mb-6 text-ink uppercase tracking-wider">
                {searchQuery.length === 0 ? "Popular searches" : "Search Results"}
              </h3>

              {/* Was a "Bestseller Products" fetch against their `bestseller` collection,
                  which does not exist here -- it could only ever render its empty state, at the
                  cost of a request every time the search bar was focused. */}
              {searchQuery.length === 0 ? (
                <div className="space-y-4 md:space-y-5">
                  {POPULAR_SEARCHES.map((item) => (
                    <Link
                      key={item.term}
                      href={item.href}
                      prefetch={false}
                      onClick={onClose}
                      className="group flex gap-3 md:gap-4 items-center"
                    >
                      <div className="w-12 h-12 md:w-14 md:h-14 relative rounded-md overflow-hidden shrink-0 bg-paper">
                        {item.image && (
                          <Image src={item.image} alt="" fill className="object-cover w-full h-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs md:text-sm font-medium text-gray-800 truncate group-hover:text-primary transition-colors">
                          {item.term}
                        </h4>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : isSearching ? (
                <div className="space-y-4 md:space-y-5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-100 rounded-sm" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                        <div className="h-2.5 bg-gray-100 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : productsOnly.length > 0 ? (
                <div className="space-y-4 md:space-y-5">
                  {productsOnly.slice(0, 6).map((item) => (
                    <Link
                      key={item.id}
                      href={item.url}
                      prefetch={false}
                      onClick={onClose}
                      className="group flex gap-3 md:gap-4 items-center"
                    >
                      {item.url.includes('/pages/') || item.url.includes('/blogs/') ? (
                        <div className="w-12 h-12 md:w-14 md:h-14 relative rounded-md overflow-hidden shrink-0 bg-zinc-100 flex items-center justify-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            {item.url.includes('/pages/') ? 'Page' : 'Blog'}
                          </span>
                        </div>
                      ) : (
                        <div className="w-12 h-12 md:w-14 md:h-14 relative rounded-md overflow-hidden shrink-0 bg-paper">
                          {item.image && (
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              className="object-cover w-full h-full"
                            />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs md:text-sm font-medium text-gray-800 truncate group-hover:text-primary transition-colors">
                          <HighlightMatch
                            text={item.title}
                            query={searchQuery}
                          />
                        </h4>
                        {item.price && (
                          <p className="text-xs font-bold text-gray-900 mt-0.5">
                            {item.price}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 md:py-10 text-center">
                  <p className="text-gray-400 text-xs md:text-sm italic">
                    No matching products found
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Initial Categories or Dynamic Collection Suggestions */}
            <div>
              {searchQuery.length === 0 ? (
                <>
                  <h3 className="text-xs md:text-sm font-semibold mb-4 md:mb-6 text-ink uppercase tracking-wider">
                    Categories
                  </h3>
                  <div className="grid grid-cols-3 gap-3 md:gap-5">
                    {SEARCH_CATEGORIES.map((cat, i) => (
                      <Link
                        key={i}
                        href={cat.href}
                        prefetch={false}
                        onClick={onClose}
                        className="group"
                      >
                        <div className="aspect-4/3 relative rounded-md overflow-hidden mb-1.5 md:mb-2.5 bg-transparent">
                          <Image
                            src={cat.image}
                            alt={cat.title}
                            fill
                            className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                        <p className="text-xs font-medium text-gray-700 text-center group-hover:text-primary transition-colors leading-tight">
                          {cat.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xs md:text-sm font-semibold mb-4 md:mb-6 text-ink uppercase tracking-wider">
                    Collection
                  </h3>
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                    {matchedCollections.length > 0 ? (
                      matchedCollections.map((col) => (
                        <Link
                          key={col.id}
                          href={col.url}
                          prefetch={false}
                          onClick={onClose}
                          className="group block p-3 bg-zinc-50 rounded-lg border border-zinc-100 hover:border-primary/20 hover:bg-white transition-all duration-300"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">
                              <HighlightMatch
                                text={col.title}
                                query={searchQuery}
                                reverse={true}
                              />
                            </h4>
                            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mt-1">
                              Collection
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-gray-400 text-xs italic">
                          No matching collections found
                        </p>
                      </div>
                    )}
                  </div>

                  {contentResults.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-xs md:text-sm font-semibold mb-3 text-ink uppercase tracking-wider">
                        Blogs & Pages
                      </h3>
                      <div className="space-y-2">
                        {contentResults.slice(0, 5).map((item) => (
                          <Link
                            key={item.id}
                            href={item.url}
                            prefetch={false}
                            onClick={onClose}
                            className="group block p-3 bg-zinc-50 rounded-lg border border-zinc-100 hover:border-primary/20 hover:bg-white transition-all duration-300"
                          >
                            <h4 className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors">
                              <HighlightMatch text={item.title} query={searchQuery} />
                            </h4>
                            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mt-1">
                              {item.contentType}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {searchQuery.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-50">
                  <Link
                    href={`/search?q=${encodeURIComponent(searchQuery)}`}
                    prefetch={false}
                    onClick={onClose}
                    className="text-primary font-bold text-xs md:text-sm underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all uppercase tracking-widest"
                  >
                    View All Results for "{searchQuery}"
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
