"use client";

import { useId } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Navigation, Pagination } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

/**
 * Horizontal product rail, same behaviour as the jewelry build's CollectionSlider: free-scroll with
 * sticky snapping, 2 cards on a phone up to 4 on a wide screen, a progress track and round arrows
 * below.
 *
 * Two deliberate differences from the jewelry build's:
 *   - No autoplay. §09 forbids carousel rotation; a rail the customer drives is not rotation.
 *     The jewelry build advances every 6s, which moves the card out from under the thumb mid-reach.
 *   - Track and arrows use brand tokens, so no `<style jsx global>` block with !important
 *     overrides -- the jewelry build needs one because it is fighting Swiper's own colours.
 *
 * Swiper is already in the bundle (hero banner, announcement bar), so this adds no new dependency.
 */
/** `list` is analytics only -- it names which rail this is, so "related" and "recently viewed"
 *  impressions do not merge into one number. See ProductCard. */
export default function ProductRail({ products = [], priorityCount = 2, list = "rail" }) {
  const id = useId().replace(/:/g, "");
  const prevClass = `rail-prev-${id}`;
  const nextClass = `rail-next-${id}`;
  const trackClass = `rail-track-${id}`;

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <Swiper
        modules={[FreeMode, Navigation, Pagination]}
        spaceBetween={12}
        slidesPerView={2.15}
        grabCursor
        speed={450}
        freeMode={{ enabled: true, sticky: true }}
        navigation={{ prevEl: `.${prevClass}`, nextEl: `.${nextClass}` }}
        pagination={{ el: `.${trackClass}`, type: "progressbar" }}
        breakpoints={{
          768: { slidesPerView: 3, spaceBetween: 16 },
          1280: { slidesPerView: 4, spaceBetween: 24, freeMode: false },
        }}
        // rail-presize: pre-init slide widths, see globals.css. Without it the cards paint at full
        // container width for a frame before Swiper sizes them.
        className="rail-presize w-full"
      >
        {products.map((product, i) => (
          <SwiperSlide key={product.handle}>
            <ProductCard product={product} priority={i < priorityCount} list={list} index={i} />
          </SwiperSlide>
        ))}
      </Swiper>

      <div className="mt-7 flex items-center justify-between gap-6">
        {/* Progress track. swiper/css/pagination makes a progressbar `position: absolute`, which
            would lift it out of this flex row and paste it across the top of the rail -- hence the
            important modifiers. Its fill colour comes from --swiper-theme-color in globals.css. */}
        <div className={`${trackClass} relative! h-px! w-full! max-w-30 grow bg-line! lg:max-w-50`} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous products"
            className={`${prevClass} flex h-10 w-10 items-center justify-center rounded-sm border border-line-strong bg-surface text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-30`}
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Next products"
            className={`${nextClass} flex h-10 w-10 items-center justify-center rounded-sm border border-line-strong bg-surface text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-30`}
          >
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
