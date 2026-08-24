import type { Photo } from '@/lib/sanity/queries';
import { cn } from '@/lib/utils/cn';
import { MICRO_LABEL_XS } from '@/lib/site/typography';

/**
 * Interligne du bloc, en PIXELS et non en multiple du corps : la hauteur
 * réservée au chrome de la vue ouverte desktop (`CHROME_BOTTOM`,
 * OpenSeriesView) s'en déduit par multiplication. Un interligne relatif
 * obligerait à refaire ce produit à la main à chaque changement de corps — et
 * ce bloc est en `absolute`, donc la place qu'on ne lui réserve pas, il la
 * prend sous le footer, sans un mot (§3.7 invariant 11).
 *
 * 15 px pour un corps de 10 (soit 1,5) depuis le 2026-08-24, contre 18 (1,8)
 * auparavant — demande Alexandre : le bloc respirait comme un paragraphe alors
 * qu'il se lit comme une étiquette.
 */
export const META_LINE_PX = 15;

/**
 * Bloc de métadonnées de la photo affichée : année, lieu, boîtier, objectif.
 *
 * Spec §5 : collé au bord BAS-DROIT de l'image centrale (pas de légende
 * centrée façon « 01 — Some Text » de la démo de référence). Les lignes
 * vides sont MASQUÉES, jamais remplacées par un tiret — 11 photos sur 134
 * ont un boîtier/objectif renseigné, un bloc à trous serait la règle.
 */
export function SeriesMeta({
  photo,
  className,
  style,
  grouped = false,
}: {
  photo: Photo;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Deux lignes au lieu de quatre : la prise de vue (année, lieu) puis le
   * matériel (boîtier, objectif), valeurs séparées par un point médian.
   * Réservé au mobile : collée sous une photo dont la hauteur varie, une pile
   * de quatre lignes ferait varier la fiche de 15 à 60 px — donc la hauteur du
   * bloc entier, donc la taille maximale de la photo, d'une photo à l'autre.
   * Deux lignes bornent cet écart à une seule (demande Alexandre,
   * 2026-08-24 : sur une seule ligne, les quatre valeurs se lisaient comme une
   * chaîne indistincte).
   */
  grouped?: boolean;
}) {
  const shot = [photo.year ? String(photo.year) : null, photo.location ?? null];
  const gear = [photo.camera?.title ?? null, photo.lens?.title ?? null];

  const rows = grouped
    ? [shot, gear].map((group) => group.filter(Boolean).join(' · '))
    : [...shot, ...gear];

  const lines = rows.filter((row): row is string => Boolean(row));

  if (lines.length === 0) return null;

  return (
    <p
      className={cn(
        MICRO_LABEL_XS,
        'text-right text-[var(--color-fg-muted)]',
        className
      )}
      style={{ lineHeight: `${META_LINE_PX}px`, ...style }}
    >
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}
