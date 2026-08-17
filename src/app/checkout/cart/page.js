import CartPage from "./CartPage";

/**
 * /checkout/cart -- the page both header bag icons have ALWAYS linked to. Until now it did not
 * exist: a customer who added boxes and kept browsing hit a 404 at the exact moment they went to
 * pay. The page itself is a client component -- the cart lives behind an httpOnly cookie and a
 * per-customer API route, so there is nothing for the server to render but the shell.
 */
export const metadata = {
  title: "Your cart | Material",
  robots: { index: false },
};

export default function Page() {
  return <CartPage />;
}
