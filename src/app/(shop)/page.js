import CategoryProducts from "@/components/home/CategoryProducts";
import CategoryRail from "@/components/home/CategoryRail";
import Guides from "@/components/home/Guides";
import HelpMeChoose from "@/components/home/HelpMeChoose";
import HeroBanner from "@/components/home/HeroBanner";
import HomeFaqs from "@/components/home/HomeFaqs";
import Newsletter from "@/components/home/Newsletter";
import ShopByCategory from "@/components/home/ShopByCategory";
import ShopByRoom from "@/components/home/ShopByRoom";
import TrendingCollections from "@/components/home/TrendingCollections";
import WhyMaterial from "@/components/home/WhyMaterial";
import RecentlyViewed from "@/components/product/RecentlyViewed";
import { BANNER_SLIDES } from "@/data/banners";

export const revalidate = 86400;

export default function Home() {
  return (
    <main>
      {/* The page's one h1, for the heading tree and the index — every section below starts at h2,
          and the hero is a photograph. sr-only: the banner IS the visual headline. */}
      <h1 className="sr-only">Texture House — tiles, laminates and wallpaper in Mumbai</h1>
      <CategoryRail />
      <HeroBanner slides={BANNER_SLIDES} />
      <WhyMaterial />
      {/* A returning visitor's own trail, near the top -- they came back for something they were
          weighing up. Renders nothing for a first visit (no trail) and nothing on the server, so
          it costs a new visitor no space and no layout shift above the fold. */}
      <RecentlyViewed title="Pick up where you left off" className="mt-8 lg:mt-12" />
      {/* One category for now. Laminates and wallpaper are one more line each once their
          collections exist. */}
      <CategoryProducts handle="tiles" />
      <ShopByCategory />
      <ShopByRoom />
      {/* The banner splits the two product shelves, so it never sits flush against the dark footer
          -- two charcoal blocks running together stop reading as a break at all. */}
      <HelpMeChoose />
      {/* "New arrivals" is gone until a real new-arrivals collection exists: it rendered the SAME
          24 tiles as the shelf above under a contradictory heading, which teaches shoppers the
          labels lie. One line to bring back: <CategoryProducts handle="new-arrivals" title="New arrivals" /> */}
      {/* Last, and the only centred section: the page alternates product shelf / browse block, and
          this is the browse block that ends it. */}
      <TrendingCollections />
      {/* Reading, not shopping -- so it sits after the last shelf and before the FAQs, which are
          the other block here that answers a question instead of selling. Absent until the first
          guide is published in Shopify. */}
      <Guides />
      <HomeFaqs />
      {/* Last thing before the footer: the page has run out of shelves, and this is the one ask
          left for someone who is not buying today. */}
      <Newsletter />
    </main>
  );
}
