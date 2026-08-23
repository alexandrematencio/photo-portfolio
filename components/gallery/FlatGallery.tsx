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
          (droite), sur une PLAQUE continue qui englobe aussi la rangée de
          pastilles juste dessous : un seul bloc de commande, pas deux étages
          de boutons flottant sur le papier (arbitrage Alexandre, 2026-08-23).
          Seule cette rangée-ci est `sticky` — les pastilles, jusqu'à une
          vingtaine, mangeraient le viewport si elles collaient avec elle ;
          elles glissent donc sous une plaque de même valeur, sans couture.

          Aucune bordure : c'est l'écart de valeur plaque/papier qui sépare.

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
      <nav
        className="sticky top-0 z-30 flex items-stretch justify-between bg-[var(--color-bg-plate)]"
        style={{ paddingLeft: 32 }}
      >
        <div
          role="tablist"
          aria-label="Grouping mode"
          className="flex min-w-0 flex-wrap items-center justify-start gap-x-10 gap-y-2 md:gap-x-14"
          style={{ paddingTop: 24, paddingBottom: 24, paddingRight: 32 }}
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
                style={{ padding: '2px 6px' }}
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
          style={{ paddingLeft: 32, paddingRight: 32 }}
        >
          {GRID_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => changeGridSize(size)}
              aria-pressed={size === gridSize}
              // Même famille de contrôle que les onglets de gauche, donc même
              // recette exactement (padding partout, surlignage sur l'actif).
              style={{ padding: '2px 6px' }}
              className={cn(
                'text-[12px] font-bold cursor-pointer transition-colors motion-reduce:transition-none',
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

      {/* Filter chips — pill buttons per Pencil "filter-button" spec.
          "All" chip at the start = reset (re-selects everything).
          Per-value chips toggle their group's visibility.
          État coché = châssis orange + voyant allumé, libellé NOIR. La
          pastille garde donc son trait fin là où les onglets prennent un
          fond plein : deux rôles différents (filtre vs mode), deux marques
          différentes — et un fond plein derrière une bordure arrondie
          alourdirait une rangée qui compte jusqu'à vingt éléments.

          Cette rangée est le BAS DE LA PLAQUE ouverte par la nav ci-dessus
          (même fond, aucun écart) : les commandes des Archives forment un seul
          bloc, et la grille de photos démarre ensuite sur du papier propre.
          Avant ça, la rangée flottait entre la barre et la première grille
          sans appartenir à aucune des deux.

          ⚠️ L'état éteint n'a PLUS d'`opacity-50`. Elle s'appliquait au bouton
          entier : le libellé y composait à ~1,9:1 contre la plaque, très en
          dessous des 4,5:1 dus à du texte de 12 px (CLAUDE.md §4). Le retrait
          d'état passe maintenant par les COULEURS — libellé en muted calibré
          pour la plaque, filet en `--color-fg-faint` — donc sans jamais
          délaver le texte. Ne pas réintroduire d'opacité globale ici. */}
      <div
        role="group"
        aria-label={`Filter by ${mode}`}
        className="flex flex-wrap gap-x-3 gap-y-2 bg-[var(--color-bg-plate)]"
        style={{
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 20,
          paddingBottom: 24,
        }}
      >
        {/* All — reset chip */}
        <button
          type="button"
          onClick={selectAll}
          aria-pressed={allSelected}
          style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, gap: 6 }}
          className={cn(
            'inline-flex items-center text-[12px] font-bold tracking-[-0.02em] rounded-full border cursor-pointer transition-colors motion-reduce:transition-none',
            allSelected
              ? 'text-[var(--color-fg)] border-[var(--color-link)]'
              : 'text-[var(--color-fg-muted-plate)] border-[var(--color-fg-faint)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]'
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
              style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, gap: 6 }}
              className={cn(
                'inline-flex items-center text-[12px] font-bold tracking-[-0.02em] rounded-full border cursor-pointer transition-colors motion-reduce:transition-none',
                isSelected
                  ? 'text-[var(--color-fg)] border-[var(--color-link)]'
                  : 'text-[var(--color-fg-muted-plate)] border-[var(--color-fg-faint)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]'
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

      {/* Groups — 64 px between each (per spec).
          Single-select means visibleGroups is never empty (always "All" or one group). */}
      <div
        ref={galleryRef}
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
