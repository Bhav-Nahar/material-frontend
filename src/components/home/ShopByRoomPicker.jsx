"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bath, Bed, CookingPot, Fence, Sofa, ToyBrick, Trees } from "lucide-react";

/**
 * Depot's room icons, keyed by the menu's own ?room= slug. lucide-react is already a dependency
 * (the sheet's close button), so seven icons cost a tree-shaken import and no artwork.
 *
 * A slug with no icon renders as a plain chip rather than a placeholder -- if the merchandiser adds
 * "Study" to the menu tomorrow, it shows up unlabelled-by-icon instead of wearing a wrong one.
 */
const ROOM_ICONS = {
  bathroom: Bath,
  kitchen: CookingPot,
  living: Sofa,
  bedroom: Bed,
  kids: ToyBrick,
  balcony: Fence,
  outdoor: Trees,
};

/**
 * Room selector over a row of picks. Material Depot's "Start With a room" arrangement -- choose a
 * room, the row beneath swaps -- with the selector as TEXT, not photography.
 *
 * Photo swatches were the first version and they were the problem. The home page already stacks
 * three photo-and-caption grids (category tiles, the look grid inside the sheet, these picks); a
 * fourth one acting as a CONTROL sat in the middle of them competing with the results it was meant
 * to filter, at nearly the same width, dimmed to 55% to say "not selected" -- which reads as
 * disabled rather than unselected. And there is no room photography: ROOM_IMAGES was empty, so
 * every swatch showed a rotated category photo, a tile picture standing in for "Bathroom".
 *
 * Chips fix all of it at once. The control looks like a control, the picks are the only imagery in
 * the section so they own the eye, and four rooms fit across a phone where two and a half did.
 *
 * Depot's icons come along, INSIDE the chip rather than above the label in a circle: same glanceable
 * "that one is my bathroom", without the row of 7 boxes going back to competing with the 5 below it.
 * §06 rules out the circle anyway.
 *
 * ponytail: useState and a find. Every room's picks are already in the payload -- seven rooms, ~30
 * links -- so switching is instant and costs no request. Depot fetches per room.
 */
export default function ShopByRoomPicker({ rooms }) {
  const [activeSlug, setActiveSlug] = useState(rooms[0].slug);
  const active = rooms.find((r) => r.slug === activeSlug) ?? rooms[0];

  return (
    <div>
      {/* Scrolls on a phone, one row from lg. snap-x so a swipe lands on a chip rather than
          mid-word; a half-cut WORD is its own "there is more" signal, which a half-cut photo
          tile never was. */}
      <ul className="flex snap-x gap-2 overflow-x-auto no-scrollbar touch-pan-x lg:flex-wrap lg:overflow-visible">
        {rooms.map((room) => {
          const isActive = room.slug === active.slug;
          const Icon = ROOM_ICONS[room.slug];
          return (
            <li key={room.slug} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setActiveSlug(room.slug)}
                aria-pressed={isActive}
                className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3.5 py-2 text-sm whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-ink bg-ink font-medium text-paper"
                    : "border-line text-ink hover:border-ink"
                }`}
              >
                {/* Decorative: the label beside it already says the room. */}
                {Icon && <Icon size={16} strokeWidth={1.5} aria-hidden />}
                {room.label}
              </button>
            </li>
          );
        })}
      </ul>

      {/* No divider above this. It used to carry border-t + pt-10, which read as the START OF A NEW
          SECTION -- the exact opposite of what a picker wants, where the panel has to look like it
          belongs to the chip that opened it. */}
      <div role="region" aria-labelledby="shop-by-room-active" className="mt-7 lg:mt-9">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h3 id="shop-by-room-active" className="text-sm font-medium text-ink lg:text-base">
            For your {active.label.toLowerCase()}
          </h3>
          <Link
            href={`/collections/all?room=${active.slug}`}
            prefetch={false}
            className="shrink-0 text-xs font-medium text-action-ink underline decoration-line-strong underline-offset-4 hover:decoration-current lg:text-sm"
          >
            See everything
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5">
          {active.picks.map((pick) => (
            <li key={pick.href}>
              <Link href={pick.href} prefetch={false} className="group block">
                {/* 4:3, where the category sheet's look swatches are 1:1. Same photos in a
                    different crop stops the two grids rhyming. */}
                <span className="relative block aspect-[4/3] overflow-hidden rounded-sm border border-line bg-surface">
                  <Image
                    src={pick.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 260px, 45vw"
                    className="object-cover"
                  />
                </span>
                {pick.material && (
                  <span className="mt-2.5 block text-[11px] tracking-wide text-subtle uppercase">
                    {pick.material}
                  </span>
                )}
                <span className="mt-0.5 block text-sm text-ink underline-offset-4 group-hover:underline">
                  {pick.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
