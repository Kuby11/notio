import type { ReactNode } from 'react';

/** Shared wrapper for the auth pages: a narrow column centred on the screen. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-semibold">notio</h1>
        {children}
      </div>
    </main>
  );
}
