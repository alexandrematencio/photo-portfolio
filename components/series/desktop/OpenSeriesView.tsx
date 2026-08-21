import { urlFor } from '@/lib/sanity/image';
import type { PreparedSeries } from '@/lib/site/series';
import { cn } from '@/lib/utils/cn';
import { SeriesMeta } from '../shared/SeriesMeta';
import { centerSrcFor } from '../shared/photoSrc';
import { useMdUp } from '../shared/useMdUp';

/**
 * État ouvert desktop (spec §5) : trois zones —
 *   gauche  : noms des séries (navigation directe, sans repasser par la rangée)
 *   centre  : image affichée + « Close » au coin haut-gauche + métadonnées
 *             collées en bas à droite de l'image
 *   droite  : colonne de vignettes, défilement natif à la molette
 *
 * Chrome ancré à l'IMAGE, pas au conteneur (règle §3.4 du CLAUDE.md) : le
 * wrapper `w-fit` épouse l'image, Close et Meta se positionnent contre lui.
 *
 * Les attributs data-* sont les points de mesure des vols (animations.ts).
 */

/**
 * Le chrome ancré à l'image — « ✕ Close » au-dessus, métadonnées en dessous —
 * est en `absolute`, donc HORS FLUX : la place qu'on ne lui réserve pas, il la
 * prend sous le footer, sans un mot (bug réel : les métadonnées se sont
 * retrouvées coupées le jour où la scène a perdu 30 px pour laisser voir le
 * footer). On la lui réserve donc explicitement, en padding sur la cellule.
 */
const CHROME_TOP = 32; // ligne « ✕ Close » + son marginBottom de 12
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
  const active = displayed.photos[activeIndex] ?? displayed.photos[0];
  // Source unique de l'URL 1600 px (partagée avec le préchargement et
  // l'affinage des clones — voir photoSrc.ts).
  const centerSrc = centerSrcFor(active);
  const activeRatio = active.image?.dimensions?.aspectRatio ?? 4 / 3;

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
              // État actif porté par le seul CONTRASTE (pas de soulignement) :
              // encre pleine 18,8:1 contre gris 5,06:1 — l'écart de valeur
              // suffit à lire l'actif, et l'inactif passe enfin WCAG AA.
              // (Avant : gris à 60 % d'opacité = 2,37:1, sous le minimum.)
              className={cn(
                'w-fit text-left text-[12px] uppercase font-bold leading-[1.45] transition-colors motion-reduce:transition-none',
                isActive
                  ? 'text-[var(--color-fg)] cursor-default'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] cursor-pointer'
              )}
            >
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
            className="absolute left-0 bottom-full cursor-pointer text-[11px] uppercase font-bold text-[var(--color-fg)] hover:opacity-60 transition-opacity motion-reduce:transition-none"
            style={{ marginBottom: 12 }}
          >
            ✕ Close
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
      </div>
    </div>
  );
}
