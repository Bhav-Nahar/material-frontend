import localFont from 'next/font/local';

import ReduxProvider from '@/redux/provider';
import GlobalAuthModal from '@/components/auth/GlobalAuthModal';
import CaptureAttribution from '@/components/common/CaptureAttribution';

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
export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <ReduxProvider>
          {/* In the ROOT layout, not the shop one: a campaign can land on a checkout URL too, and a
              UTM that is not read on the page it arrives on is gone. */}
          <CaptureAttribution />
          {children}
          {/* Both headers call openLogin() from useAuth; this is what it opens. */}
          <GlobalAuthModal />
        </ReduxProvider>
      </body>
    </html>
  );
}
