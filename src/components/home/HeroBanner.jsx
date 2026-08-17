"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import Link from "next/link";
import Image from "next/image";
import shopifyLoader from "@/utils/shopifyLoader";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export default function HeroBanner({ slides = [] }) {
  const id = useId().replace(/:/g, "");
  const paginationElClass = `pagination-${id}`;

  // Desktop 123/44 = 2.7955 (CaratLane, measured live). Mobile 1:1 square.
  const bannerHeightClasses = "w-full";

  if (!slides || slides.length === 0) return null;

  // Check if there is any video in the data
  const videoSlide = slides.find(slide => slide.type === 'video');

  // If a video is present, show ONLY the first video and remove Swiper
  if (videoSlide) {
    return (
      <div className="w-full bg-white">
        <div className={`relative w-full overflow-hidden ${bannerHeightClasses}`}>
          <Link 
            prefetch={false} 
            href={videoSlide.url || '/'} 
            className="block w-full"
           
          >
            <div className="relative w-full">
              {/* Desktop Video */}
              <video
                src={videoSlide.desktopImage}
                autoPlay
                loop
                muted
                playsInline
                className="hidden lg:block w-full h-auto object-cover object-center"
              />
              {/* Mobile Video */}
              <video
                src={videoSlide.mobileImage || videoSlide.desktopImage}
                autoPlay
                loop
                muted
                playsInline
                className="block lg:hidden w-full h-auto object-cover object-center"
              />

              {/* Text Overlay */}
              {(videoSlide.title || videoSlide.subtitle) && (
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 md:pb-12 bg-black/5">
                  <div className="text-center text-white px-4">
                    {videoSlide.title && (
                      <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-[1px] mb-4 drop-shadow-2xl">
                        {videoSlide.title}
                      </h2>
                    )}
                    {videoSlide.subtitle && (
                      <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] underline underline-offset-[12px] decoration-white/60 hover:decoration-white transition-all drop-shadow-xl cursor-pointer">
                        {videoSlide.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      <div
        className={`relative w-full overflow-hidden group ${bannerHeightClasses}`}
      >
        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          slidesPerView={1}
          loop={true}
          autoHeight={true}
          autoplay={{
            delay: 5000,
            disableOnInteraction: false,
          }}
          navigation={{
            nextEl: ".hero-next",
            prevEl: ".hero-prev",
          }}
          pagination={{
            el: `.${paginationElClass}`,
            clickable: true,
          }}
          className="w-full"
        >
          {slides.map((slide, index) => (
            <SwiperSlide key={slide.id || index}>
              <Link 
                prefetch={false} 
                href={slide.url || '/'} 
                className="block w-full"
               
              >
                <div className="relative w-full">
                  {/* Desktop Image */}
                  <div className="relative hidden aspect-hero w-full lg:block">
                    <Image
                      loader={shopifyLoader}
                      src={slide.desktopImage}
                      alt={slide.alt || slide.name || "Hero Banner"}
                      fill
                      priority={index === 0}
                      loading={index === 0 ? "eager" : "lazy"}
                      className="object-cover object-center"
                      sizes="100vw"
                      draggable={false}
                    />
                  </div>

                  {/* Mobile Image */}
                  <div className="relative block aspect-hero-mobile w-full lg:hidden">
                    <Image
                      loader={shopifyLoader}
                      src={slide.mobileImage || slide.desktopImage}
                      alt={slide.alt || slide.name || "Hero Banner Mobile"}
                      fill
                      priority={index === 0}
                      loading={index === 0 ? "eager" : "lazy"}
                      className="object-cover object-center"
                      sizes="100vw"
                      draggable={false}
                    />
                  </div>

                  {/* Text Overlay for Image Slides */}
                  {(slide.title || slide.subtitle) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 md:pb-24 bg-black/5 z-10">
                      <div className="text-center text-white px-4">
                        {slide.title && (
                          <h2 className="text-3xl md:text-5xl font-semibold uppercase tracking-[0.1em] mb-4 drop-shadow-2xl">
                            {slide.title}
                          </h2>
                        )}
                        {slide.subtitle && (
                          <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] underline underline-offset-[12px] decoration-white/60 hover:decoration-white transition-all drop-shadow-xl cursor-pointer">
                            {slide.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Navigation Buttons */}
        {/* Charcoal, like the card controls: these sit on a photograph, and a white plate over a
            pale banner is barely an edge. Controls on the page itself stay white. */}
        <button className="hero-prev absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex w-12 h-12 rounded-sm bg-surface/60 backdrop-blur-md items-center justify-center text-ink hover:bg-surface transition-colors duration-300">
          <ChevronLeft size={24} />
        </button>

        <button className="hero-next absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex w-12 h-12 rounded-sm bg-surface/60 backdrop-blur-md items-center justify-center text-ink hover:bg-surface transition-colors duration-300">
          <ChevronRight size={24} />
        </button>

        {/* Pagination */}
        <div className="absolute bottom-4 left-0 right-0 z-20 md:bottom-8 flex justify-center">
          <div
            className={`${paginationElClass} flex items-center justify-center gap-2`}
          />
        </div>
      </div>
    </div>
  );
}
