'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StateDot } from '@/components/site/StateDot';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { DICT } from '@/lib/journal/i18n';
import type { MapView } from '@/lib/journal/conceptMapData';
import { HASH_KEY, indexMap, isCommon, NO_FILTER, visibleIds, type Filters } from './model';
import { MapPanel } from './MapPanel';
import { MapList } from './MapList';

/**
 * La page `/concept-map` côté navigateur : filtres à gauche (comme l'index
 * du journal), puis la carte OU la liste.
 *
 * Vue par défaut : la carte dès 768 px, la liste en dessous. Tant que la page
 * n'a pas tourné, c'est le CSS qui choisit (`auto`) : la liste est dans le
 * HTML du build pour tout le monde, la carte n'apparaît qu'une fois montée.
 * Un choix explicite (Carte / Liste) l'emporte ensuite sur la largeur.
 *
 * La sélection vit dans l'adresse (`#n=<id>`) : elle se partage, et le retour
 * arrière depuis un passage retrouve le nœud ouvert.
 */

const Graph = dynamic(() => import('./ConceptMapGraph'), { ssr: false });

const FILTER_COL = 220;
/** Le panneau posé sur le dessin, à droite (dès 768 px). */
const PANEL_WIDTH = 360;

type View = 'auto' | 'map' | 'list';

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        MICRO_LABEL,
        'flex items-center gap-[8px] text-left transition-colors duration-200 motion-reduce:transition-none',
        on ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
      )}
      style={{ paddingBlock: 4 }}
    >
      <StateDot on={on} />
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p className={cn(MICRO_LABEL, 'text-[var(--color-fg-faint)]')}>{label}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 md:flex-col md:gap-y-0.5">{children}</div>
    </div>
  );
}

const readHash = () => {
  const m = window.location.hash.match(new RegExp(`^#${HASH_KEY}=(.+)$`));
  return m ? decodeURIComponent(m[1]) : null;
};

export function ConceptMapExplorer({ view: data }: { view: MapView }) {
  const ix = useMemo(() => indexMap(data), [data]);
  const [filters, setFilters] = useState<Filters>(NO_FILTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [center, setCenter] = useState(0);
  const [view, setView] = useState<View>('auto');
  const [wide, setWide] = useState<boolean | null>(null);
  const dict = DICT[data.lang];
  const t = dict.map;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    const fromHash = readHash();
    if (fromHash && ix.byId.has(fromHash)) {
      setSelected(fromHash);
      setCenter((c) => c + 1);
    }
    return () => mq.removeEventListener('change', sync);
  }, [ix]);

  const visible = useMemo(() => visibleIds(ix, filters), [ix, filters]);
  const current = view === 'auto' ? (wide ? 'map' : 'list') : view;

  const select = useCallback((id: string | null, recenter = false) => {
    setSelected(id);
    if (recenter) setCenter((c) => c + 1);
    const url = new URL(window.location.href);
    url.hash = id ? `${HASH_KEY}=${encodeURIComponent(id)}` : '';
    history.replaceState(history.state, '', url);
  }, []);

  // Un filtre qui cache le nœud ouvert ferme son panneau.
  const shown = selected && visible.has(selected) ? selected : null;

  const counts = useMemo(() => {
    const articles = data.nodes.filter((n) => n.kind === 'article');
    return {
      series: new Map(data.series.map((s) => [s.title, articles.filter((a) => a.series === s.title).length])),
      themes: new Map(data.themes.map((t) => [t.title, articles.filter((a) => a.themes.includes(t.title)).length])),
      common: data.nodes.filter(isCommon).length,
    };
  }, [data]);
  const filtered = filters.series || filters.theme || filters.common;
  const toggle = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? NO_FILTER[key] : value }));

  const n = (kind: string) => [...visible].filter((id) => ix.byId.get(id)?.kind === kind).length;

  return (
    <div className="flex flex-col gap-8 md:grid md:gap-x-12" style={{ gridTemplateColumns: `${FILTER_COL}px minmax(0, 1fr)` }}>
      <aside className="flex flex-col gap-6 self-start md:sticky md:top-6" aria-label={t.filters}>
        <Group label={t.view}>
          <Choice on={current === 'map'} onClick={() => setView('map')}>
            {t.mapView}
          </Choice>
          <Choice on={current === 'list'} onClick={() => setView('list')}>
            {t.listView}
          </Choice>
        </Group>
        <Group label={t.series}>
          {data.series.map((s) => (
            <Choice key={s.title} on={filters.series === s.title} onClick={() => toggle('series', s.title)}>
              <span>
                {s.title} <span className="font-normal">({counts.series.get(s.title)})</span>
              </span>
            </Choice>
          ))}
        </Group>
        <Group label={t.themes}>
          {data.themes.map((t) => (
            <Choice key={t.title} on={filters.theme === t.title} onClick={() => toggle('theme', t.title)}>
              <TagSwatch color={t.color} />
              <span>
                {t.title} <span className="font-normal">({counts.themes.get(t.title)})</span>
              </span>
            </Choice>
          ))}
        </Group>
        <Group label={t.structures}>
          <Choice on={filters.common} onClick={() => toggle('common', true)}>
            <span>
              {t.common} <span className="font-normal">({counts.common})</span>
            </span>
          </Choice>
        </Group>
        <div className="flex flex-col gap-2 border-t border-[var(--color-line)]" style={{ paddingTop: 12 }}>
          <p aria-live="polite" className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}>
            {dict.articles(n('article'))} · {t.theses(n('thesis'))} · {t.mechanisms(n('mechanism'))}
          </p>
          {filtered && (
            <button type="button" onClick={() => setFilters(NO_FILTER)} className={cn(MICRO_LABEL, 'w-fit text-[var(--color-fg)] underline underline-offset-4')}>
              {t.showAll}
            </button>
          )}
        </div>
      </aside>

      <section aria-label="Concept Map" className="min-w-0">
        <div className={cn(view === 'auto' ? 'hidden md:block' : current === 'map' ? 'block' : 'hidden')}>
          <p className="sr-only">{t.drawingNote}</p>
          <div className="flex flex-col gap-6 md:relative">
            <div
              aria-hidden
              className="concept-stage relative overflow-hidden border border-[var(--color-line)] bg-[var(--color-bg)]"
              style={{ height: 'clamp(420px, calc(100dvh - 12rem), 860px)' }}
            >
              {current === 'map' && <Graph ix={ix} visible={visible} selected={shown} center={center} inset={wide && shown ? PANEL_WIDTH + 12 : 0} onSelect={(id) => select(id)} />}
              <p className={cn(MICRO_LABEL, 'pointer-events-none absolute bottom-3 left-3 text-[var(--color-fg-faint)]')}>
                <span className="md:hidden">{t.zoomTouch}</span>
                <span className="hidden md:inline">{t.zoomWheel}</span>
              </p>
            </div>
            {shown && (
              <div
                className="bg-[var(--color-bg-raised)] md:absolute md:bottom-3 md:right-3 md:top-3 md:w-[var(--concept-panel)] md:overflow-y-auto md:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                style={{ padding: 20, ['--concept-panel' as string]: `${PANEL_WIDTH}px` }}
              >
                <MapPanel ix={ix} id={shown} onSelect={(id) => select(id, true)} onClose={() => select(null)} />
              </div>
            )}
          </div>
        </div>
        <div className={cn(view === 'auto' ? 'md:hidden' : current === 'list' ? 'block' : 'hidden')}>
          <MapList
            ix={ix}
            visible={visible}
            onShow={(id) => {
              setView('map');
              select(id, true);
            }}
          />
        </div>
      </section>
    </div>
  );
}
