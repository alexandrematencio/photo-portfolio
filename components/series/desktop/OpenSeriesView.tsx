import { useLayoutEffect, useRef } from 'react';
import { Undo2 } from 'lucide-react';
import { urlFor } from '@/lib/sanity/image';
import type { PreparedSeries } from '@/lib/site/series';
import { cn } from '@/lib/utils/cn';
import { SeriesMeta } from '../shared/SeriesMeta';
import { centerSrcFor } from '../shared/photoSrc';
import { useMdUp } from '../shared/useMdUp';
import { colLeadReserve } from '../shared/colLead';
import { StateDot } from '@/components/site/StateDot';

/**
 * État ouvert desktop (spec §5) : trois zones —
 *   gauche  : noms des séries (navigation directe, sans repasser par la rangée)
 *   centre  : image affichée + « Back to All Series » au coin haut-gauche + métadonnées
 *             collées en bas à droite de l'image
 *   droite  : colonne de vignettes, défilement natif à la molette
 *
 * Chrome ancré à l'IMAGE, pas au conteneur (règle §3.4 du CLAUDE.md) : le
 * wrapper `w-fit` épouse l'image, le bouton retour et Meta se positionnent contre lui.
 *
 * Les attributs data-* sont les points de mesure des vols (animations.ts).
 */

/**
 * Le chrome ancré à l'image — le retour au-dessus, métadonnées en dessous —
 * est en `absolute`, donc HORS FLUX : la place qu'on ne lui réserve pas, il la
 * prend sous le footer, sans un mot (bug réel : les métadonnées se sont
 * retrouvées coupées le jour où la scène a perdu 30 px pour laisser voir le
 * footer). On la lui réserve donc explicitement, en padding sur la cellule.
 */
const CHROME_TOP = 32; // ligne « Back to All Series » + son marginBottom de 12
const CHROME_BOTTOM = 84; // bloc SeriesMeta : jusqu'à 4 lignes + marginTop 12

/**
 * Hauteur max de l'image centrale = hauteur de scène (`100dvh − 160`, cf.
 * DesktopSeries) − paddingTop de la vue ouverte (24) − le chrome ci-dessus.
 * Les trois valeurs doivent bouger ensemble.
 */
const CENTER_MAX_H = 'calc(100dvh - 300px)';

export function OpenSeriesView({
  allSeries,
  displayed,
  activeIndex,
  onClose,
  onSwitch,
  onSelect,
}: {
  allSeries: PreparedSeries[];
  displayed: PreparedSeries;
  activeIndex: number;
  onClose: () => void;
  onSwitch: (slug: string) => void;
  onSelect: (index: number) => void;
}) {
  const mdUp = useMdUp();
  const colRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const active = displayed.photos[activeIndex] ?? displayed.photos[0];
  // Source unique de l'URL 1600 px (partagée avec le préchargement et
  // l'affinage des clones — voir photoSrc.ts).
  const centerSrc = centerSrcFor(active);
  const activeRatio = active.image?.dimensions?.aspectRatio ?? 4 / 3;

  // Hauteur de la queue vide = réserve sous la ligne de pose. Remesurée à
  // chaque série (les ratios changent) et à chaque redimensionnement de la
  // colonne. En effet de LAYOUT : la course de défilement doit être bonne
  // avant que `settleColScroll` ne pose la colonne pour les vols.
  useLayoutEffect(() => {
    const col = colRef.current;
    const tail = tailRef.current;
    if (!col || !tail) return;
    const apply = () => {
      const px = `${Math.round(colLeadReserve(col))}px`;
      if (tail.style.height !== px) tail.style.height = px;
    };
    apply();
    // La queue ne change que la hauteur DÉFILANTE, jamais la boîte de la
    // colonne (hauteur imposée par la grille) : pas de boucle d'observation.
    const ro = new ResizeObserver(apply);
    ro.observe(col);
    return () => ro.disconnect();
  }, [displayed.slug, displayed.photos.length]);

  return (
    <div
      className="grid h-full gap-8"
      style={{ gridTemplateColumns: '176px 1fr 132px' }}
    >
      {/* ── Noms des séries ─────────────────────────────────────────────── */}
      {/* Espacements fins en inline — le reset global hors @layer neutralise
          les utilitaires Tailwind de padding/margin (cf. MobileSeries). */}
      <nav
        aria-label="Series"
        data-open-left
        className="flex flex-col justify-end gap-3"
        style={{ paddingBottom: 8 }}
      >
        {allSeries.map((s) => {
          const isActive = s.slug === displayed.slug;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => (isActive ? undefined : onSwitch(s.slug))}
              aria-current={isActive || undefined}
              // L'état actif se lit sur DEUX canaux, pas un.
              //
              // Le contraste d'abord (pas de soulignement) : encre pleine
              // 18,8:1 contre gris 5,06:1 — l'écart de valeur suffit à lire
              // l'actif, et l'inactif passe WCAG AA. (Avant : gris à 60 %
              // d'opacité = 2,37:1, sous le minimum.)
              //
              // Le voyant ensuite (2026-08-23, demande Alexandre) : dans une
              // colonne de noms tous en 12 px capitales grasses, un simple
              // écart de gris se remarque mal — il faut comparer deux libellés
              // pour savoir lequel est allumé. Le point, lui, se voit sans
              // comparaison. Il vaut aussi pour l'a11y : la série active se
              // repère alors à une FORME, pas seulement à une valeur de gris
              // (WCAG 2.2 §1.4.1).
              //
              // `gap` en inline plutôt qu'en `gap-*` : ce composant pose déjà
              // tous ses espacements fins ainsi (le reset global hors @layer
              // avale les utilities de padding/margin) — on ne mélange pas les
              // deux conventions dans un même bloc.
              style={{ gap: 6 }}
              className={cn(
                'inline-flex w-fit items-start text-left text-[12px] uppercase font-bold leading-[1.45] transition-colors motion-reduce:transition-none',
                isActive
                  ? 'text-[var(--color-fg)] cursor-default'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] cursor-pointer'
              )}
            >
              {/* Le point est centré sur la PREMIÈRE LIGNE, pas sur le bloc.
                  La colonne fait 176 px et le plus long titre en base (« Beach
                  girls triptych », 20 caractères) la remplit déjà presque
                  entièrement : les 13 px pris par le point et son écart
                  suffisent à le faire passer sur deux lignes. Avec un
                  `items-center` sur le bouton, le point atterrirait alors
                  ENTRE les deux lignes. La boîte d'une hauteur de ligne
                  (`1.45em`, la même valeur que le `leading` du bouton) le
                  cale sur la première quoi qu'il arrive. */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '1.45em',
                  flex: 'none',
                }}
              >
                <StateDot on={isActive} />
              </span>
              {s.title}
            </button>
          );
        })}
      </nav>

      {/* ── Image centrale ──────────────────────────────────────────────── */}
      <div
        className="relative flex min-w-0 flex-col"
        style={{ paddingTop: CHROME_TOP, paddingBottom: CHROME_BOTTOM }}
      >
        {/* `data-open-center` sur la boîte de CONTENU (padding exclu) : c'est le
            rect que runSwap utilise pour prédire la position de l'image
            entrante. Le poser sur la cellule paddée décalerait la prédiction de
            la moitié de l'asymétrie du chrome — soit un saut visible au
            raccord clone → réel. */}
        <div
          data-open-center
          className="flex min-h-0 flex-1 items-center justify-center"
        >
        <div data-center-wrap className="relative w-fit max-w-full">
          <button
            type="button"
            onClick={onClose}
            data-open-close
            className="absolute left-0 bottom-full flex items-center cursor-pointer text-[11px] uppercase font-bold text-[var(--color-fg)] hover:opacity-60 transition-opacity motion-reduce:transition-none"
            style={{ marginBottom: 12, gap: 8 }}
          >
            {/* Demi-tour et non la flèche simple « ← » (demande Alexandre,
                2026-08-23) : une flèche gauche dit « à gauche », le u-turn dit
                « on revient d'où l'on vient » — c'est le second sens qui est
                juste ici. `aria-hidden` : le libellé porte déjà tout le message
                pour un lecteur d'écran. */}
            <Undo2 size={14} strokeWidth={2} aria-hidden />
            Back to All Series
          </button>

          {/* aspect-ratio + width calculée : le layout est complet AVANT le
              chargement du fichier — les vols mesurent des rects justes même
              sur image froide (bug réel : rects nuls → aucun fantôme). */}
          {/* `lazy` quand la branche est cachée (viewport mobile) : cette vue
              est quand même rendue à l'ouverture, et une <img> eager en
              display:none télécharge son fichier — 1600 px pour rien, sur
              cellulaire (cf. useMdUp). Lazy sans boîte = jamais chargée. */}
          <img
            src={centerSrc}
            alt={active.image?.alt ?? active.title}
            loading={mdUp ? 'eager' : 'lazy'}
            decoding="async"
            data-center-img
            className="block max-w-full object-contain"
            style={{
              aspectRatio: String(activeRatio),
              width: `min(100%, calc(${CENTER_MAX_H} * ${activeRatio}))`,
              maxHeight: CENTER_MAX_H,
            }}
          />

          {/* Spec §5 : collé en bas à droite de l'image, même écart que la
              légende de la démo — PAS de légende centrée. */}
          <SeriesMeta
            photo={active}
            className="absolute right-0 top-full"
            style={{ marginTop: 12 }}
          />
        </div>
        </div>
      </div>

      {/* ── Colonne de vignettes ────────────────────────────────────────── */}
      <div
        ref={colRef}
        data-open-col
        className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain"
        style={{ paddingRight: 4 }}
      >
        {displayed.photos.map((photo, i) => {
          const src = photo.image
            ? (urlFor(photo.image)?.width(280).quality(75).auto('format').url() ?? '')
            : '';
          const isActive = i === activeIndex;
          return (
            <button
              key={photo._id}
              type="button"
              onClick={() => onSelect(i)}
              data-col-item={i}
              aria-current={isActive || undefined}
              aria-label={`Show “${photo.title}”`}
              className={cn(
                'relative w-full shrink-0 transition-opacity motion-reduce:transition-none',
                isActive
                  ? 'opacity-40 cursor-default'
                  : 'cursor-pointer hover:opacity-80'
              )}
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                data-col-img={i}
                className="block w-full"
                style={{
                  aspectRatio: String(
                    photo.image?.dimensions?.aspectRatio ?? 4 / 3
                  ),
                }}
              />
            </button>
          );
        })}
        {/* Queue vide : la course de défilement qui manque pour que la
            DERNIÈRE vignette puisse elle aussi se poser sur la ligne de pose,
            au lieu de rester collée au bord bas. C'est ce vide qui remonte en
            fin de série et annonce la sortie. Hauteur mesurée (colLead.ts) —
            un vrai élément et non un `padding-bottom` : la fin de padding
            d'un conteneur flex défilant n'est pas comptée dans la course de
            défilement par tous les moteurs, un enfant l'est toujours. */}
        <div ref={tailRef} aria-hidden className="shrink-0" />
      </div>
    </div>
  );
}
