"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * The category grid and the sheet it opens. Wakefit's behaviour: a tile does not go to the
 * collection, it opens a panel of that category's sub-collections -- right side on desktop, bottom
 * on a phone. One <Sheet> for the whole grid, keyed by which handle is open, rather than one per
 * tile.
 *
 * The panel carries ONE facet, the visual one -- "Shop by look" for tiles and laminates, "Shop by
 * pattern" for wallpaper -- as photo cards, which is Wakefit's arrangement. Room, finish and size
 * stay in the mega menu: they are word facets with nothing to photograph.
 *
 * ponytail: radix Sheet, already installed and already carrying `side`. No vaul drawer, no second
 * component for the mobile case -- useMediaQuery flips the side.
 */
export default function CategorySheet({ categories }) {
  const [openHandle, setOpenHandle] = useState(null);
  // Matches Tailwind's lg. Renders false on the server and on first paint, so the sheet starts as
  // the mobile one and corrects after mount -- it is closed at that point either way.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const active = categories.find((c) => c.handle === openHandle);

  const tile = (category) => (
    <>
      <span className="relative block aspect-[4/3] overflow-hidden rounded-sm border border-line bg-surface">
        <Image
          src={category.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, 50vw"
          className="object-cover"
        />
      </span>
      <span className="mt-3 block text-sm text-ink underline-offset-4 group-hover:underline lg:text-base">
        {category.title}
      </span>
    </>
  );

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
        {categories.map((category) => (
          <li key={category.handle}>
            {/* Nothing to open: go straight to the collection rather than showing an empty panel. */}
            {category.looks.length === 0 ? (
              <Link
                href={`/collections/${category.handle}`}
                prefetch={false}
                className="group block text-left"
              >
                {tile(category)}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setOpenHandle(category.handle)}
                className="group block w-full cursor-pointer text-left"
              >
                {tile(category)}
              </button>
            )}
          </li>
        ))}
      </ul>

      <Sheet open={active != null} onOpenChange={(next) => !next && setOpenHandle(null)}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          // radix wants a description or an explicit opt-out; a list of links needs no prose.
          aria-describedby={undefined}
          // The built-in close sits absolutely at top-right with no z-index, so the sticky header
          // painted over it. Ours lives IN the header instead, which is where Wakefit's is anyway.
          showCloseButton={false}
          className="gap-0 rounded-none p-0 sm:max-w-none lg:w-[36rem]"
        >
          {/* Sticky so the title stays with the list while it scrolls, as Wakefit's does. */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-background px-5 py-4">
            <SheetTitle className="font-display text-lg tracking-[-0.02em] lg:text-xl">
              {active?.title}
            </SheetTitle>
            <SheetClose
              aria-label="Close"
              className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-subtle hover:text-ink"
            >
              <X size={18} strokeWidth={1.5} />
            </SheetClose>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-5 py-5 lg:max-h-none lg:flex-1">
            {active?.lookTitle && (
              <h3 className="mb-3 text-[11px] uppercase tracking-wide text-subtle">
                {active.lookTitle}
              </h3>
            )}

            {/* Photo cards, Wakefit's arrangement: square crop, label centred beneath. */}
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {active?.looks.map((look) => (
                <li key={look.href}>
                  <Link
                    href={look.href}
                    prefetch={false}
                    onClick={() => setOpenHandle(null)}
                    className="group block"
                  >
                    <span className="relative block aspect-swatch overflow-hidden rounded-sm border border-line bg-surface">
                      <Image
                        src={look.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 176px, 40vw"
                        className="object-cover"
                      />
                    </span>
                    <span className="mt-2 block text-center text-sm text-ink underline-offset-4 group-hover:underline">
                      {look.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {active && (
              <Link
                href={`/collections/${active.handle}`}
                prefetch={false}
                onClick={() => setOpenHandle(null)}
                className="mt-8 inline-block border-t border-line pt-5 text-sm font-medium text-action-ink underline decoration-line-strong underline-offset-4 hover:decoration-current"
              >
                View all {active.title.toLowerCase()}
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
