'use client';

import { NextStudio } from 'next-sanity/studio';
import { studioConfig } from '@/sanity/studio.config';
import { projectId } from '@/lib/sanity/env';

export function Studio() {
  if (!projectId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-20 bg-[var(--color-bg)] text-[var(--color-fg)]">
        <div className="max-w-xl space-y-5">
          <h1 className="font-black uppercase text-3xl tracking-tight">
            Studio non configuré
          </h1>
          <p className="text-[var(--color-fg-muted)]">
            Ajoute <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> dans <code>.env.local</code> puis redémarre <code>npm run dev</code>.
          </p>
        </div>
      </main>
    );
  }

  return <NextStudio config={studioConfig} />;
}
