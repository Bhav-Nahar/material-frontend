/**
 * Homepage banner slides.
 *
 * Crops are enforced by the container, not by the asset:
 *   desktop  aspect-hero         123/44 = 2.7955  (CaratLane's, measured live at 1524x545)
 *   mobile   aspect-hero-mobile  4/5 portrait
 *
 * The desktop asset below is currently 1536x1024 (3:2), so object-cover keeps only ~54% of its
 * height. Re-export at ~1230x440 with the composition built for that shape. The mobile asset is
 * already 1122x1402, which matches 4:5 exactly.
 */
export const BANNER_SLIDES = [
  {
    id: "terra-collection",
    desktopImage: "https://cdn.shopify.com/s/files/1/0778/7636/3401/files/homepage-1.png?v=1786038909",
    mobileImage: "https://cdn.shopify.com/s/files/1/0778/7636/3401/files/homepagemobile.png?v=1786038953",
    // §10: describe the scene and where the material is, not "Banner 1".
    alt: "Living room with large-format porcelain floor tiles, a fluted wood panel wall and patterned wallpaper",
    url: "/collections/tiles",
    name: "Terra collection",
  },
];
