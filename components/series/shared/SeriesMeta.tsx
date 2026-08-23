import type { Photo } from '@/lib/sanity/queries';
import { cn } from '@/lib/utils/cn';
import { MICRO_LABEL_XS } from '@/lib/site/typography';

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
  inline = false,
}: {
  photo: Photo;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Une seule ligne, valeurs séparées par des points médians. Réservé au
   * mobile : collée sous une photo dont la hauteur varie, une pile de quatre
   * lignes ferait varier la fiche de 18 à 72 px — donc la hauteur du bloc
   * entier, donc la taille maximale de la photo, d'une photo à l'autre. Une
   * ligne unique rend cette hauteur constante par construction.
   */
  inline?: boolean;
}) {
  const rows = [
    photo.year ? String(photo.year) : null,
    photo.location ?? null,
    photo.camera?.title ?? null,
    photo.lens?.title ?? null,
  ].filter((r): r is string => Boolean(r));

  if (rows.length === 0) return null;

  if (inline) {
    return (
      <p
        className={cn(
          MICRO_LABEL_XS,
          'leading-[1.8] text-[var(--color-fg-muted)]',
          className
        )}
        style={style}
      >
        {rows.join(' · ')}
      </p>
    );
  }

  return (
    <p
      className={cn(
        MICRO_LABEL_XS,
        'text-right leading-[1.8] text-[var(--color-fg-muted)]',
        className
      )}
      style={style}
    >
      {rows.map((row) => (
        <span key={row} className="block">
          {row}
        </span>
      ))}
    </p>
  );
}
