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
      {/* Filter tabs — aerated, full-bleed sticky bar.
          Typography matches brand book §5.3 (sub-label spec: 11px / 700 / uppercase / tracking 0.25em).
          Active state: solid fg color + offset-8 underline (no border-b that fights with bottom border). */}
      <nav
        role="tablist"
        aria-label="Grouping mode"
        className="sticky top-0 z-30 flex justify-start gap-10 md:gap-14 border-b border-[var(--color-line)] bg-[var(--color-bg)]"
        style={{ paddingLeft: 32, paddingRight: 32, paddingTop: 24, paddingBottom: 24 }}
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
                'text-[12px] uppercase tracking-[0.25em] font-bold py-2 transition-colors motion-reduce:transition-none',
                active
                  ? 'text-[var(--color-fg)] underline underline-offset-8 decoration-2'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Groups — 64 px gap between each (per spec), 40 px from the tabs bar above */}
      <div
        className="flex flex-col gap-16"
        style={{ paddingLeft: 32, paddingRight: 32, paddingTop: 40 }}
      >
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="text-[11px] uppercase tracking-[0.25em] font-bold text-[var(--color-fg-muted)] mb-6">
              {group.label}
              <span className="ml-3 text-[var(--color-fg-muted)]/60">
                ({group.items.length})
              </span>
            </h2>
            {/*
              Masonry CSS columns. La classe `flat-gallery-masonry` (globals.css)
              applique le même `--gallery-gap` au column-gap ET au margin-bottom
              des enfants → gap horizontal = gap vertical, garanti.
              Grid: 2 cols mobile, 3 cols desktop (max — cohérent brand book §9.8).
            */}
            <div className="flat-gallery-masonry columns-2 md:columns-3 [column-fill:_balance]">
              {group.items.map((p) => (
                <PhotoCard key={p._id} photo={p} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
