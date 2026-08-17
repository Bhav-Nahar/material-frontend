"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation } from "swiper/modules";
import Link from "next/link";
import "swiper/css";
import "swiper/css/navigation";
import { ANNOUNCEMENTS, ANNOUNCEMENTS_VISIBLE } from "@/data/announcements";

export default function TopBar() {
  const announcements = ANNOUNCEMENTS;

  if (!ANNOUNCEMENTS_VISIBLE || announcements.length === 0) return null;

  return (
    <div className="bg-[var(--charcoal)] text-white group relative h-10 overflow-hidden">
      <button className="topbar-prev absolute left-2 z-20 transition-opacity cursor-pointer top-1/2 -translate-y-1/2 flex items-center justify-center">
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>

      <Swiper
        modules={[Autoplay, Navigation]}
        direction="vertical"
        autoplay={{
          delay: 10000,
          disableOnInteraction: false,
        }}
        navigation={{
          prevEl: ".topbar-prev",
          nextEl: ".topbar-next",
        }}
        loop={true}
        className="w-full h-full"
      >
        {announcements.map((item, index) => (
          <SwiperSlide key={index} className="!flex items-center justify-center h-full">
            {item.url ? (
              <Link prefetch={false} 
                href={item.url}
               
                className="text-center font-medium text-sm leading-none tracking-[0.7px] flex items-center justify-center h-full w-full px-6 hover:underline transition-all"
              >
                {item.text}
              </Link>
            ) : (
              <p 
               
                className="text-center font-medium text-sm leading-none tracking-[0.7px] flex items-center justify-center h-full w-full px-12"
              >
                {item.text}
              </p>
            )}
          </SwiperSlide>
        ))}
      </Swiper>

      <button className="topbar-next absolute right-2 z-20 transition-opacity cursor-pointer top-1/2 -translate-y-1/2 flex items-center justify-center">
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
