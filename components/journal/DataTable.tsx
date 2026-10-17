import type { CSSProperties } from 'react';
import { EDITORIAL_ANNEX, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * Tableau de données d'un article (brand book §14.6) : en-têtes en capitales
 * micro grises, filets d'une ligne, aucun aplat. Chiffres tabulaires — les
 * colonnes de prix et de multiples se lisent en colonne.
 *
 * Sous `md`, chaque ligne devient une fiche : la première cellule en titre,
 * les autres en paires « EN-TÊTE  valeur ». Un tableau à six colonnes ne tient
 * pas dans 350 px, et un défilement horizontal y cacherait justement les deux
 * colonnes qui portent l'argument (revente, multiple).
 */
export function DataTable({
  head,
  rows,
  style,
}: {
  head: string[];
  rows: string[][];
  style?: CSSProperties;
}) {
  return (
    <div style={style}>
      <table className="w-full border-collapse tabular-nums max-md:block">
        <thead className="max-md:sr-only">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                data-verdict-cell
                className={cn(MICRO_LABEL, 'text-left align-bottom text-[var(--color-fg-muted)]')}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block">
          {rows.map((row, i) => (
            <tr
              key={i}
              data-verdict-row
              className="max-md:flex max-md:flex-col max-md:gap-[6px]"
              style={{ borderTop: '1px solid var(--color-line)' }}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  data-verdict-cell
                  className={cn(
                    EDITORIAL_ANNEX,
                    'align-top max-md:flex max-md:justify-between max-md:gap-4 md:whitespace-nowrap',
                    j === 0 && 'font-bold max-md:block md:whitespace-normal',
                  )}
                >
                  {j > 0 && (
                    <span aria-hidden className={cn(MICRO_LABEL, 'md:hidden text-[var(--color-fg-muted)] relative top-[5px]')}>
                      {head[j]}
                    </span>
                  )}
                  <span>{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
