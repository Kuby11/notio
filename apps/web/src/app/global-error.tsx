'use client';

/**
 * Last-resort boundary: it replaces the root layout, so neither the intl
 * provider nor the theme class is available here. Markup is inline and the
 * copy is intentionally literal — a translation lookup would depend on the
 * very providers that just failed.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#0a0a0a',
          color: '#fafafa',
          textAlign: 'center',
        }}
      >
        <main style={{ padding: 32, maxWidth: 420 }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
            The application could not start. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: '1px solid #404040',
              background: 'transparent',
              color: 'inherit',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
