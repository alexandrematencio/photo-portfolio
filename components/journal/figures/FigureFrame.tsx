import type { CSSProperties, ReactNode } from 'react';
import { EDITORIAL_SIDENOTE, MICRO_LABEL } from '@/lib/site/typography';

/**
 * La plaque commune aux figures dessinées du journal : un SVG en ligne posé
 * sur `--color-bg-elev`, la largeur de la mesure de lecture, et une légende
 * « Fig. n » + phrase. SVG en ligne plutôt qu'une image : le texte reste
 * lisible par les machines (§5 SEO — rien d'indexable dans une image seule),
 * les traits suivent les jetons de couleur, et les libellés se traduisent
 * (lib/journal/i18n.ts, `figures`).
 *
 * Encre seule : noir et gris de métadonnée. L'orange dit un état, il ne
 * dessine pas (§4.3).
 *
 * Une seule géométrie aux deux largeurs, bornée à la mesure : 13 unités sur
 * 680 tombent à ~8 px sur un téléphone de 390 px. C'est le plancher ; aucun
 * libellé en dessous de 13.
 */
export function FigureFrame({
  number,
  label,
  legend,
  style,
  children,
}: {
  number: number;
  /** « Fig. 2 », dans la langue de l'article. */
  label: string;
  legend: string;
  style?: CSSProperties;
  /** Le `<svg>` de la figure. */
  children: ReactNode;
}) {
  return (
    <figure id={`fig-${number}`} className="flex flex-col gap-3 scroll-mt-24" style={{ maxWidth: 'var(--editorial-measure)', ...style }}>
      <div style={{ backgroundColor: 'var(--color-bg-elev)', padding: '8px 4px' }}>{children}</div>
      <figcaption className="flex flex-col gap-1">
        <span className={MICRO_LABEL}>{label}</span>
        <span className={EDITORIAL_SIDENOTE}>{legend}</span>
      </figcaption>
    </figure>
  );
}

/** Les attributs communs des `<svg>` de figure. */
export function svgProps(id: string, viewBox: string) {
  return {
    viewBox,
    role: 'img' as const,
    'aria-labelledby': `${id}-title ${id}-desc`,
    className: 'block w-full h-auto text-[var(--color-fg)]',
    fontFamily: 'inherit',
  };
}

/** Pointe de flèche, à poser dans les `<defs>` (`markerEnd={`url(#${id}-arrow)`}`). */
export function ArrowMarker({ id, color = 'currentColor' }: { id: string; color?: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill={color} />
    </marker>
  );
}
