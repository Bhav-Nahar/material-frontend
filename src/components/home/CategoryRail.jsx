import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@/data/catalog";

/**
 * Mobile content rail above the hero — the jewelry build's MobileCategorySlider, in Material's
 * system:
 * square 1:1 swatches at 2px radius (§06/§11) instead of the jewelry build's circles, and the
 * scrollbar hidden via our no-scrollbar utility rather than the jewelry build's commented-out style
 * block.
 *
 * ponytail: plain CSS overflow scroll, no carousel library. Add snap/arrows only if asked.
 */
export default function CategoryRail() {
  if (CATEGORIES.length === 0) return null;

  return (
    <nav aria-label="Shop by category" className="block border-b border-line py-3 lg:hidden">
      {/* container-main, not a flat px-4: every other section uses the brand's fluid gutter
          (clamp(1rem, 3vw, 2.5rem)), so a fixed 16px here left the rail 7px outboard of the
          header and the sections below it at tablet widths. The negative inset lets the row
          scroll edge to edge while the first swatch still lines up with the gutter. */}
      <ul className="container-main flex gap-3 overflow-x-auto no-scrollbar touch-pan-x">
        {CATEGORIES.map((category) => (
          <li key={category.handle} className="w-[84px] shrink-0">
            <Link
              href={`/collections/${category.handle}`}
              prefetch={false}
              className="flex flex-col gap-2 active:opacity-70"
            >
              <span className="relative block aspect-swatch overflow-hidden rounded-sm bg-surface">
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="84px"
                  className="object-cover"
                />
              </span>
              <span className="text-center text-xs leading-tight text-ink">
                {category.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
