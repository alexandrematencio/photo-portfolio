'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { StateDot } from '@/components/site/StateDot';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { Folder, FOLDER_MS, FolderList, type Filter } from '@/components/journal/FolderTree';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { DICT } from '@/lib/journal/i18n';
import type { MapView } from '@/lib/journal/conceptMapData';
import { HASH_KEY, indexMap, isCommon, LABEL_DEFAULT, LABEL_STEPS, NO_FILTER, visibleIds, type Filters, type LabelKind, type LabelReach, type MapNav } from './model';
import { MapPanel } from './MapPanel';
import { KEY_OF, MapHelp, MapKeys, type NavKey } from './MapControls';
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
 *
 * Sélection et panneau sont deux choses (2026-10-30, Alexandre) : fermer le
 * panneau laisse le nœud allumé sur la carte. On le lâche avec
 * « Désélectionner », ou en cliquant hors de son voisinage (`sticky`).
 *
 * Commandes (2026-10-30, Alexandre) : « Aide ? » en haut à droite du cadre,
 * le faux clavier en bas à droite, et « Réglages » au pied de la colonne de
 * gauche — un module à part, pas un dossier de l'index (2026-10-30, Alexandre) —
 * qui règle à quelle distance chaque rang affiche ses noms (mémorisé dans ce
 * navigateur). Un clic
 * dans la carte, dans la colonne de gauche ou sur le faux clavier « arme » la
 * carte : les flèches, + − 0 et Échap la pilotent au lieu de faire défiler la
 * page, jusqu'au prochain clic ailleurs.
 *
 * Sous les filtres, « thèses/ » et « mécanismes/ » (2026-10-29, Alexandre) :
 * l'index complet de la carte, dans les dossiers de l'accueil du journal
 * (`FolderTree`), un seul ouvert à la fois, fermés au départ. Ils suivent les
 * filtres ; une entrée ouvre son nœud sur la carte, comme la liste.
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

/**
 * Dès 768 px, la colonne collante ne dépasse jamais la hauteur visible
 * (barre de navigation, 64 px, et 24 px d'air dessus et dessous) : un dossier
 * ouvert la fait défiler, elle, au lieu de pousser la carte hors de l'écran.
 */
const ASIDE_MAX = 'calc(100dvh - 7rem)';

/** Une ligne de rubrique dans « thèses/ » : le titre de l'article, en Switzer (Alexandre, 2026-10-29), au ras du dossier. */
function ArticleHeading({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-[family-name:var(--font-index)] text-[14px] font-medium leading-[18px] text-[var(--color-fg-faint)]"
      style={{ paddingTop: 16, paddingBottom: 16, paddingLeft: 0 }}
    >
      {children}
    </p>
  );
}

const LABELS_KEY = 'concept-map:labels';
const LABEL_KINDS: LabelKind[] = ['article', 'mechanism', 'thesis'];

/** Une ligne des réglages : le rang, le cran en clair, la glissière. */
function ReachRow({ label, value, text, onChange }: { label: string; value: number; text: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1" style={{ paddingBottom: 10 }}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 font-mono text-[12px] leading-[16px]">
        <span className="text-[var(--color-fg)]">{label.toLocaleLowerCase()}</span>
        <span className="text-[var(--color-fg-faint)]">{text}</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={LABEL_STEPS}
        step={1}
        value={value}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
        className="map-range w-full"
      />
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
  const [panel, setPanel] = useState(true);
  const [center, setCenter] = useState(0);
  const [view, setView] = useState<View>('auto');
  const [wide, setWide] = useState<boolean | null>(null);
  const [folder, setFolder] = useState<'theses' | 'mechanisms' | null>(null);
  const [labels, setLabels] = useState<LabelReach>(LABEL_DEFAULT);
  const [help, setHelp] = useState(false);
  const [armed, setArmed] = useState(false);
  const [lit, setLit] = useState<ReadonlySet<NavKey>>(() => new Set());
  const nav = useRef<MapNav | null>(null);
  const held = useRef(new Set<NavKey>());
  const frame = useRef<HTMLDivElement>(null);
  const aside = useRef<HTMLElement>(null);
  const [settled, setSettled] = useState(false);
  const folderId = useId();
  const dict = DICT[data.lang];
  const t = dict.map;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setWide(mq.matches);
    sync();
    setSettled(true);
    mq.addEventListener('change', sync);
    const fromHash = readHash();
    if (fromHash && ix.byId.has(fromHash)) {
      setSelected(fromHash);
      setCenter((c) => c + 1);
    }
    return () => mq.removeEventListener('change', sync);
  }, [ix]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LABELS_KEY) ?? 'null');
      if (saved && LABEL_KINDS.every((k) => Number.isInteger(saved[k]))) setLabels(saved);
    } catch {}
  }, []);
  const reach = (k: LabelKind, v: number) =>
    setLabels((l) => {
      const next = { ...l, [k]: v };
      try {
        localStorage.setItem(LABELS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const visible = useMemo(() => visibleIds(ix, filters), [ix, filters]);
  const current = view === 'auto' ? (wide ? 'map' : 'list') : view;

  const select = useCallback((id: string | null, recenter = false) => {
    setSelected(id);
    setPanel(true);
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

  // L'index des dossiers : les thèses par article (ordre de lecture), les mécanismes par nom.
  const index = useMemo(() => {
    const theses = data.nodes
      .filter((a) => a.kind === 'article' && visible.has(a.id))
      .map((a) => ({
        article: a,
        items: (ix.thesesOfArticle.get(a.id) ?? []).filter((id) => visible.has(id)).map((id): Filter => ({ key: id, label: ix.byId.get(id)!.label })),
      }))
      .filter((g) => g.items.length > 0);
    const mechanisms = data.nodes
      .filter((m) => m.kind === 'mechanism' && visible.has(m.id))
      .sort((a, b) => a.label.localeCompare(b.label, data.lang))
      .map((m): Filter => ({ key: m.id, label: m.label, count: m.articles.length, color: (m.theme && ix.themeColor.get(m.theme)) || null }));
    return { theses, mechanisms, thesisCount: theses.reduce((k, g) => k + g.items.length, 0) };
  }, [data, ix, visible]);
  const stage = useRef<HTMLElement>(null);
  const show = (id: string) => {
    if (current === 'list') setView('map');
    select(id === shown && panel ? null : id, true);
    // Téléphone : la carte est sous la colonne. On replie le dossier, puis on y
    // descend une fois le repli fini (avant, la cible bouge encore sous le défilement).
    if (wide) return;
    setFolder(null);
    const smooth = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    window.setTimeout(() => stage.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }), smooth ? FOLDER_MS : 0);
  };
  const toggleFolder = (name: 'theses' | 'mechanisms') => setFolder((f) => (f === name ? null : name));

  // Une touche enfoncée (vraie ou fausse) : les flèches tiennent une direction, le reste agit à l'appui.
  const press = useCallback((k: NavKey, on: boolean) => {
    const h = held.current;
    if (on === h.has(k)) return;
    if (on) h.add(k);
    else h.delete(k);
    setLit(new Set(h));
    if (k === 'in' || k === 'out') return void (on && nav.current?.zoom(k === 'in' ? 1 : -1));
    if (k === 'reset') return void (on && nav.current?.reset());
    const x = +h.has('right') - +h.has('left');
    const y = +h.has('down') - +h.has('up');
    const len = Math.hypot(x, y) || 1;
    nav.current?.drive(x / len, y / len);
  }, []);
  const live = armed && current === 'map';

  // Armer : un appui dans le cadre de la carte ou dans la colonne de gauche ; ailleurs, désarmer.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const at = e.target as Node;
      setArmed(!!(frame.current?.contains(at) || aside.current?.contains(at)));
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, []);

  useEffect(() => {
    const releaseAll = () => [...held.current].forEach((k) => press(k, false));
    if (!live) return releaseAll();
    const down = (e: KeyboardEvent) => {
      if (e.altKey) return;
      // ⌘ + / ⌘ − (Ctrl ailleurs) : le zoom de la carte plutôt que celui de la page. Sur
      // macOS, la touche relâchée sous ⌘ n'envoie pas de keyup : la fausse touche s'enfonce
      // le temps d'un appui, puis remonte seule.
      if (e.metaKey || e.ctrlKey) {
        const k = KEY_OF[e.key] ?? (e.code === 'NumpadAdd' ? 'in' : e.code === 'NumpadSubtract' ? 'out' : undefined);
        if (k !== 'in' && k !== 'out') return;
        e.preventDefault();
        if (e.repeat) return void nav.current?.zoom(k === 'in' ? 1 : -1);
        press(k, true);
        window.setTimeout(() => press(k, false), 120);
        return;
      }
      if ((e.target as Element).closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === '?') {
        e.preventDefault();
        return setHelp((h) => !h);
      }
      if (e.key === 'Escape') {
        if (shown) select(null);
        else setArmed(false);
        return;
      }
      const k = KEY_OF[e.key];
      if (!k) return;
      e.preventDefault();
      if (e.repeat) return void ((k === 'in' || k === 'out') && nav.current?.zoom(k === 'in' ? 1 : -1));
      press(k, true);
    };
    const up = (e: KeyboardEvent) => {
      const k = KEY_OF[e.key];
      if (k) press(k, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [live, shown, select, press]);

  // Le panneau couvre la droite du cadre (dès 768 px) : les commandes de ce côté se posent à sa gauche.
  const beside = wide && shown && panel ? PANEL_WIDTH + 12 : 0;

  const n = (kind: string) => [...visible].filter((id) => ix.byId.get(id)?.kind === kind).length;

  return (
    <div className="flex flex-col gap-8 md:grid md:gap-x-12" style={{ gridTemplateColumns: `${FILTER_COL}px minmax(0, 1fr)` }}>
      <aside
        ref={aside}
        className="flex flex-col gap-6 self-start md:sticky md:top-6 md:max-h-[var(--aside-max)] md:overflow-y-auto md:overscroll-contain"
        style={{ ['--aside-max' as string]: ASIDE_MAX }}
        aria-label={t.filters}
      >
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
        <div role="group" aria-label={t.index} className="flex flex-col">
          <Folder
            id={`${folderId}-theses`}
            name={t.thesesFolder}
            state={folder === 'theses' ? 'open' : 'closed'}
            settled={settled}
            onToggle={() => toggleFolder('theses')}
            lit={!!shown && ix.byId.get(shown)?.kind === 'thesis'}
            entries={index.thesisCount}
            peek={null}
          >
            <div>
              {index.theses.map((g) => (
                <div key={g.article.id}>
                  <ArticleHeading>{g.article.label}</ArticleHeading>
                  <FolderList items={g.items} isOn={(key) => key === shown} onChange={show} type="index" />
                </div>
              ))}
            </div>
          </Folder>
          <Folder
            id={`${folderId}-mechanisms`}
            name={t.mechanismsFolder}
            state={folder === 'mechanisms' ? 'open' : 'closed'}
            settled={settled}
            onToggle={() => toggleFolder('mechanisms')}
            lit={!!shown && ix.byId.get(shown)?.kind === 'mechanism'}
            entries={index.mechanisms.length}
            peek={null}
          >
            <FolderList items={index.mechanisms} isOn={(key) => key === shown} onChange={show} type="index" />
          </Folder>
        </div>
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
        {current === 'map' && (
          <section aria-label={t.settings} className="flex flex-col gap-2 border-t border-[var(--color-line)]" style={{ paddingTop: 12 }}>
            <p className={cn(MICRO_LABEL, 'text-[var(--color-fg-faint)]')}>{t.settings}</p>
            <div role="group" aria-label={t.labelsNote} className="flex flex-col">
              <p className="text-[12px] leading-[17px] text-[var(--color-fg-muted)]" style={{ paddingBottom: 8 }}>
                {t.labelsNote}
              </p>
              {LABEL_KINDS.map((k) => (
                <ReachRow key={k} label={t.labelKinds[k]} value={labels[k]} text={t.reach(labels[k])} onChange={(v) => reach(k, v)} />
              ))}
            </div>
          </section>
        )}
      </aside>

      <section ref={stage} aria-label="Concept Map" className="min-w-0" style={{ scrollMarginTop: 16 }}>
        <div className={cn(view === 'auto' ? 'hidden md:block' : current === 'map' ? 'block' : 'hidden')}>
          <p className="sr-only">{t.drawingNote}</p>
          <div ref={frame} className="relative flex flex-col gap-6">
            {/* Le cadre et ce qui se pose dessus : les coins se mesurent au cadre seul,
                pas au panneau qui passe dessous sur téléphone. */}
            <div className="relative">
              <div
                aria-hidden
                className="concept-stage relative overflow-hidden border border-[var(--color-line)] bg-[var(--color-bg)]"
                style={{ height: 'clamp(420px, calc(100dvh - 12rem), 860px)' }}
              >
                {current === 'map' && (
                  <Graph ix={ix} visible={visible} selected={shown} center={center} inset={beside} sticky labels={labels} nav={nav} onSelect={(id) => select(id)} />
                )}
              </div>
              {/* Rangée du haut. À gauche, l'indication de zoom puis « Désélectionner »
                  dessous, en colonne pour qu'une indication sur deux lignes (téléphone,
                  russe) pousse le bouton au lieu de le chevaucher. À droite, « Aide ? ».
                  Hors du dessin (`aria-hidden`) pour rester atteignables au clavier ; à
                  gauche du panneau quand il est ouvert. */}
              <div className="pointer-events-none absolute top-3 flex items-start justify-between gap-4" style={{ left: 12, right: 12 + beside }}>
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <p aria-hidden className={cn(MICRO_LABEL, 'font-medium text-[var(--color-fg)]')}>
                    <span className="md:hidden">{t.zoomTouch}</span>
                    <span className="hidden md:inline">{t.zoomWheel}</span>
                  </p>
                  {shown && (
                    <button
                      type="button"
                      onClick={() => select(null)}
                      className={cn(
                        MICRO_LABEL,
                        'pointer-events-auto flex items-center gap-2 border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-fg-muted)] transition-colors duration-200 hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)] motion-reduce:transition-none',
                      )}
                      style={{ padding: '6px 10px' }}
                    >
                      {t.deselect}
                      <svg aria-hidden width={10} height={10} viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8" />
                      </svg>
                    </button>
                  )}
                </div>
                <MapHelp t={t} open={help} onOpen={setHelp} />
              </div>
              <div className="absolute bottom-3" style={{ right: 12 + beside }}>
                <MapKeys t={t} armed={live} lit={lit} onPress={press} />
              </div>
            </div>
            <p aria-live="polite" className="sr-only">
              {live ? t.keys.on : ''}
            </p>
            {shown && panel && (
              <div
                className="bg-[var(--color-bg-raised)] md:absolute md:bottom-3 md:right-3 md:top-3 md:w-[var(--concept-panel)] md:overflow-y-auto md:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                style={{ padding: 20, ['--concept-panel' as string]: `${PANEL_WIDTH}px` }}
              >
                <MapPanel ix={ix} id={shown} onSelect={(id) => select(id, true)} onClose={() => setPanel(false)} />
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
