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
import { BANNER_SLIDES } from "@/data/banners";

export const revalidate = 86400;

export default function Home() {
  return (
    <main>
      <CategoryRail />
      <HeroBanner slides={BANNER_SLIDES} />
      <WhyMaterial />
      {/* One category for now. Laminates and wallpaper are one more line each once their
          collections exist -- TopSelling.jsx is the old mixed shelf this replaced, still on disk. */}
      <CategoryProducts handle="tiles" />
      <ShopByCategory />
      <ShopByRoom />
      {/* The banner splits the two product shelves, so it never sits flush against the dark footer
          -- two charcoal blocks running together stop reading as a break at all. */}
      <HelpMeChoose />
      {/* PLACEHOLDER SOURCE: there is no new-arrivals collection yet, so this is the tiles
          collection under a different heading. Point it at the real handle once it exists. */}
      <CategoryProducts handle="tiles" title="New arrivals" />
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
