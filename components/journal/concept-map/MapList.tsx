'use client';

import Link from 'next/link';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { frenchSpaces } from '@/lib/journal/french';
import { JOURNAL_LINK_DECORATION, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { listedMechanisms, type MapIndex } from './model';

/**
 * La carte en LISTE : mécanisme → articles → passages. C'est la vue des
 * téléphones, et le chemin du clavier et du lecteur d'écran sur grand écran
 * (le dessin, lui, ne se parcourt qu'à la souris). Rendue au build : c'est
 * aussi ce que lit un moteur de recherche, chaque passage en lien.
 *
 * `<details>` natif : ouvert au clavier, annoncé « réduit / développé », et
 * lisible sans JavaScript.
 */
export function MapList({ ix, visible, onShow }: { ix: MapIndex; visible: Set<string>; onShow?: (id: string) => void }) {
  const mechs = listedMechanisms(ix, visible);
  if (!mechs.length) return <p className="text-[15px] text-[var(--color-fg-muted)]">Aucun mécanisme pour ces filtres.</p>;
  return (
    <ol className="flex flex-col border-t border-[var(--color-line)]">
      {mechs.map((m) => {
        const theses = (ix.thesesOfMech.get(m.id) ?? []).map((t) => ix.byId.get(t)!).filter((t) => t && visible.has(t.id));
        const articles = [...new Set(theses.map((t) => t.articles[0]))].map((a) => ix.byId.get(a)!).filter(Boolean);
        return (
          <li key={m.id} className="border-b border-[var(--color-line)]">
            <details className="concept-row group">
              <summary
                className="flex cursor-pointer list-none items-baseline gap-3 text-[17px] font-bold leading-[1.3] tracking-[-0.01em] text-[var(--color-fg)] [&::-webkit-details-marker]:hidden"
                style={{ paddingBlock: 14 }}
              >
                <svg
                  aria-hidden
                  width={10}
                  height={10}
                  viewBox="0 0 10 10"
                  className="flex-none self-center transition-[rotate] duration-200 ease-out group-open:rotate-90 motion-reduce:transition-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path d="M3 1.5L6.5 5 3 8.5" />
                </svg>
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <TagSwatch color={(m.theme && ix.themeColor.get(m.theme)) || null} />
                  <span>{frenchSpaces(m.label)}</span>
                </span>
                <span className={cn(MICRO_LABEL, 'flex-none text-[var(--color-fg-muted)]')}>
                  {articles.length} article{articles.length > 1 ? 's' : ''}
                </span>
              </summary>
              <div className="flex flex-col gap-4" style={{ paddingBottom: 20, paddingLeft: 22 }}>
                {m.definition && <p className="max-w-[var(--editorial-measure)] text-[15px] font-medium leading-[1.5]">{frenchSpaces(m.definition)}</p>}
                <ul className="flex flex-col gap-4">
                  {articles.map((a) => (
                    <li key={a.id} className="flex flex-col gap-1.5">
                      <Link href={a.href} className={cn(MICRO_LABEL, 'w-fit text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)]')}>
                        {frenchSpaces(a.label)}
                      </Link>
                      <ul className="flex flex-col gap-1">
                        {theses
                          .filter((t) => t.articles[0] === a.id)
                          .map((t) => (
                            <li key={t.id}>
                              <Link href={t.href} className={cn(JOURNAL_LINK_DECORATION, 'text-[15px] font-medium leading-[1.4]')}>
                                {frenchSpaces(t.label)}
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {onShow && (
                  <button
                    type="button"
                    onClick={() => onShow(m.id)}
                    className={cn(MICRO_LABEL, 'w-fit text-[var(--color-fg)] underline underline-offset-4')}
                  >
                    Voir sur la carte
                  </button>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
