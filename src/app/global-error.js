'use client';

import { useEffect } from 'react';

/**
 * The white screen this file exists to prevent.
 *
 * app/error.js cannot catch anything thrown by app/layout.js -- it renders INSIDE that layout. So a
 * failure in the root layout itself (redux-persist rehydrating a store shape that no longer exists,
 * a font import, CaptureAttribution reading a malformed URL) escapes every boundary and Next serves
 * a blank document. This one replaces the whole document, which is why it ships its own <html> and
 * <body>.
 *
 * It also renders with NO globals.css -- the stylesheet is imported by the layout that just failed.
 * Hence the inline styles and the literal hex values: this is the one file in the codebase that
 * cannot reach the tokens in globals.css, so copying them here is not a duplication to clean up.
 *
 * In development Next shows its own error overlay instead of this, which is correct -- but it means
 * the only way to see this file render is a production build.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1rem',
          textAlign: 'center',
          background: '#faf8f5',
          color: '#1c1b19',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, color: '#6e6a64', maxWidth: '28rem' }}>
          Texture House didn&apos;t load. Please reload the page.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 0,
            borderRadius: '4px',
            padding: '0.6rem 1.2rem',
            background: '#e4551a',
            color: '#101010',
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
