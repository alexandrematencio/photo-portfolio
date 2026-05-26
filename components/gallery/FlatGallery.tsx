'use client';

import { useMemo, useState } from 'react';
import { PhotoCard } from './PhotoCard';
import { cn } from '@/lib/utils/cn';
import type { Photo, PhotoCategory } from '@/lib/sanity/queries';

type Mode = 'year' | 'location' | 'type';

const TABS: { id: Mode; label: string }[] = [
  { id: 'year', label: 'Year' },
  { id: 'location', label: 'Location' },
  { id: 'type', label: 'Type' },
];

const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  landscape: 'Landscape',
  architecture: 'Architecture',
  portrait: 'Portrait',
  streetphotography: 'Street',
};

const CATEGORY_ORDER: PhotoCategory[] = [
  'landscape',
  'architecture',
  'portrait',
  'streetphotography',
];

export function FlatGallery({ photos }: { photos: Photo[] }) {
  const [mode, setMode] = useState<Mode>('year');

  const groups = useMemo(() => {
    if (mode === 'year') {
      const map = new Map<number, Photo[]>();
      for (const p of photos) {
        const k = p.year ?? 0;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(p);
      }
      return Array.from(map.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([k, items]) => ({ key: String(k), label: String(k), items }));
    }
    if (mode === 'location') {
      const map = new Map<string, Photo[]>();
      for (const p of photos) {
        const k = p.location ?? '—';
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(p);
      }
      return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'en'))
        .map(([k, items]) => ({ key: k, label: k, items }));
    }
    // type
    const map = new Map<PhotoCategory, Photo[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const p of photos) {
      if (p.category && map.has(p.category)) map.get(p.category)!.push(p);
    }
    return CATEGORY_ORDER.filter((cat) => (map.get(cat) ?? []).length > 0).map(
      (cat) => ({
        key: cat,
        label: CATEGORY_LABEL[cat],
        items: map.get(cat) ?? [],
      })
    );
  }, [mode, photos]);

  if (photos.length === 0) {
    return (
      <div className="py-32 text-center text-[var(--color-fg-muted)] text-sm">
        No photos yet. Add some from{' '}
        <a href="/studio" className="underline">
          /studio
        </a>
        .
      </div>
    );
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Grouping mode"
        className="sticky top-0 z-30 flex gap-0 border-b border-[var(--color-line)] bg-[var(--color-bg)]"
      >
        {TABS.map((tab) => {
          const active = tab.id === mode;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setMode(tab.id)}
              className={cn(
                'flex-1 md:flex-none md:px-10 py-4 text-[11px] uppercase tracking-[0.25em] transition-colors',
                active
                  ? 'text-[var(--color-fg)] border-b border-[var(--color-fg)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {groups.map((group) => (
        <section key={group.key} className="px-4 md:px-8 py-12">
          <h2 className="text-xs uppercase tracking-[0.3em] text-[var(--color-fg-muted)] mb-6">
            {group.label}
            <span className="ml-3 text-[var(--color-fg-muted)]/60 normal-case tracking-normal">
              ({group.items.length})
            </span>
          </h2>
          {/*
            Masonry CSS columns. La classe `flat-gallery-masonry` (globals.css)
            applique le même `--gallery-gap` au column-gap ET au margin-bottom
            des enfants → gap horizontal = gap vertical, garanti.
          */}
          <div className="flat-gallery-masonry columns-2 md:columns-3 lg:columns-4 [column-fill:_balance]">
            {group.items.map((p) => (
              <PhotoCard key={p._id} photo={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
