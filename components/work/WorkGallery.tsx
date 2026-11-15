'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ListSelector } from '@/components/site/ListSelector';
import { SeriesPhotoGrid } from '@/components/series/page/SeriesPhotoGrid';
import { cn } from '@/lib/utils/cn';
import { CONTROL_RADIUS } from '@/lib/site/controls';
import type { PreparedSeries } from '@/lib/site/series';
import { EDITORIAL_LINK_DECORATION, MICRO_LABEL, PAGE_CONTROLS_GAP } from '@/lib/site/typography';

/**
 * /work : une collection par onglet (2026-11-15).
 *
 * Même grammaire que la console d'/archives, sans en recopier la mécanique :
 * sur desktop, une rangée d'onglets sur la plaque (padding sur TOUS, fond sur
 * le seul actif — la rangée ne bouge pas au clic) ; sous `md`, le module
 * `ListSelector`, jamais une rangée qui wrappe (skill design-system §7.7).
 *
 * La grille et sa lightbox sont celles de `/series/[slug]` : un seul onglet
 * monté à la fois, donc une seule lightbox, dont le carousel est l'onglet
 * visible (CLAUDE.md §3.4). `key` la remonte au changement d'onglet.
 */
export function WorkGallery({ collections }: { collections: PreparedSeries[] }) {
  const [activeId, setActiveId] = useState(collections[0]?._id ?? '');
  const active = collections.find((c) => c._id === activeId) ?? collections[0];
  if (!active) return null;

  // UNE racine : `PageShell` pose son `gap` entre chacun de ses enfants, un
  // fragment doublerait l'écart sous la bande (mesuré : 96 au lieu de 48).
  return (
    <div>
      <div className="md:hidden" style={{ paddingInline: 'var(--page-gutter)' }}>
        <ListSelector
          hint="SHOW"
          ariaLabel="Collection"
          tone="plate"
          mark="fill"
          items={collections.map((c) => ({ key: c._id, label: c.title, count: c.photos.length }))}
          value={active._id}
          onChange={setActiveId}
        />
      </div>

      <nav
        className="hidden md:flex bg-[var(--color-bg-plate)]"
        style={{ paddingInline: 'var(--page-gutter)' }}
      >
        <div
          role="tablist"
          aria-label="Collection"
          className="flex min-w-0 flex-wrap items-center gap-y-2"
          style={{ paddingTop: 20, paddingBottom: 20 }}
        >
          {collections.map((c) => {
            const on = c._id === active._id;
            return (
              <button
                key={c._id}
                role="tab"
                aria-selected={on}
                type="button"
                onClick={() => setActiveId(c._id)}
                // Inline : le reset `* { padding: 0 }` avale les utilities.
                style={{ padding: '6px 24px', borderRadius: CONTROL_RADIUS }}
                className={cn(
                  'text-[12px] uppercase font-bold cursor-pointer transition-colors motion-reduce:transition-none',
                  on
                    ? 'text-[var(--color-fg)] bg-[var(--color-active-bg)]'
                    : 'text-[var(--color-fg-muted-plate)] hover:text-[var(--color-fg)]'
                )}
              >
                {c.title}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bas de la bande de commandes : le contrat de `controlBand` a deux
          moitiés, PageShell pose celle du dessus. */}
      <section
        role="tabpanel"
        aria-label={active.title}
        style={{ paddingInline: 'var(--page-gutter)', paddingTop: PAGE_CONTROLS_GAP }}
      >
        <p
          className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
          style={{ marginBottom: 24 }}
        >
          {active.photos.length} photo{active.photos.length === 1 ? '' : 's'} ·{' '}
          <Link href={`/series/${active.slug}`} className={EDITORIAL_LINK_DECORATION}>
            About this collection
          </Link>
        </p>
        <SeriesPhotoGrid key={active._id} photos={active.photos} />
      </section>
    </div>
  );
}
