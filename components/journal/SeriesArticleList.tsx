import Link from 'next/link';
import { DICT, articlePath, type Lang } from '@/lib/journal/i18n';
import { frenchSpaces } from '@/lib/journal/french';
import { EDITORIAL_SIDENOTE, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { ArticleSummary } from '@/lib/journal/types';

/**
 * Les articles d'une série, sur sa page : dans l'ordre de LECTURE (partie 1
 * d'abord), pas dans l'ordre de parution comme l'index du journal. Chaque
 * rangée montre ce que l'index cache derrière son « + » — le sous-titre —
 * parce qu'ici on choisit par où entrer dans un sujet.
 *
 * Même inversion au survol que les lignes de l'index (brand book §14.8) :
 * encre sur papier devient papier sur encre, 200 ms.
 */
export function SeriesArticleList({ articles, lang }: { articles: ArticleSummary[]; lang: Lang }) {
  const t = DICT[lang];
  return (
    <ol className="flex flex-col" style={{ borderTop: '1px solid var(--color-line)' }}>
      {articles.map((a) => (
        <li key={a.slug} style={{ borderBottom: '1px solid var(--color-line)' }}>
          <Link
            href={articlePath(a.slug, a.lang)}
            className={cn(
              'group grid grid-cols-[40px_minmax(0,1fr)] md:grid-cols-[72px_minmax(0,1fr)] items-baseline text-[var(--color-fg)]',
              'transition-colors duration-200 ease-out motion-reduce:transition-none',
              'hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)] focus-visible:bg-[var(--color-fg)] focus-visible:text-[var(--color-bg)] focus-visible:outline-none',
            )}
            style={{ padding: '24px 8px' }}
          >
            <span className={cn(MICRO_LABEL, 'tabular-nums text-[var(--color-fg-muted)] group-hover:text-[var(--color-bg)] group-focus-visible:text-[var(--color-bg)]')}>
              {String(a.part).padStart(2, '0')}
            </span>
            <span className="flex flex-col gap-3 min-w-0">
              <span className="text-[24px] md:text-[34px] font-bold tracking-[-0.03em] leading-[1.1]">{frenchSpaces(a.title)}</span>
              <span className="text-[17px] md:text-[20px] font-bold tracking-[-0.02em] leading-[1.3] max-w-[var(--editorial-measure)] opacity-80">
                {frenchSpaces(a.dek)}
              </span>
              <span className={cn(EDITORIAL_SIDENOTE, 'flex flex-wrap gap-x-4 text-current opacity-70')}>
                <time dateTime={a.date}>{a.date.replaceAll('-', '.')}</time>
                <span>{t.minutes(a.minutes)}</span>
                {a.referenceCount > 0 && <span>{t.references(a.referenceCount)}</span>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
