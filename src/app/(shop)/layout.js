import { getMenu } from '@/lib/menus';
import Header from '@/components/header/Header';
import Footer from '@/components/common/Footer';
import AutoAuthPopup from '@/components/auth/AutoAuthPopup';
import WishlistNudge from '@/components/common/WishlistNudge';
import FloatingContact from '@/components/common/FloatingContact';

/**
 * The SHOP chrome -- header, footer, and the popup that asks people to sign up.
 *
 * This used to live in the root layout, which meant it also wrapped /checkout/cart: a customer who
 * had finished choosing was handed the full site nav, a mega-menu, a search box, five columns of
 * footer links and, fifteen seconds in, a signup dialog. Every one of those is an invitation to
 * leave the page they came to pay on.
 *
 * So the chrome moved down here, into a route group. `(shop)` is parenthesised, so it does NOT
 * appear in any URL -- /products/x is still /products/x -- it exists only to draw the line between
 * routes that get the nav and routes that do not. The jewelry build splits the same way: an
 * app/(frontend) group holds Header and Footer, and app/(checkout-flow) has its own stripped pair.
 *
 * WHAT STAYED IN THE ROOT: <html>, the fonts, ReduxProvider and GlobalAuthModal -- the modal
 * because checkout can still need a login, and the provider because the cart is Redux state and
 * would be unreachable without it.
 *
 * AutoAuthPopup came DOWN here rather than staying up there. A signup dialog that opens on a timer
 * is survivable while someone is browsing; opening it over a cart is asking for the tab to close.
 *
 * WishlistNudge sits here for the same reason. It only fires after a guest saves something, which
 * can only happen on a shop page anyway -- and the cart is the last place to start a conversation
 * about saving items for later.
 */
export default async function ShopLayout({ children }) {
  // Menu is read at build time from src/data/menu-data.json, so the header costs no request.
  const menuData = await getMenu();

  return (
    <>
      <Header menuData={menuData} />
      {children}
      <Footer />
      <AutoAuthPopup />
      <WishlistNudge />
      <FloatingContact />
    </>
  );
}
