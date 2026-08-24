'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { PhotoCard } from './PhotoCard';
import { PhotoLightbox } from './PhotoLightbox';
import { cn } from '@/lib/utils/cn';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import type { Photo } from '@/lib/sanity/queries';
import { StateDot, StateDotBalance } from '@/components/site/StateDot';
import { CONTROL_RADIUS } from '@/lib/site/controls';
import { ListSelector } from '@/components/site/ListSelector';
import { MICRO_LABEL, PAGE_CONTROLS_GAP } from '@/lib/site/typography';

gsap.registerPlugin(Flip);

type Mode = 'year' | 'location' | 'style' | 'camera' | 'lens';

/** Paliers de densité de la démo Codrops — le nombre de colonnes par palier
    vit dans globals.css (.grid-gallery[data-size-grid]).

    Le palier 150 % de la démo a été retiré le 2026-08-23 : 4 colonnes de
    ~446 px, ce n'est plus une planche-contact mais un diaporama — or regarder
    une photo en grand, c'est le travail de la lightbox. C'était accessoirement
    le seul palier où la loupe de survol (×1,15) dépassait la résolution de la
    source servie (800 px) : 446 px de carte × 2 (DPR) × 1,15 = 1026 px demandés.
    Le palier restant, 125 %, tient (289 × 2 × 1,15 = 665 px). Toucher à cette
    liste, ou remonter l'échelle de la loupe, = refaire ce calcul. */
const GRID_SIZES = ['50%', '75%', '100%', '125%'] as const;
type GridSize = (typeof GRID_SIZES)[number];

const TABS: { id: Mode; label: string }[] = [
  { id: 'year', label: 'Year' },
  { id: 'location', label: 'Location' },
  { id: 'style', label: 'Style' },
  { id: 'camera', label: 'Camera' },
  { id: 'lens', label: 'Lens' },
];

const UNSPECIFIED_KEY = '__unspecified__';

/** Clé de l'option « All » DANS LE SÉLECTEUR MOBILE. L'état, lui, reste
    `activeKey === null` — une liste déroulante n'a pas d'option « rien de
    sélectionné », il lui faut donc une clé ; l'état du composant n'en change
    pas pour autant (cf. `activeKey`). */
const ALL_KEY = '__all__';

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
  // Densité de la grille (boutons 50→125 %). 75 % = défaut de la démo.
  const [gridSize, setGridSize] = useState<GridSize>('75%');
  const reducedMotion = useReducedMotion();
  // Conteneur des groupes : cible du filtre blur/brightness pendant le Flip,
  // et racine de la requête des items à animer.
  const galleryRef = useRef<HTMLDivElement | null>(null);
  // Verrou d'animation de la démo (`animated`) — un ref, pas un state : sa
  // valeur ne doit pas déclencher de re-render.
  const gridAnimatingRef = useRef(false);
  // Console mobile : le module SHOW court d'un bord à l'autre une fois collé
  // en haut, et reprend la gouttière de la page quand il redescend.
  const [stuck, setStuck] = useState(false);
  const stickSentinelRef = useRef<HTMLDivElement | null>(null);

  /** Changement de densité — transition recopiée de la démo 2 Codrops
      (script2.js) : Flip absolute 1 s expo.inOut, stagger random 0,3 s, et
      aller-retour blur(10px)/brightness(200%) sur tout le conteneur. */
  function changeGridSize(target: GridSize) {
    if (target === gridSize) return;
    const gallery = galleryRef.current;
    if (reducedMotion || !gallery) {
      setGridSize(target);
      return;
    }
    if (gridAnimatingRef.current) return;
    gridAnimatingRef.current = true;

    const items = gallery.querySelectorAll('.grid-gallery-item');
    const state = Flip.getState(items);
    // Le nouveau layout doit être dans le DOM avant Flip.from — d'où flushSync.
    flushSync(() => setGridSize(target));

    // Écart avec la démo, rendu nécessaire par nos groupes : quand Flip passe
    // les items en `absolute`, chaque grille se vide et s'effondre — les titres
    // des groupes suivants remontaient par-dessus les photos le temps du vol
    // (vu à la capture). La démo n'a qu'une grille et rien dessous, l'effondrement
    // y est invisible. On fige donc chaque grille à sa hauteur du layout
    // d'ARRIVÉE (mesurée ici, après flushSync et avant l'absolute), puis on
    // rend la main au CSS une fois les items revenus dans le flux.
    const grids = Array.from(
      gallery.querySelectorAll<HTMLElement>('.grid-gallery')
    );
    for (const grid of grids) {
      grid.style.height = `${grid.offsetHeight}px`;
    }
    const releaseGrids = () => {
      for (const grid of grids) grid.style.removeProperty('height');
    };

    const flipDuration = 1;
    const staggerAmount = 0.3;
    const totalFlipDuration = flipDuration + staggerAmount;

    Flip.from(state, {
      absolute: true,
      duration: flipDuration,
      ease: 'expo.inOut',
      onComplete: () => {
        releaseGrids();
        gridAnimatingRef.current = false;
      },
      stagger: {
        amount: staggerAmount,
        from: 'random',
      },
    }).fromTo(
      gallery,
      {
        filter: 'blur(0px) brightness(100%)',
        willChange: 'filter',
      },
      {
        duration: totalFlipDuration,
        keyframes: [
          {
            filter: 'blur(10px) brightness(200%)',
            duration: totalFlipDuration * 0.5,
            ease: 'power2.in',
          },
          {
            filter: 'blur(0px) brightness(100%)',
            duration: totalFlipDuration * 0.5,
            ease: 'power2',
            delay: 0.5,
          },
        ],
      },
      0
    );
  }

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

  /** COLLAGE DU MODULE SHOW (console mobile) — détecté par un sentinelle, pas
      en écoutant le scroll : un `scroll` sur le conteneur se rejouerait à
      chaque frame du défilement pour lire une position que le navigateur
      connaît déjà. L'IntersectionObserver ne réveille React qu'aux DEUX
      bascules qui comptent.

      ⚠️ Le sentinelle fait 1 px de haut, compensé par une marge négative.
      Un rect de hauteur NULLE n'intersecte jamais rien : l'observer le
      déclarerait hors champ en permanence et le module partirait collé, dès
      le chargement, sans avoir jamais défilé. Le 1 px lui donne une boîte,
      la marge négative le rend invisible au layout — et il le faut : posé
      entre les deux modules, un seul pixel de flux fendrait la colonne
      sombre qu'ils forment ensemble.

      ⚠️ La racine est le conteneur de scroll de `FramedScroll`, pas le
      viewport : sur les pages du groupe `(site)`, ce n'est pas la fenêtre
      qui défile. */
  useEffect(() => {
    const el = stickSentinelRef.current;
    if (!el) return;
    const root = document.querySelector('[data-scroll-container]');
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { root: root ?? null, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
      {/* CONSOLE DE CONTRÔLE — rangée d'axes (gauche) + module de densité
          (droite), sur une PLAQUE qui ne porte QUE cette rangée-ci : les
          pastilles de filtre restent sur le papier, en dessous (arbitrage
          Alexandre, 2026-08-23, sur la capture de référence). Une plaque
          continue sur les deux rangées avait été essayée puis écartée : elle
          mettait deux commandes de rôles différents sur la même valeur, et le
          bloc perdait la marche qui le distingue du papier.

          Trois valeurs empilées, donc, et pas une de plus : papier, plaque,
          module sombre. Aucune bordure — c'est l'écart de valeur qui sépare.

          Cette rangée N'EST PLUS `sticky` (demande Alexandre, 2026-08-23) :
          au défilement, c'est la rangée de pastilles en dessous qui reste
          accrochée en haut, et celle-ci part avec le papier. Le choix d'axe
          se fait une fois ; le filtre, lui, se reprend sans arrêt pendant
          qu'on parcourt la grille — c'est LUI qui doit rester sous la main.
          Corollaire : une seule des deux rangées peut coller — même
          arbitrage dans la console mobile ci-dessus (seul le module SHOW
          est `sticky`).

          ⚠️ Le padding vertical est porté par les DEUX enfants, pas par la
          nav : le module sombre doit occuper toute la hauteur de la rangée
          (`items-stretch`) et venir à fond perdu contre le bord droit. Le
          remonter sur la nav le réduirait à une étiquette flottante.

          ⚠️ La nav ne WRAP PAS, c'est la rangée d'axes qui wrappe en interne
          (`flex-wrap` + `min-w-0`). Laisser wrapper la nav renvoyait le module
          sombre à la ligne : il y perdait son fond perdu ET sa pleine hauteur,
          et devenait une barre noire flottant au milieu de la plaque (vu au
          rendu à 800 px). En wrappant à l'intérieur, la rangée d'axes prend
          deux lignes et le module s'étire d'autant — ce qu'`items-stretch`
          fait tout seul.

          Sous 768px la grille est verrouillée à 3 colonnes (CSS), les boutons
          de densité y sont sans effet — comme dans la démo Codrops. */}
      {/* CONSOLE MOBILE — deux modules `ListSelector` empilés SANS gap, CADRÉS
          sur la gouttière de 32 px de la page (demande Alexandre du
          2026-08-23) : le bloc s'aligne sur le H1 au-dessus et sur la grille
          en dessous, au lieu de courir d'un bord à l'autre. Leurs
          cellules-étiquettes sombres forment une colonne continue sur le bord
          gauche du bloc — anatomie complète dans ListSelector.tsx.

          ⚠️ La gouttière est portée par CES wrappers, pas par le module : le
          module est un boîtier, il n'a pas à savoir sur quelle page il est
          posé. Corollaire pour le wrapper `sticky` — son fond reste
          TRANSPARENT et c'est le module qui porte le sien. Un fond posé sur
          toute la largeur du wrapper rendrait la barre pleine largeur qu'on
          vient justement de retirer.

          Le module SHOW est le seul `sticky` : même arbitrage qu'en desktop
          (le filtre se reprend sans arrêt en parcourant la grille, l'axe se
          choisit une fois), et une seule rangée collée pour ne pas empiler
          deux ponts sur l'écran d'un téléphone. */}
      <div
        className="md:hidden"
        style={{ paddingInline: 'var(--page-gutter)' }}
      >
        <ListSelector
          hint="GROUP BY"
          ariaLabel="Grouping mode"
          tone="plate"
          mark="fill"
          corners="top"
          items={TABS.map((t) => ({ key: t.id, label: t.label }))}
          value={mode}
          onChange={(key) => setMode(key as Mode)}
        />
      </div>
      {/* Sentinelle de collage — cf. l'effet plus haut. */}
      <div
        ref={stickSentinelRef}
        aria-hidden
        className="md:hidden"
        style={{ height: 1, marginBottom: -1 }}
      />
      <div
        className={cn(
          'md:hidden sticky top-0 z-30',
          'transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
        )}
        // COLLÉ = FOND PERDU (demande Alexandre, 2026-08-23). La gouttière de
        // la page se referme sur les deux bords, et la transition va dans les
        // DEUX sens — c'est le même `transition-[padding]` qui joue au collage
        // et au décollage, sans code de sens.
        //
        // ⚠️ La gouttière est animée ICI, sur le wrapper, et jamais sur le
        // module : c'est le padding du parent qui bouge, le module se contente
        // de suivre en largeur fluide. L'animer dans le module l'obligerait à
        // savoir sur quelle page il est posé — et il n'a aucun moyen de le
        // savoir.
        // La gouttière vient du token de page (20 sur téléphone, 32 au-dessus
        // de `md`) : c'est la MÊME mesure que le titre et la grille, elle ne
        // se recopie pas en nombre. Un `var()` en style inline reste
        // responsive — c'est la variable qui bascule, pas le style.
        style={{
          paddingLeft: stuck ? 0 : 'var(--page-gutter)',
          paddingRight: stuck ? 0 : 'var(--page-gutter)',
        }}
      >
        <ListSelector
          hint="SHOW"
          ariaLabel={`Filter by ${mode}`}
          tone="plate-low"
          mark="dot"
          corners="bottom"
          flush={stuck}
          lit={activeKey !== null}
          items={[
            { key: ALL_KEY, label: 'All', count: totalPhotos },
            ...allGroups.map((g) => ({
              key: g.key,
              label: g.label,
              count: g.items.length,
            })),
          ]}
          value={activeKey ?? ALL_KEY}
          onChange={(key) => (key === ALL_KEY ? selectAll() : setActiveKey(key))}
        />
      </div>

      {/* Gouttières de la console : le TOKEN de page, jamais 32 en dur — la
          branche est desktop-only (`md:`), le token y vaut la gouttière `md`
          et la suivra si elle bouge (globals.css, « ne jamais recopier 20, 32
          ou 96 dans un composant »). */}
      <nav
        className="hidden md:flex items-stretch justify-between bg-[var(--color-bg-plate)]"
        style={{ paddingLeft: 'var(--page-gutter)' }}
      >
        <div
          role="tablist"
          aria-label="Grouping mode"
          className="flex min-w-0 flex-wrap items-center justify-start gap-y-2"
          style={{
            paddingTop: 20,
            paddingBottom: 20,
            paddingRight: 'var(--page-gutter)',
          }}
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
                // Padding sur TOUS les onglets, surlignage sur le seul actif.
                // Ici la sélection se fait EN PLACE : ne padder que l'actif
                // décalerait la rangée de 12 px à chaque clic, sous les yeux
                // de l'utilisateur. (La nav-bar fait l'inverse, et pour une
                // raison qui ne vaut que là-bas — cf. SiteHeader.tsx.)
                // Style inline obligatoire : le reset `* { padding: 0 }` de
                // globals.css vit hors @layer et avale les utilities Tailwind
                // de padding (cf. CLAUDE.md §7.6) — c'est d'ailleurs pour ça
                // que le `py-2` qui était ici n'avait jamais rien fait.
                // Le RAYON vient de la constante partagée : le même fond
                // plein disait « c'est celui-là » avec trois géométries
                // différentes sur le site (rectangle vif ici, rayon 1 dans la
                // nav-bar, disque sur le module sombre). Cf. lib/site/controls.
                style={{ padding: '6px 24px', borderRadius: CONTROL_RADIUS }}
                className={cn(
                  'text-[12px] uppercase font-bold cursor-pointer transition-colors motion-reduce:transition-none',
                  active
                    ? 'text-[var(--color-fg)] bg-[var(--color-active-bg)]'
                    : 'text-[var(--color-fg-muted-plate)] hover:text-[var(--color-fg)]'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* MODULE SOMBRE — la densité de grille est le seul réglage de cette
            console qui change ce qu'on VOIT ; elle sort donc du plan de la
            plaque au lieu de se confondre avec le choix d'axe (demande
            Alexandre, 2026-08-23). Fond perdu à droite, pleine hauteur de
            rangée : c'est un module encastré, pas une étiquette posée.

            Même voix typographique que les onglets de gauche (12 px bold,
            padding sur TOUS les boutons, surlignage sur le seul actif) — la
            surface change, la grammaire d'état non. Le châssis orange tient
            4,70:1 contre le fond sombre et porte du noir à 7,26:1.

            Masqué sous md, où la grille est verrouillée à 3 colonnes et où
            ces boutons n'auraient aucun effet. */}
        <div
          role="group"
          aria-label="Grid display size"
          className="hidden md:flex items-center gap-6 bg-[var(--color-bg-plate-dark)]"
          style={{
            paddingLeft: 'var(--page-gutter)',
            paddingRight: 'var(--page-gutter)',
          }}
        >
          {GRID_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => changeGridSize(size)}
              aria-pressed={size === gridSize}
              // PASTILLE RONDE, là où les onglets de gauche prennent un
              // rectangle (demande Alexandre, 2026-08-23) : le châssis épouse
              // ici la forme d'un bouton de matériel, pas d'un surlignage de
              // texte. Le padding vertical (10) dépasse l'horizontal (7) parce
              // que le libellé est plus large que haut — c'est lui qui rend la
              // boîte à peu près carrée, donc le rayon plein à peu près rond.
              //
              // La recette d'état, elle, ne change pas : padding sur TOUS les
              // boutons, seul le fond bascule. Ne le poser que sur l'actif
              // décalerait la rangée à chaque clic (CLAUDE.md §7.7).
              // DISQUE, pas un padding : les quatre libellés n'ont pas la
              // même largeur (« 50% » mesure 27,5 px, « 125% » 33,5 px). Au
              // seul padding — 10/7, la proportion trouvée par Alexandre sur
              // « 75% » — cette pastille-là sortait ronde (42,5 × 34) et
              // celle de 125 % franchement ovale (47,5 × 34) : la marque
              // changeait de forme selon le palier. Une boîte carrée fixe,
              // dimensionnée sur le libellé le plus large, tient la même
              // proportion pour les quatre.
              //
              // 44 px vient de là : 33,5 px de libellé + ~5 px de part et
              // d'autre. Ajouter un palier plus large (« 200% ») = remesurer,
              // sinon le texte touche le bord du disque.
              //
              // `nowrap` : dans une boîte de largeur fixe, un libellé au
              // chouïa trop large se couperait en deux lignes au lieu de
              // déborder — un défaut bien plus difficile à voir venir.
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                whiteSpace: 'nowrap',
              }}
              className={cn(
                'inline-flex items-center justify-center text-[12px] font-bold tabular-nums cursor-pointer transition-colors motion-reduce:transition-none',
                size === gridSize
                  ? 'text-[var(--color-fg)] bg-[var(--color-active-bg)]'
                  : 'text-[var(--color-fg-muted-dark)] hover:text-[var(--color-bg)]'
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </nav>

      {/* Filter chips — "All" chip at the start = reset (re-selects everything).
          Per-value chips toggle their group's visibility.
          État coché = châssis orange + voyant allumé, libellé NOIR. La
          pastille garde donc son trait fin là où les onglets prennent un
          fond plein : deux rôles différents (filtre vs mode), deux marques
          différentes — et un fond plein derrière vingt éléments alourdirait
          la rangée.

          ⚠️ CAPSULE ABANDONNÉE (2026-08-23). Le `rounded-full` venait du
          mockup Pencil `filter-button`, dessiné AVANT le virage Teenage
          Engineering de la console. Il restait le seul de son espèce : une
          seule rangée mettait côte à côte un rectangle vif (onglets), une
          capsule à filet (ici) et un disque (densité), soit trois géométries
          pour deux plans. Les pastilles prennent donc le rayon commun des
          commandes posées sur une surface claire — un panneau de matériel
          n'a pas de capsules, il a des touches. Le disque du module sombre
          reste, lui, l'exception assumée (cf. lib/site/controls.ts).

          Cette rangée est le DEUXIÈME PONT de la console, d'une valeur à
          elle — et c'est ELLE qui est `sticky` (cf. la rangée d'axes plus
          haut). Son fond doit donc rester OPAQUE : elle passe par-dessus la
          grille au défilement.

          Sa valeur propre dit la raison d'être de la marche : mettre deux
          commandes de rôles différents — choisir l'axe, filtrer dedans — sur
          un seul plan l'effaçait. Le papier, lui, ne revient qu'à la grille.

          ⚠️ L'état éteint n'a PLUS d'`opacity-50`. Elle s'appliquait au bouton
          entier : le libellé y composait à ~1,9:1 contre le fond, très en
          dessous des 4,5:1 dus à du texte de 12 px (CLAUDE.md §4). Le retrait
          d'état passe maintenant par les COULEURS — libellé et filet
          calibrés pour le pont bas (4,90:1 et 2,34:1) — donc sans
          délaver le texte. Ne pas réintroduire d'opacité globale ici. */}
      <div
        className="hidden md:block sticky top-0 z-30 bg-[var(--color-bg-plate-low)]"
        style={{
          paddingLeft: 'var(--page-gutter)',
          paddingRight: 'var(--page-gutter)',
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <div
          role="group"
          aria-label={`Filter by ${mode}`}
          className="flex flex-wrap gap-x-1 gap-y-2"
        >
          {/* All — reset chip */}
          <button
            type="button"
            onClick={selectAll}
            aria-pressed={allSelected}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              gap: 6,
              borderRadius: CONTROL_RADIUS,
            }}
            className={cn(
              'inline-flex items-center text-[12px] font-bold tracking-[-0.02em] tabular-nums border cursor-pointer transition-colors motion-reduce:transition-none',
              allSelected
                ? 'text-[var(--color-fg)] border-[var(--color-link)]'
                : 'text-[var(--color-fg-muted-plate-low)] border-[var(--color-line-plate-low)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]',
            )}
          >
            <StateDot on={allSelected} />
            All ({totalPhotos})
            {/* Contrepoids du voyant — sans lui, les 13 px pris à gauche par le
              point et son écart n'ont aucun équivalent à droite : le compteur
              se retrouve collé à la bordure alors que le libellé, lui, tombe
              au centre. Cf. StateDotBalance. */}
            <StateDotBalance />
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
                style={{
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  gap: 6,
                  borderRadius: CONTROL_RADIUS,
                }}
                className={cn(
                  'inline-flex items-center text-[12px] font-bold tracking-[-0.02em] tabular-nums border cursor-pointer transition-colors motion-reduce:transition-none',
                  isSelected
                    ? 'text-[var(--color-fg)] border-[var(--color-link)]'
                    : 'text-[var(--color-fg-muted-plate-low)] border-[var(--color-line-plate-low)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]',
                )}
              >
                <StateDot on={isSelected} />
                {g.label} ({g.items.length})
                {/* Contrepoids du voyant — cf. la pastille « All » ci-dessus. */}
                <StateDotBalance />
              </button>
            );
          })}
        </div>
      </div>

      {/* Groups — 64 px between each (per spec).
          Single-select means visibleGroups is never empty (always "All" or one group). */}
      {/* ⚠️ `paddingTop` = MOITIÉ BASSE du contrat de bande de commandes.
          L'écart qui sépare la console de la première grille est le même que
          celui qui la sépare du titre (`PageShell` en `controlBand`) — c'est
          ce qui la pose ENTRE les deux au lieu de l'accrocher à la galerie.
          Il était à 40 face à 96 : ne pas le redescendre d'un côté seul. */}
      <div
        ref={galleryRef}
        className="flex flex-col gap-16"
        style={{
          paddingInline: 'var(--page-gutter)',
          paddingTop: PAGE_CONTROLS_GAP,
        }}
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
                className={`${MICRO_LABEL} text-[var(--color-fg-muted)]`}
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
                Grille de la démo Codrops (globals.css .grid-gallery) : le
                nombre de colonnes est piloté par data-size-grid, commun à tous
                les groupes — un seul état, une seule rangée de boutons.
              */}
              <div className="grid-gallery" data-size-grid={gridSize}>
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
