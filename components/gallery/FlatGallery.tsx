'use client';

import { useEffect, useMemo, useState } from 'react';
import { PhotoCard } from './PhotoCard';
import { PhotoLightbox } from './PhotoLightbox';
import { cn } from '@/lib/utils/cn';
import type { Photo } from '@/lib/sanity/queries';

type Mode = 'year' | 'location' | 'style' | 'camera' | 'lens';

const TABS: { id: Mode; label: string }[] = [
  { id: 'year', label: 'Year' },
  { id: 'location', label: 'Location' },
  { id: 'style', label: 'Style' },
  { id: 'camera', label: 'Camera' },
  { id: 'lens', label: 'Lens' },
];

const UNSPECIFIED_KEY = '__unspecified__';

type Group = { key: string; label: string; items: Photo[] };

/** Groupes triés A→Z, le groupe « Unspecified » toujours en dernier. */
function sortGroups(groups: Group[]): Group[] {
  return groups.sort((a, b) => {
    if (a.key === UNSPECIFIED_KEY) return 1;
    if (b.key === UNSPECIFIED_KEY) return -1;
    return a.label.localeCompare(b.label, 'en');
  });
}

/** Regroupement par boîtier ou objectif (référence optionnelle déréférencée). */
function groupByGear(
  photos: Photo[],
  pick: (p: Photo) => { slug: string; title: string } | null | undefined
): Group[] {
  const map = new Map<string, Group>();
  for (const p of photos) {
    const gear = pick(p);
    const key = gear?.slug ?? UNSPECIFIED_KEY;
    const label = gear?.title ?? 'Unspecified';
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key)!.items.push(p);
  }
  return sortGroups(Array.from(map.values()));
}

export function FlatGallery({ photos }: { photos: Photo[] }) {
  const [mode, setMode] = useState<Mode>('year');
  // Single-select pattern: activeKey === null means "All" is active (= everything visible).
  // activeKey === some group key means only that group's photos are visible.
  // Clicking the already-active chip returns to "All" (undo).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Single carousel instance for the whole flat gallery — initialIndex is the
  // photo's position in the currently-visible flat ordering.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const allGroups: Group[] = useMemo(() => {
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
    if (mode === 'camera') return groupByGear(photos, (p) => p.camera);
    if (mode === 'lens') return groupByGear(photos, (p) => p.lens);
    // style — une photo porte 1 à 3 styles et apparaît dans CHAQUE groupe
    // correspondant (choix produit : « displayed in each individually »).
    const map = new Map<string, Group>();
    for (const p of photos) {
      const styles = p.styles ?? [];
      if (styles.length === 0) {
        const key = UNSPECIFIED_KEY;
        if (!map.has(key)) map.set(key, { key, label: 'Unclassified', items: [] });
        map.get(key)!.items.push(p);
        continue;
      }
      for (const style of styles) {
        if (!map.has(style.slug)) {
          map.set(style.slug, { key: style.slug, label: style.title, items: [] });
        }
        map.get(style.slug)!.items.push(p);
      }
    }
    return sortGroups(Array.from(map.values()));
  }, [mode, photos]);

  // Reset to "All" when grouping mode changes.
  useEffect(() => {
    setActiveKey(null);
  }, [mode]);

  // Hash deep-link: if URL ends with #photo-<slug>, scroll to that photo on
  // mount. Used by the Studio's preview pane (Prod or Local) to land the user
  // on the photo they're editing. No router work needed — works in static
  // export. The figure carries id={`photo-${slug}`} (see PhotoCard).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#photo-')) return;
    const targetId = hash.slice(1);
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const allSelected = activeKey === null;
  const visibleGroups = allSelected
    ? allGroups
    : allGroups.filter((g) => g.key === activeKey);

  // Flat list of visible photos — what the user actually sees in document
  // order. The carousel cycles through this; changing filters resets the
  // carousel scope on the next open.
  const flatPhotos = useMemo(
    () => visibleGroups.flatMap((g) => g.items),
    [visibleGroups]
  );

  function activateOrReset(key: string) {
    // Click on the already-active chip → return to "All" (undo behaviour).
    setActiveKey((prev) => (prev === key ? null : key));
  }

  function selectAll() {
    setActiveKey(null);
  }

  // Nombre réel de photos — pas la somme des groupes (en mode Style une photo
  // peut appartenir à plusieurs groupes à la fois).
  const totalPhotos = photos.length;

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
      {/* Mode selector — sticky bar, defines the grouping axis */}
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
                'text-[12px] uppercase font-bold py-2 cursor-pointer transition-colors motion-reduce:transition-none',
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

      {/* Filter chips — pill buttons per Pencil "filter-button" spec.
          "All" chip at the start = reset (re-selects everything).
          Per-value chips toggle their group's visibility. */}
      <div
        role="group"
        aria-label={`Filter by ${mode}`}
        className="flex flex-wrap gap-x-3 gap-y-2"
        style={{ paddingLeft: 32, paddingRight: 32, paddingTop: 32 }}
      >
        {/* All — reset chip */}
        <button
          type="button"
          onClick={selectAll}
          aria-pressed={allSelected}
          style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
          className={cn(
            'inline-flex items-center text-[12px] font-bold tracking-[-0.02em] rounded-full border cursor-pointer transition-colors motion-reduce:transition-none',
            allSelected
              ? 'text-[var(--color-fg)] border-[var(--color-fg)]'
              : 'text-[var(--color-fg-muted)] border-[var(--color-fg-muted)] opacity-50 hover:opacity-100 hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]'
          )}
        >
          All ({totalPhotos})
        </button>

        {/* Per-value chips */}
        {allGroups.map((g) => {
          const isSelected = activeKey === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => activateOrReset(g.key)}
              aria-pressed={isSelected}
              style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
              className={cn(
                'inline-flex items-center text-[12px] font-bold tracking-[-0.02em] rounded-full border cursor-pointer transition-colors motion-reduce:transition-none',
                isSelected
                  ? 'text-[var(--color-fg)] border-[var(--color-fg)]'
                  : 'text-[var(--color-fg-muted)] border-[var(--color-fg-muted)] opacity-50 hover:opacity-100 hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]'
              )}
            >
              {g.label} ({g.items.length})
            </button>
          );
        })}
      </div>

      {/* Groups — 64 px between each (per spec).
          Single-select means visibleGroups is never empty (always "All" or one group). */}
      <div
        className="flex flex-col gap-16"
        style={{ paddingLeft: 32, paddingRight: 32, paddingTop: 40 }}
      >
        {(() => {
          // Walk through visibleGroups + items in document order, assigning each
          // photo its position in flatPhotos so the carousel opens at the
          // clicked photo. Tracked outside the .map closure so it survives
          // group boundaries.
          let flatCursor = 0;
          return visibleGroups.map((group) => (
            <section key={group.key}>
              {/* Marges en inline : `mb-6`/`ml-3` sont avalés par le reset
                  global hors @layer (cf. CLAUDE.md). Sans interlettrage, le
                  compteur collé au titre devenait franchement visible. */}
              <h2
                className="text-[11px] uppercase font-bold text-[var(--color-fg-muted)]"
                style={{ marginBottom: 24 }}
              >
                {group.label}
                <span
                  className="text-[var(--color-fg-muted)]/60"
                  style={{ marginLeft: 12 }}
                >
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
                {group.items.map((p) => {
                  const myIndex = flatCursor++;
                  return (
                    <PhotoCard
                      key={p._id}
                      photo={p}
                      onOpen={() => setOpenIndex(myIndex)}
                    />
                  );
                })}
              </div>
            </section>
          ));
        })()}
      </div>

      {openIndex !== null && flatPhotos.length > 0 && (
        <PhotoLightbox
          photos={flatPhotos}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}
