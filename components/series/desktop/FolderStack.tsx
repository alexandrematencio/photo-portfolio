import { urlFor } from '@/lib/sanity/image';
import type { PreparedSeries } from '@/lib/site/series';

/**
 * Une série à l'état fermé : deux lignes de libellé (« ↗ Open » puis le titre
 * de la série) au-dessus de la pile de vignettes. La cover est cliquable au
 * même titre que le bouton (spec §5).
 *
 * Chaque photo de la série a un élément dans la pile (`data-pile-item`) :
 * ce sont les rects SOURCE des vols d'ouverture. Les sous-images restent donc
 * montées MÊME quand l'épaisseur est désactivée — chaque vol a besoin de SA
 * source (le fantôme copie la src de l'élément) ; les retirer réduirait
 * l'ouverture au seul vol de la cover.
 */

const PILE_HEIGHT = 176;

/**
 * Épaisseur « pile un peu désordonnée » : les sous-images dépassent en biais
 * derrière la cover. DÉSACTIVÉE — la page /series veut du propre, cover seule
 * visible. Repasser à `true` restaure l'effet à l'identique (les décalages
 * sont déterministes, pas de Math.random : le rendu serveur et le rendu client
 * doivent coïncider). Rationale et variantes :
 * docs/superpowers/specs/2026-08-20-series-page-design.md §10.
 */
const PILE_DISORDER = false;

export function FolderStack({
  series,
  onOpen,
  disabled,
}: {
  series: PreparedSeries;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const ratio = series.cover.image?.dimensions?.aspectRatio ?? 4 / 3;
  const width = Math.round(PILE_HEIGHT * Math.min(Math.max(ratio, 0.7), 1.7));

  // Ordre visuel : cover au sommet, puis les autres photos dans l'ordre.
  // PLAFONNÉE à 5 : au-delà, les images n'apportent qu'un bord de 2 px à
  // l'épaisseur mais pèsent au chargement de la page (11 séries × N photos).
  // Les photos sans élément de pile n'ont simplement pas de vol d'ouverture
  // — leurs vignettes apparaissent au raccord, elles sont de toute façon
  // sous le pli de la colonne.
  const pile = [
    series.cover,
    ...series.photos.filter((p) => p._id !== series.cover._id),
  ].slice(0, 5);

  return (
    <div
      className="flex shrink-0 flex-col items-start"
      data-stack={series.slug}
      style={{ gap: 6 }}
    >
      {/* Bloc de libellés compact : « Open ↗ » puis le titre, 2 px entre les
          deux lignes, 6 px avant le bord haut de la cover (moitié des valeurs
          d'origine — l'interligne des deux textes fournit déjà de l'air). */}
      <div className="flex flex-col items-start" style={{ gap: 2 }}>
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          data-stack-open
          className="inline-flex items-center cursor-pointer text-[11px] uppercase font-bold text-[var(--color-fg)] hover:opacity-60 transition-opacity motion-reduce:transition-none"
          style={{ gap: 5 }}
        >
          Open
          {/* Flèche bas-gauche → haut-droit, en SUFFIXE, dimensionnée en `em` :
            elle suit le font-size du libellé quoi qu'il arrive. En CSS (pas en
            attribut SVG) — un `width='0.85em'` n'est pas fiable, cf. §3.6. */}
          <svg
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
            style={{ width: '0.85em', height: '0.85em', display: 'block' }}
          >
            <path
              d="M1.6 8.4 8.4 1.6M3.4 1.6h5v5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <p className="text-[11px] uppercase font-bold text-[var(--color-fg-muted)]">
          {series.title}
          {/* marginLeft inline : `ml-2` est avalé par le reset global hors
            @layer — le compteur se collait au titre (« ARCHITECTURE(11) »). */}
          <span className="opacity-60" style={{ marginLeft: 8 }}>
            ({series.photos.length})
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={`Open the series “${series.title}”`}
        className="relative cursor-pointer"
        style={{ width, height: PILE_HEIGHT }}
      >
        {pile.map((photo, i) => {
          // Sous-images plus légères : quasi entièrement couvertes par la
          // cover, elles ne servent que l'épaisseur et le départ des vols.
          const src = photo.image
            ? (urlFor(photo.image)
                ?.width(i === 0 ? 480 : 320)
                .quality(75)
                .auto('format')
                .url() ?? '')
            : '';
          const angle = PILE_DISORDER && i > 0 ? ((i % 3) - 1) * 1.6 : 0;
          const shift = PILE_DISORDER ? Math.min(i, 4) * 2 : 0;
          return (
            <img
              key={photo._id}
              src={src}
              alt={i === 0 ? (photo.image?.alt ?? photo.title) : ''}
              loading="lazy"
              decoding="async"
              // Sous-images (invisibles derrière la cover, sources des vols
              // uniquement) : priorité réseau basse — 45 requêtes qui
              // concouraient à égalité avec les covers au chargement.
              fetchPriority={i === 0 ? undefined : 'low'}
              data-pile-item={photo._id}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                zIndex: pile.length - i,
                transform: `translate(${shift}px, ${-shift}px) rotate(${angle}deg)`,
              }}
            />
          );
        })}
      </button>
    </div>
  );
}
