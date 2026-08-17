import menuData from "@/data/menu-data.json";

// Small collection tiles rendered beside the image cards in the desktop
// Collections menu and below the 2x2 grid in the mobile menu. Cotton Candy is
// desktop-only: on mobile it stays as a card in the image grid.
/**
 * Small collection tiles beside the image cards in the desktop menu. The jewelry build lists its
 * jewelry collections with its own CDN assets; Material has none yet, so this is empty and the menu
 * simply omits the rail.
 */
export const COLLECTION_QUICK_LINKS = [];

export async function getMenu(handle = "main-menu-official") {
  try {
    if (menuData.success && menuData.menus) {
        const found = menuData.menus.find(m => m.handle === handle);
        if (found) return found.items;
    }
    return [];
  } catch (error) {
    console.error("getMenu Error:", error);
    return [];
  }
}

export function transformMenuData(shopifyMenuItems) {
  if (!shopifyMenuItems) return [];

  return shopifyMenuItems.map(item => {
    const resource = item.resource || {};
    const metafields = resource.metafields?.nodes || [];
    
    const disabledLabels = [];
    const isFeaturedDisabled = disabledLabels.includes(item.title.toLowerCase().trim());

    const menuType = getMetafield(metafields, "custom", "menu_type")?.value || (item.items?.length > 0 ? "mega" : "link");
    const layout = getMetafield(metafields, "custom", "layout")?.value || "5-col-featured";
    
    const menuIcon = getFileUrl(getMetafield(metafields, "custom", "menu_links_image_icon")) || resource.image?.url;

    let href = item.url.replace(/https:\/\/[^/]+/, "");
    const label = item.title.trim();
    if (label === "Collections") {
      // Hover-only menu: keep the dropdown, but make the top-level item non-clickable
      href = "#";
    }
    
    let transformedItem = {
      label: item.title,
      href: href,
      type: menuType,
      layout: layout,
      mobileBanner: getFileUrl(getMetafield(metafields, "custom", "mobile_menu_banner_image")),
      menuIcon: menuIcon,
    };

    if (menuType === "mega") {
        const children = item.items || [];
        
        if (!isFeaturedDisabled) {
            const featuredGroup = children.find(c => {
                const title = c.title.toLowerCase();
                return title.includes("featured") && !title.includes("in");
            });
            const featuredInGroup = children.find(c => c.title.toLowerCase().includes("featured in"));

            if (featuredGroup || featuredInGroup) {
                transformedItem.featured = {};
                if (featuredGroup) {
                    transformedItem.featured.title = featuredGroup.title;
                    transformedItem.featured.items = (featuredGroup.items || []).map(f => ({
                        label: f.title,
                        href: f.url.replace(/https:\/\/[^/]+/, ""),
                        icon: getFileUrl(getMetafield(f.resource?.metafields?.nodes || [], "custom", "icon")),
                        megaMenuImage: getFileUrl(getMetafield(f.resource?.metafields?.nodes || [], "custom", "mega_menu_image")),
                        menuIcon: getFileUrl(getMetafield(f.resource?.metafields?.nodes || [], "custom", "menu_links_image_icon")) || f.resource?.image?.url,
                    }));
                }
                if (featuredInGroup) {
                  transformedItem.featured.featuredIn = {
                      title: featuredInGroup.title,
                      items: (featuredInGroup.items || []).map(f => ({
                          label: f.title,
                          href: f.url.replace(/https:\/\/[^/]+/, ""),
                          icon: getFileUrl(getMetafield(f.resource?.metafields?.nodes || [], "custom", "icon")),
                          megaMenuImage: getFileUrl(getMetafield(f.resource?.metafields?.nodes || [], "custom", "mega_menu_image")),
                          menuIcon: getFileUrl(getMetafield(f.resource?.metafields?.nodes || [], "custom", "menu_links_image_icon")) || f.resource?.image?.url,
                      }))
                  };
                }
            }
        }

        const remainingItems = children.filter(c => {
            const title = c.title.toLowerCase();
            return !(title.includes("featured") && !title.includes("in")) && !title.includes("featured in");
        });
        
        const columns = [];
        const cards = [];

        remainingItems.forEach(child => {
            const childMetafields = child.resource?.metafields?.nodes || [];
            const menuImage = getFileUrl(getMetafield(childMetafields, "custom", "menu_image"));

            if (menuImage) {
                cards.push({
                    title: child.title,
                    image: menuImage,
                    subtitle: getMetafield(childMetafields, "custom", "menu_subtitle")?.value || `${child.resource?.productsCount?.count || 0} Products`,
                    href: child.url.replace(/https:\/\/[^/]+/, "")
                });
            } else {
                const processedItems = (child.items || []).map(sub => ({
                    label: sub.title,
                    href: sub.url.replace(/https:\/\/[^/]+/, ""),
                    icon: getFileUrl(getMetafield(sub.resource?.metafields?.nodes || [], "custom", "icon")),
                    megaMenuImage: getFileUrl(getMetafield(sub.resource?.metafields?.nodes || [], "custom", "mega_menu_image")),
                    menuIcon: getFileUrl(getMetafield(sub.resource?.metafields?.nodes || [], "custom", "menu_links_image_icon")) || sub.resource?.image?.url,
                }));

                // A column renders as icons only if its items actually HAVE icons. The jewelry
                // build decided this from the column title instead ("price"/"occasion"/"shop for" =
                // text, the rest = icons, "metal"/"material" = gold swatches), so Material's
                // icon-less "Shop by room" / "Shop by size" columns came back as `icon` and the
                // mobile menu rendered a grid of empty 80px boxes. A `column_type` metafield still
                // wins.
                const explicitType = getMetafield(childMetafields, "custom", "column_type")?.value;
                const hasIcons = processedItems.some(item => item.icon || item.megaMenuImage || item.menuIcon);
                const finalType = explicitType || (hasIcons ? "icon" : "text");

                columns.push({ title: child.title, type: finalType, items: processedItems });
            }
        });

        transformedItem.columns = columns;
        transformedItem.cards = cards;

        const parentBannerMeta = getMetafield(metafields, "custom", "menu_image") || getMetafield(metafields, "custom", "banner_image");
        const parentBannerImage = getFileUrl(parentBannerMeta) || resource.image?.url;
        if (parentBannerImage && cards.length === 0) {
            transformedItem.banner = {
                image: parentBannerImage,
                title: getMetafield(metafields, "custom", "banner_title")?.value || item.title,
                subtitle: getMetafield(metafields, "custom", "menu_subtitle")?.value || `${resource.productsCount?.count || 0} Products`,
                href: transformedItem.href
            };
        }
    } else if (menuType === "image-grid") {
        transformedItem.items = (item.items || []).map(sub => ({
            title: sub.title,
            description: getMetafield(sub.resource?.metafields?.nodes || [], "custom", "menu_subtitle")?.value || `${sub.resource?.productsCount?.count || 0} Products`,
            image: getFileUrl(getMetafield(sub.resource?.metafields?.nodes || [], "custom", "menu_image") || getMetafield(sub.resource?.metafields?.nodes || [], "custom", "image")) || sub.resource?.image?.url,
            href: sub.url.replace(/https:\/\/[^/]+/, "")
        }));
    }

    // The Collections menu renders as an image grid (whether it arrives as
    // "image-grid" or as a "mega" whose children all have menu_image cards),
    // so the quick-link tiles are attached independent of menu type.
    if ((item.title || "").toLowerCase().trim() === "collections") {
        transformedItem.quickLinks = COLLECTION_QUICK_LINKS;
    }

    return transformedItem;
  });
}

function getMetafield(metafields, namespace, key) {
  return (metafields || []).find(m => m.namespace === namespace && m.key === key);
}

function getFileUrl(metafield) {
    if (!metafield) return null;
    if (metafield.reference?.image?.url) return metafield.reference.image.url;
    if (metafield.reference?.url) return metafield.reference.url;
    if (typeof metafield.value === 'string' && (metafield.value.startsWith('http') || metafield.value.startsWith('/'))) return metafield.value;
    return null;
}
