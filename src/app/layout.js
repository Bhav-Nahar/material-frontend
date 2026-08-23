import localFont from 'next/font/local';
import Script from 'next/script';

import ReduxProvider from '@/redux/provider';
import GlobalAuthModal from '@/components/auth/GlobalAuthModal';
import { Toaster } from 'sonner';
import CaptureAttribution from '@/components/common/CaptureAttribution';
import ScrollToTop from '@/components/ScrollToTop';

import './globals.css';

/**
 * §05 ships five faces and forbids a font CDN, so these are self-hosted (87KB total, latin
 * subset). `npm run fonts` refetches them.
 */
const display = localFont({
  src: [
    { path: '../../public/fonts/bai-jamjuree-600.woff2', weight: '600' },
    { path: '../../public/fonts/bai-jamjuree-700.woff2', weight: '700' },
  ],
  variable: '--font-display-face',
  display: 'swap',
});

const body = localFont({
  src: [
    { path: '../../public/fonts/ibm-plex-sans-400.woff2', weight: '400' },
    { path: '../../public/fonts/ibm-plex-sans-500.woff2', weight: '500' },
    { path: '../../public/fonts/ibm-plex-sans-600.woff2', weight: '600' },
  ],
  variable: '--font-body-face',
  display: 'swap',
});

const mono = localFont({
  src: [{ path: '../../public/fonts/ibm-plex-mono-400.woff2', weight: '400' }],
  variable: '--font-mono-face',
  display: 'swap',
});

export const metadata = {
  /* The PDP and PLP already emit `alternates: { canonical: "/products/x" }`. A relative canonical
     is resolved against THIS, and without it Next falls back to localhost:3000 -- so every page in
     production was declaring its canonical URL to be a machine nobody can reach. */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Material — tiles, laminates and wallpaper in Mumbai',
  description:
    'Curated tiles, laminates and wallpaper we hold in stock, delivered across Mumbai. ' +
    'Priced per square foot, sold by the box.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // §10 — usable at 200%, so zoom is never capped.
  maximumScale: 5,
};

/**
 * The document, and nothing that can be navigated away with.
 *
 * Header, Footer and AutoAuthPopup used to render here, which put the full site nav and a timed
 * signup dialog on top of /checkout/cart. They now live in app/(shop)/layout.js, and the checkout
 * routes -- which are NOT in that group -- get their own stripped header instead. See the note
 * there for the split.
 *
 * GlobalAuthModal stays: checkout can still need a login, and it renders nothing until something
 * calls openLogin(). ReduxProvider stays for the obvious reason -- the cart is Redux state.
 */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {/* The container itself. Every event in lib/gtm.js pushes into window.dataLayer, which
            queues fine without this -- but nothing READS the queue until the container loads, so
            without this block the entire analytics layer is dark. afterInteractive keeps it off
            the critical path. */}
        {GTM_ID && (
          <>
            <Script id="gtm" strategy="afterInteractive">
              {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
            </Script>
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                height="0"
                width="0"
                style={{ display: 'none', visibility: 'hidden' }}
                title="gtm"
              />
            </noscript>
          </>
        )}
        <ReduxProvider>
          {/* In the ROOT layout, not the shop one: a campaign can land on a checkout URL too, and a
              UTM that is not read on the page it arrives on is gone. */}
          <CaptureAttribution />
          {/* Root, not shop: the checkout steps are navigations too, and step two should not open
              halfway down the page because step one was scrolled. */}
          <ScrollToTop />
          {children}
          {/* Both headers call openLogin() from useAuth; this is what it opens. */}
          <GlobalAuthModal />

          {/* Cart and wishlist confirmations, fired from redux/toastListener.js rather than from
              any button; that file says why, and why each one is a single line of text.

              CARATLANE'S BAND (user, 2026-08-22). A pale green fill with the green tick, small caps,
              square corners -- read in the half-second before the eye goes back to the grid, which
              is all a confirmation gets. What this replaced had a product thumbnail, a status badge
              and an Undo button, and every one of those was something to look past.

              BOTTOM-CENTRE at every width. Top right is where the wishlist count lives, so it looked
              like the right place -- but it lands on the announcement bar and the search field.
              Bottom centre collides with nothing: FloatingContact's FAB is bottom-RIGHT, and on a
              phone it is where the thumb already is.

              The bangs are not optional: sonner sets background, border and radius through CSS
              variables on the toast element, so an unprefixed class loses. `richColors` would do the
              colour for us and does it in ITS palette -- a saturated emerald that appears nowhere
              else here. `description`/`closeButton` are unused: one line needs neither. */}
          <Toaster
            position="bottom-center"
            offset={16}
            duration={2600}
            gap={8}
            visibleToasts={2}
            toastOptions={{
              className:
                '!rounded-none !border !text-[13px] !font-medium !tracking-wide !uppercase !shadow-none',
              // THREE TONES, one per kind of event (user, 2026-08-22 -- one green for everything
              // made "added to cart" and "added to wishlist" indistinguishable at a glance, which
              // is the only glance a 2.6s toast gets):
              //
              //   info     ORANGE, the cart. The cart is the site's primary action and the site's
              //            primary action is orange in every other place it appears.
              //   success  GREEN, the wishlist. Saved, not bought -- a different kind of good.
              //   default  GREY, both removals. Nothing went wrong, something is simply gone. Not
              //            red: red is for "we could not do that", and spending it on a deliberate
              //            removal leaves nothing louder for an actual failure.
              //
              // The `-wash` fills are opaque tints of the same two accents (globals.css). They have
              // to be opaque: at `/10` the band let the product photograph through and the colour
              // went muddy over anything dark.
              classNames: {
                info: '!border-action/20 !bg-action-wash !text-action-ink',
                success: '!border-good/20 !bg-good-wash !text-good',
                default: '!border-line !bg-paper !text-subtle',
                // RED, and the only red on the site: a save that did not reach the account is the
                // one message here the customer has to act on. Held longer than the others by
                // sonner's own default for errors.
                error: '!border-bad/25 !bg-bad/8 !text-bad',
              },
            }}
          />
        </ReduxProvider>
      </body>
    </html>
  );
}
