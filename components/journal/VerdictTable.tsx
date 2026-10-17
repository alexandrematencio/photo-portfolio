import type { CSSProperties } from 'react';
import {
  EDITORIAL_ANNEX,
  EDITORIAL_SIDENOTE,
  MICRO_LABEL,
} from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { Verdict, VerdictKind } from '@/lib/journal/types';

/**
 * Le BILAN de l'annexe : une planche-contact des verdicts, puis le tableau.
 *
 * La planche lit le bilan d'un coup d'œil — quinze marques, une par idée,
 * dans l'ordre du texte. Quatre FORMES et non quatre couleurs : la marque
 * survit au daltonisme et à l'impression noir et blanc, et l'orange reste
 * réservé aux états (§4.3).
 *
 * Au-dessus de `md` un vrai tableau ; en dessous, la même table en fiches
 * empilées (les cellules passent en `block`), sans perdre la sémantique.
 */

const KIND_LABEL: Record<VerdictKind, string> = {
  converge: 'Converge',
  nuance: 'Converge avec réserve',
  open: 'Ouvert, à tester',
  fails: 'Ne tient pas',
};

const KIND_ORDER: VerdictKind[] = ['converge', 'nuance', 'open', 'fails'];

export function VerdictMark({ kind, size = 12 }: { kind: VerdictKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden
      className="shrink-0 text-[var(--color-fg)]"
    >
      {kind === 'converge' && <circle cx="6" cy="6" r="5.5" fill="currentColor" />}
      {kind === 'nuance' && (
        <>
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1 A5 5 0 0 0 6 11 Z" fill="currentColor" />
        </>
      )}
      {kind === 'open' && (
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      )}
      {kind === 'fails' && (
        <>
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.5 9.5 L9.5 2.5" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

export function VerdictTable({ rows, style }: { rows: Verdict[]; style?: CSSProperties }) {
  const counts = KIND_ORDER.map((kind) => ({
    kind,
    count: rows.filter((v) => v.kind === kind).length,
  }));

  return (
    <div className="flex flex-col gap-8" style={style}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-[10px]" aria-hidden>
          {rows.map((v, i) => (
            <VerdictMark key={i} kind={v.kind} size={22} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Répartition des verdicts">
          {counts.map(({ kind, count }) => (
            <li key={kind} className={cn(MICRO_LABEL, 'flex items-center gap-2')}>
              <VerdictMark kind={kind} />
              {KIND_LABEL[kind]} ({count})
            </li>
          ))}
        </ul>
      </div>

      <table className="w-full border-collapse max-md:block">
        <caption className="sr-only">Le bilan idée par idée</caption>
        <thead className="max-md:sr-only">
          <tr>
            {["Ce que j'ai déduit", 'Ce qui existait', 'Verdict'].map((h) => (
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
          {rows.map((v, i) => (
            <tr
              key={i}
              className="max-md:flex max-md:flex-col max-md:gap-[6px]"
              data-verdict-row
              style={{ borderTop: '1px solid var(--color-line)' }}
            >
              <td data-verdict-cell className="align-top max-md:block md:w-[44%]">
                <span className={cn(EDITORIAL_ANNEX, 'block')}>{v.idea}</span>
              </td>
              <td data-verdict-cell className="align-top max-md:block md:w-[28%]">
                <span className={cn(EDITORIAL_SIDENOTE, 'block md:relative md:top-[3px]')}>{v.prior}</span>
              </td>
              <td data-verdict-cell className="align-top max-md:block">
                <span className={cn(MICRO_LABEL, 'flex items-start gap-2 md:relative md:top-[5px]')}>
                  <span className="relative top-[1px]">
                    <VerdictMark kind={v.kind} />
                  </span>
                  {v.verdict}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
