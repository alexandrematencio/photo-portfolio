'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Cog, GitMerge, Library, List, MessageSquareQuote, Network, Tags } from 'lucide-react';
import { StateDot } from '@/components/site/StateDot';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { FolderList, type Filter } from '@/components/journal/FolderTree';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { DICT } from '@/lib/journal/i18n';
import type { MapView } from '@/lib/journal/conceptMapData';
import { HASH_KEY, indexMap, isCommon, LABEL_DEFAULT, LABEL_STEPS, linkedTo, neighbourhood, NO_FILTER, themeSystem, visibleIds, type Filters, type LabelKind, type LabelReach, type MapNav } from './model';
import { MapPanel } from './MapPanel';
import { KEY_OF, MapHelp, MapKeys, type NavKey } from './MapControls';
import { MapList } from './MapList';
import { CLOSE_MS, MapMenu, SHEET_OUT, type MenuFocus, type MenuSection } from './MapMenu';
import type { MapGestures, MapPreview } from './ConceptMapGraph';

/**
 * La page `/concept-map` côté navigateur, en dashboard (2026-10-30,
 * Alexandre) : le menu à gauche (`MapMenu`, repliable en bande d'icônes,
 * rangée d'icônes et tiroir sur téléphone), puis la carte OU la liste, d'un
 * bord à l'autre de l'écran.
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
 * le faux clavier en bas à droite, et « Réglages » en tête du menu, sous son
 * en-tête et avant les catégories, qui règle à quelle distance chaque rang affiche
 * ses noms (mémorisé dans ce navigateur). Un clic dans la carte, dans le menu
 * ou sur le faux clavier « arme » la carte : les flèches, + − 0, [ et Échap la
 * pilotent au lieu de faire défiler la page, jusqu'au prochain clic ailleurs.
 *
 * Carte COOPÉRATIVE (2026-10-30, Alexandre — la page ne défilait plus) : la
 * règle de Google Maps et de MapLibre, ajustée à un dashboard qui remplit
 * l'écran. La molette fait défiler la page tant qu'on n'a pas cliqué dans la
 * carte ; après, elle zoome, jusqu'à ce que le pointeur sorte de la carte
 * (Leaflet.Sleep) ou qu'on presse Échap — un filet d'encre cerne alors la
 * carte. ⌘/Ctrl + molette et le pincement zooment toujours : l'intention est
 * sans ambiguïté. Sur écran tactile, un doigt fait défiler la page, deux
 * doigts déplacent la carte. Un geste refusé affiche comment faire — pour la
 * molette, seulement quand le dashboard remplit l'écran.
 *
 * Sous les filtres, « Thèses » et « Mécanismes » (2026-10-29, Alexandre) :
 * l'index complet de la carte, repliés au départ comme toute catégorie qu'on
 * n'a pas dépliée. Elles suivent les filtres ; une entrée allume son nœud sur la carte,
 * puis le menu se replie et la carte, élargie, le recadre.
 *
 * Aperçu et cadrage (2026-10-30, Alexandre) : survoler une entrée du menu —
 * série, thématique, structure, thèse, mécanisme — allume son système à moitié
 * sur la carte ; le clic achève l'estompage, puis la caméra cadre ce système
 * au plus près (noms compris). Un nœud choisi sur la carte, voilé ou non, est
 * cadré de même. Si le dashboard dépasse de l'écran, la page glisse d'abord
 * pour le centrer.
 */

const Graph = dynamic(() => import('./ConceptMapGraph'), { ssr: false });

/** L'avis « cliquez sur la carte pour zoomer » reste ce temps après le dernier geste refusé. */
const REFUSAL_MS = 1600;

/** Le panneau posé sur le dessin, à droite (dès 768 px). */
const PANEL_WIDTH = 360;

type View = 'auto' | 'map' | 'list';

/** `empty` : ce choix, ajouté aux filtres en cours, ne laisserait rien sur la carte — grisé. */
/** `linked` : le nœud choisi sur la carte en relève — la pastille s'allume, le libellé reste tel quel. */
function Choice({
  on,
  linked = false,
  empty = false,
  onClick,
  onPreview,
  children,
}: {
  on: boolean;
  linked?: boolean;
  empty?: boolean;
  onClick: () => void;
  onPreview?: (on: boolean) => void;
  children: ReactNode;
}) {
  // Le choix actif reste cliquable : c'est par lui qu'on retire le filtre.
  empty = empty && !on;
  const peek = empty ? undefined : onPreview;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={empty}
      onClick={onClick}
      onPointerEnter={peek && ((e) => e.pointerType !== 'touch' && peek(true))}
      onPointerLeave={peek && (() => peek(false))}
      onFocus={peek && (() => peek(true))}
      onBlur={peek && (() => peek(false))}
      className={cn(
        MICRO_LABEL,
        'flex items-center gap-[8px] text-left transition-colors duration-200 motion-reduce:transition-none',
        on ? 'text-[var(--color-fg)]' : empty ? 'text-[var(--color-fg-faint)] [&>span[aria-hidden]]:opacity-40' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
      )}
      style={{ paddingBlock: 4 }}
    >
      <StateDot on={on || linked} />
      {children}
    </button>
  );
}

/** Les choix d'une catégorie : son titre est dans l'en-tête de `MapMenu`. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-y-0.5">
      {children}
    </div>
  );
}

const MENU_KEY = 'concept-map:menu';
/** Le dashboard recentré dans l'écran : un glissé court, qui ne fait pas attendre la carte. */
const GLIDE_MS = 380;
/** Le nœud s'allume, on le voit, PUIS le menu part : une chose bouge à la fois. */
const COLLAPSE_AFTER = 150;

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
  const [fit, setFit] = useState(0);
  const [preview, setPreview] = useState<MapPreview>(null);
  const [view, setView] = useState<View>('auto');
  const [wide, setWide] = useState<boolean | null>(null);
  const [labels, setLabels] = useState<LabelReach>(LABEL_DEFAULT);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(true);
  const [sheet, setSheet] = useState<string | null>(null);
  const [menuFocus, setMenuFocus] = useState<MenuFocus | null>(null);
  const later = useRef<number[]>([]);
  const [armed, setArmed] = useState(false);
  // La carte TIENT la molette (2026-10-30, Alexandre : la page ne défilait plus) :
  // seulement après un appui dans la carte, et jusqu'à ce que le pointeur en
  // sorte. Avant, la molette fait défiler la page — sauf ⌘/Ctrl ou pincement.
  const [grip, setGrip] = useState(false);
  const heldNow = useRef(false);
  heldNow.current = grip;
  const [refusal, setRefusal] = useState<{ gesture: 'wheel' | 'touch'; on: boolean }>({ gesture: 'wheel', on: false });
  const refusalTimer = useRef(0);
  const board = useRef<HTMLDivElement>(null);
  const [mod, setMod] = useState('Ctrl');
  const [lit, setLit] = useState<ReadonlySet<NavKey>>(() => new Set());
  const nav = useRef<MapNav | null>(null);
  const held = useRef(new Set<NavKey>());
  const frame = useRef<HTMLDivElement>(null);
  const aside = useRef<HTMLElement>(null);
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
      setFit((c) => c + 1);
    }
    return () => mq.removeEventListener('change', sync);
  }, [ix]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LABELS_KEY) ?? 'null');
      if (saved && LABEL_KINDS.every((k) => Number.isInteger(saved[k]))) setLabels(saved);
      if (localStorage.getItem(MENU_KEY) === 'shut') setMenu(false);
    } catch {}
    const timers = later.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);
  // Seul un geste du lecteur (bouton, icône, touche [) est retenu d'une visite à
  // l'autre : le repli automatique après un choix ne l'est pas.
  const toggleMenu = useCallback((open: boolean) => {
    setMenu(open);
    try {
      localStorage.setItem(MENU_KEY, open ? 'open' : 'shut');
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
    if (recenter) setFit((c) => c + 1);
    const url = new URL(window.location.href);
    url.hash = id ? `${HASH_KEY}=${encodeURIComponent(id)}` : '';
    history.replaceState(history.state, '', url);
  }, []);

  // Un filtre qui cache le nœud ouvert ferme son panneau.
  const shown = selected && visible.has(selected) ? selected : null;

  // Chaque choix compte ce qu'il laisserait, combiné aux autres filtres : une
  // série sans aucun article de la thématique choisie tombe à 0, et se grise.
  const counts = useMemo(() => {
    const articles = (f: Filters) => [...visibleIds(ix, f)].filter((id) => ix.byId.get(id)?.kind === 'article').length;
    return {
      series: new Map(data.series.map((s) => [s.title, articles({ ...filters, series: s.title })])),
      themes: new Map(data.themes.map((t) => [t.title, articles({ ...filters, theme: t.title })])),
      common: [...visibleIds(ix, { ...filters, common: true })].filter((id) => isCommon(ix.byId.get(id)!)).length,
    };
  }, [data, ix, filters]);
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
  // Le dashboard dépasse de l'écran (on est encore sous le titre, ou plus bas) :
  // la page glisse pour le centrer, en même temps que la carte s'anime. Le
  // journal défile dans un conteneur sous la barre de navigation (`FramedScroll`).
  const glide = useRef(0);
  const centerBoard = () => {
    const r = board.current?.getBoundingClientRect();
    const scroller = board.current?.closest<HTMLElement>('[data-scroll-container]') ?? (document.scrollingElement as HTMLElement | null);
    if (!r || !scroller || !wide) return;
    const box = scroller === document.scrollingElement ? { top: 0, height: window.innerHeight } : scroller.getBoundingClientRect();
    if (r.top >= box.top - 4 && r.bottom <= box.top + box.height + 4) return;
    const from = scroller.scrollTop;
    const to = from + r.top - box.top - Math.max(0, (box.height - r.height) / 2);
    cancelAnimationFrame(glide.current);
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return void (scroller.scrollTop = to);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / GLIDE_MS);
      const k = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      scroller.scrollTop = from + (to - from) * k;
      if (t < 1) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(glide.current), []);
  // Le menu replié ou la liste affichée : plus rien n'est survolé.
  useEffect(() => {
    if (!menu || current !== 'map') setPreview(null);
  }, [menu, current]);

  // Un filtre choisi : la carte cadre ce qui reste (ou le nœud choisi, s'il reste).
  const filterBy = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    toggle(key, value);
    if (current !== 'map') return;
    centerBoard();
    setFit((c) => c + 1);
  };
  // Une thématique s'isole par ses mécanismes (`themeSystem`) ; une série ou « communs », par ce que le filtre laisserait voir.
  const previewFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => (on: boolean) =>
    setPreview(
      on && wide && current === 'map'
        ? { key: `${key}:${value}`, ids: key === 'theme' ? themeSystem(ix, value as string, visible) : visibleIds(ix, { ...filters, [key]: value }) }
        : null,
    );
  const previewNode = (id: string | null) => setPreview(id && wide && current === 'map' ? { key: id, ids: neighbourhood(ix, id) } : null);

  const show = (id: string) => {
    if (current === 'list') setView('map');
    const next = id === shown && panel ? null : id;
    const smooth = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    later.current.forEach((t) => window.clearTimeout(t));
    later.current = [];
    // Téléphone : la carte est sous le menu. Le tiroir redescend, puis on y
    // descend une fois qu'il est parti.
    if (!wide) {
      select(next, true);
      setSheet(null);
      later.current.push(window.setTimeout(() => stage.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }), smooth ? SHEET_OUT : 0));
      return;
    }
    if (next) centerBoard();
    if (!next || !menu) return select(next, !!next);
    // Le nœud s'allume tout de suite ; le menu se replie ensuite, et la carte
    // ne le cadre qu'une fois élargie (avant, la cible glisserait sous la caméra).
    select(next);
    if (!smooth) {
      setMenu(false);
      later.current.push(window.setTimeout(() => setFit((c) => c + 1), 50));
      return;
    }
    later.current.push(
      window.setTimeout(() => setMenu(false), COLLAPSE_AFTER),
      window.setTimeout(() => setFit((c) => c + 1), COLLAPSE_AFTER + CLOSE_MS + 100),
    );
  };

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
  // La molette, elle, ne se tient qu'après un appui dans la carte (souris ou stylet).
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const at = e.target as Node;
      const inMap = !!frame.current?.contains(at);
      setArmed(inMap || !!aside.current?.contains(at));
      setGrip(inMap && e.pointerType !== 'touch');
    };
    document.addEventListener('pointerdown', down, true);
    setMod(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl');
    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.clearTimeout(refusalTimer.current);
    };
  }, []);

  // Un geste laissé à la page : on dit comment le donner à la carte. Pour la
  // molette, seulement quand le dashboard remplit l'écran — c'est là qu'on
  // voulait zoomer ; à moitié visible, on traversait la page, rien à dire.
  const gestures = useMemo<MapGestures>(
    () => ({
      held: () => heldNow.current,
      refused: (gesture) => {
        const r = board.current?.getBoundingClientRect();
        if (gesture === 'wheel' && r && (r.top < -4 || r.bottom > window.innerHeight + 4)) return;
        setRefusal({ gesture, on: true });
        window.clearTimeout(refusalTimer.current);
        refusalTimer.current = window.setTimeout(() => setRefusal((x) => ({ ...x, on: false })), REFUSAL_MS);
      },
    }),
    [],
  );

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
      if (e.key === '[') {
        e.preventDefault();
        return toggleMenu(!menu);
      }
      if (e.key === 'Escape') {
        if (shown) select(null);
        else {
          setArmed(false);
          setGrip(false);
        }
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
  }, [live, shown, select, press, menu, toggleMenu]);

  // Le panneau couvre la droite du cadre (dès 768 px) : les commandes de ce côté se posent à sa gauche.
  const beside = wide && shown && panel ? PANEL_WIDTH + 12 : 0;

  const n = (kind: string) => [...visible].filter((id) => ix.byId.get(id)?.kind === kind).length;

  const kindOfShown = shown ? ix.byId.get(shown)?.kind : null;
  const linked = useMemo(() => linkedTo(ix, shown), [ix, shown]);
  // Téléphone : la vue choisie se joue derrière le tiroir, et son voile
  // retiendrait la page tant qu'on ne l'a pas touché. Le tiroir redescend.
  const pickView = (v: View) => {
    setView(v);
    if (!wide) setSheet(null);
  };
  const sections: MenuSection[] = [
    {
      id: 'view',
      icon: current === 'list' ? List : Network,
      label: t.view,
      body: (
        <Group label={t.view}>
          <Choice on={current === 'map'} onClick={() => pickView('map')}>
            {t.mapView}
          </Choice>
          <Choice on={current === 'list'} onClick={() => pickView('list')}>
            {t.listView}
          </Choice>
        </Group>
      ),
    },
    {
      id: 'series',
      icon: Library,
      label: t.series,
      lit: !!filters.series || linked.series.size > 0,
      body: (
        <Group label={t.series}>
          {data.series.map((s) => (
            <Choice key={s.title} on={filters.series === s.title} linked={linked.series.has(s.title)} empty={!counts.series.get(s.title)} onClick={() => filterBy('series', s.title)} onPreview={previewFilter('series', s.title)}>
              <span>
                {s.title} <span className="font-normal">({counts.series.get(s.title)})</span>
              </span>
            </Choice>
          ))}
        </Group>
      ),
    },
    {
      id: 'themes',
      icon: Tags,
      label: t.themes,
      lit: !!filters.theme || linked.themes.size > 0,
      body: (
        <Group label={t.themes}>
          {data.themes.map((t) => (
            <Choice key={t.title} on={filters.theme === t.title} linked={linked.themes.has(t.title)} empty={!counts.themes.get(t.title)} onClick={() => filterBy('theme', t.title)} onPreview={previewFilter('theme', t.title)}>
              <TagSwatch color={t.color} />
              <span>
                {t.title} <span className="font-normal">({counts.themes.get(t.title)})</span>
              </span>
            </Choice>
          ))}
        </Group>
      ),
    },
    {
      id: 'structures',
      icon: GitMerge,
      label: t.structures,
      lit: filters.common,
      body: (
        <Group label={t.structures}>
          <Choice on={filters.common} empty={!counts.common} onClick={() => filterBy('common', true)} onPreview={previewFilter('common', true)}>
            <span>
              {t.common} <span className="font-normal">({counts.common})</span>
            </span>
          </Choice>
        </Group>
      ),
    },
    {
      id: 'theses',
      icon: MessageSquareQuote,
      label: t.thesesFolder,
      lit: kindOfShown === 'thesis',
      count: index.thesisCount,
      body: (
        <div>
          {index.theses.map((g) => (
            <div key={g.article.id}>
              <ArticleHeading>{g.article.label}</ArticleHeading>
              <FolderList items={g.items} isOn={(key) => key === shown} onChange={show} onPreview={previewNode} type="index" />
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'mechanisms',
      icon: Cog,
      label: t.mechanismsFolder,
      lit: kindOfShown === 'mechanism',
      count: index.mechanisms.length,
      body: <FolderList items={index.mechanisms} isOn={(key) => key === shown} onChange={show} onPreview={previewNode} type="index" />,
    },
  ];

  return (
    // Le dashboard (2026-10-30, Alexandre) : d'un bord à l'autre de l'écran et,
    // dès 768 px, de la hauteur visible sous la barre de navigation. À droite,
    // la carte s'arrête à la gouttière de la page, fermée par un filet (marge
    // en style inline : le reset `* { margin: 0 }` hors @layer bat l'utility).
    <div
      ref={board}
      className="relative flex flex-col gap-3 md:h-[calc(100dvh-4rem)] md:flex-row md:gap-0 md:border-y md:border-r md:border-[var(--color-line)]"
      style={wide ? { marginRight: 'var(--page-gutter)' } : undefined}
    >
      <MapMenu
        open={menu}
        onOpen={toggleMenu}
        sheet={sheet}
        onSheet={setSheet}
        sections={sections}
        asideRef={aside}
        focus={menuFocus}
        labels={{ menu: t.filters, title: t.menuTitle, collapse: t.menuCollapse, expand: t.menuExpand, settings: t.settings, close: t.close }}
        counts={
          <>
            <p aria-live="polite" className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}>
              {dict.articles(n('article'))} · {t.theses(n('thesis'))} · {t.mechanisms(n('mechanism'))}
            </p>
            {filtered && (
              <button type="button" onClick={() => setFilters(NO_FILTER)} className={cn(MICRO_LABEL, 'w-fit text-[var(--color-fg)] underline underline-offset-4')}>
                {t.showAll}
              </button>
            )}
          </>
        }
        settings={
          current === 'map' ? (
            <div role="group" aria-label={t.labelsNote} className="flex flex-col">
              <p className="text-[12px] leading-[17px] text-[var(--color-fg-muted)]" style={{ paddingBottom: 8 }}>
                {t.labelsNote}
              </p>
              {LABEL_KINDS.map((k) => (
                <ReachRow key={k} label={t.labelKinds[k]} value={labels[k]} text={t.reach(labels[k])} onChange={(v) => reach(k, v)} />
              ))}
            </div>
          ) : null
        }
      />

      <section ref={stage} aria-label="Concept Map" className="min-w-0 md:flex-1" style={{ scrollMarginTop: 16 }}>
        <div className={cn(view === 'auto' ? 'hidden md:block' : current === 'map' ? 'block' : 'hidden', 'md:h-full')}>
          <p className="sr-only">{t.drawingNote}</p>
          <div ref={frame} onPointerLeave={(e) => e.pointerType !== 'touch' && setGrip(false)} className="relative flex flex-col gap-6 md:h-full">
            {/* Le cadre et ce qui se pose dessus : les coins se mesurent au cadre seul,
                pas au panneau qui passe dessous sur téléphone. Dès 768 px, il remplit
                le dashboard ; ses filets sont ceux du dashboard. */}
            <div className="relative h-[clamp(420px,calc(100dvh-12rem),860px)] md:h-full">
              <div aria-hidden className="concept-stage absolute inset-0 overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-bg)] md:border-y-0">
                {current === 'map' && (
                  <Graph
                    ix={ix}
                    visible={visible}
                    selected={shown}
                    fit={fit}
                    preview={preview}
                    inset={beside}
                    sticky
                    labels={labels}
                    nav={nav}
                    gestures={gestures}
                    onSelect={(id) => {
                      select(id, !!id);
                      // Une thèse ou un mécanisme choisi sur la carte se retrouve dans le menu (2026-10-30/31, Alexandre).
                      const kind = id ? ix.byId.get(id)?.kind : null;
                      if (id && kind !== 'article') setMenuFocus({ section: kind === 'thesis' ? 'theses' : 'mechanisms', key: id, at: Date.now() });
                    }}
                  />
                )}
              </div>
              {/* La carte tient la molette : un filet d'encre la cerne, on sait à qui parle le geste. */}
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_var(--color-fg-muted)] transition-opacity duration-200 motion-reduce:transition-none',
                  grip ? 'opacity-100' : 'opacity-0',
                )}
              />
              {/* L'avis d'un geste laissé à la page (la règle des cartes coopératives). */}
              <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ paddingInline: 24 }}>
                <p
                  className={cn(
                    MICRO_LABEL,
                    'max-w-[360px] bg-[var(--color-fg)] text-center text-[var(--color-bg)] transition-opacity motion-reduce:transition-none',
                    refusal.on ? 'opacity-100 duration-150 ease-out' : 'opacity-0 duration-300 ease-in',
                  )}
                  style={{ padding: '10px 14px' }}
                >
                  {refusal.gesture === 'touch' ? t.refusedTouch : t.refusedWheel(mod)}
                </p>
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
                    <span className="hidden md:inline">{grip ? t.zoomHeld : t.zoomWheel}</span>
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
        <div className={cn(view === 'auto' ? 'md:hidden' : current === 'list' ? 'block' : 'hidden', 'md:h-full md:overflow-y-auto')} style={{ padding: '24px var(--page-gutter)' }}>
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
