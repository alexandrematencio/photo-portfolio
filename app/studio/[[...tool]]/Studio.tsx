'use client';

import { NextStudio } from 'next-sanity/studio';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from '@/sanity/schemas';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';

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

  const config = defineConfig({
    name: 'amatencio-photo',
    title: 'A. Matencio — Studio',
    projectId,
    dataset,
    basePath: '/studio',
    plugins: [
      structureTool({
        structure: (S) =>
          S.list()
            .title('Contenu')
            .items([
              S.listItem()
                .title('Réglages du site')
                .id('siteSettings')
                .child(
                  S.document()
                    .schemaType('siteSettings')
                    .documentId('siteSettings')
                ),
              S.divider(),
              S.documentTypeListItem('photo').title('Photos'),
            ]),
      }),
      visionTool({ defaultApiVersion: apiVersion }),
    ],
    schema: { types: schemaTypes },
  });

  return <NextStudio config={config} />;
}
