import Link from 'next/link';
import { useId, useState } from 'react';
import { DICT, LONG_READ_MINUTES, articleDate, articlePath, seriesPath, type Lang } from '@/lib/journal/i18n';
import { StateDot } from '@/components/site/StateDot';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { TagSwatch } from '@/components/journal/TagSwatch';
import type { ArticleSummary } from '@/lib/journal/types';

/** Colonne des dates — « 17/10/26 » en chiffres tabulaires. */
export const DATE_COL = 128;

/**
 * La marque de série d'une ligne : une courte flèche, le nom, puis la partie
 * « 2/3 » dans un cadre de 1 px (demande Alexandre, 2026-10-21 — remplace la
 * pile de traits). Son contenu est visuel (`aria-hidden`) — le lien qui
 * l'enveloppe dans `Row` porte son nom en toutes lettres. Tout suit
 * `currentColor`, cadre compris : la couleur se décide sur le lien.
 *
 * Le soulignement de survol ne tient que sous le NOM (`group/series`) : ni la
 * flèche ni le cadre ne se soulignent.
 */
function SeriesMark({ name, part, total }: { name: string | null; part: number; total: number }) {
  return (
    <span aria-hidden className={cn(MICRO_LABEL, 'flex items-center gap-[8px]')}>
      {name && (
        <>
          <svg
            width={10}
            height={10}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-none"
          >
            <path d="M4 12h15" />
            <path d="M13 6l6 6-6 6" />
          </svg>
          <span
            className={cn(
              'underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 motion-reduce:transition-none',
              'group-hover/series:decoration-[var(--color-bg)] group-focus-visible/series:decoration-[var(--color-bg)]',
            )}
          >
            {name}
          </span>
        </>
      )}
      {/* Padding inline : le reset `* { padding: 0 }` avale les utilities.
          Graisse 500 : le chiffre se lit sans peser autant que le nom. */}
      <span className="shrink-0 leading-none font-medium" style={{ padding: '3px 5px', border: '1px solid currentColor' }}>
        {part}/{total}
      </span>
    </span>
  );
}

export function Row({
  article,
  lang,
  total,
  showSeriesName,
  onTheme,
  onHot,
}: {
  article: ArticleSummary;
  lang: Lang;
  /** Nombre de parties de la série de l'article, 0 hors série. */
  total: number;
  showSeriesName: boolean;
  /** Filtre l'index sur une thématique de l'article (depuis son dépli). */
  onTheme: (slug: string) => void;
  onHot: (on: boolean) => void;
}) {
  const t = DICT[lang];
  const mark = article.series && total > 0 && (
    <SeriesMark name={showSeriesName ? article.series : null} part={article.part} total={total} />
  );
  const [open, setOpen] = useState(false);
  const [hot, setHotState] = useState(false);
  const setHot = (on: boolean) => {
    setHotState(on);
    onHot(on);
  };
  const panelId = useId();

  return (
    <li style={{ borderBottom: '1px solid var(--color-line)' }}>
      <div
        className={cn(
          'group relative flex flex-col transition-colors duration-200 ease-out motion-reduce:transition-none',
          'hover:bg-[var(--color-fg)] focus-within:bg-[var(--color-fg)]',
        )}
        style={{ paddingBlock: 14, paddingInline: 8 }}
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-1 min-w-0 flex flex-col gap-1 md:grid md:items-center"
            style={{ gridTemplateColumns: `${DATE_COL - 8}px minmax(0, 1fr)` }}
          >
            <span
              className={cn(
                MICRO_LABEL,
                'flex items-center gap-[10px] text-[var(--color-fg-muted)] transition-colors duration-200 motion-reduce:transition-none',
                'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
              )}
            >
              {/* Le voyant de survol n'existe qu'au pointeur : sur téléphone il
                  décalait la date sous le titre pour un état qui ne s'allume pas. */}
              <span className="hidden md:flex">
                <StateDot on={hot} />
              </span>
              <time dateTime={article.date}>{articleDate(article.date)}</time>
            </span>
            <span className="flex flex-col gap-[6px] min-w-0">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 md:flex-nowrap">
                <Link
                  href={articlePath(article.slug, lang)}
                  className={cn(
                    'min-w-0 text-[21px] md:text-[28px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-fg)] md:truncate',
                    'transition-colors duration-200 motion-reduce:transition-none',
                    'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)] focus-visible:outline-none',
                    // Lien étiré : toute la ligne est cliquable, le « + » passe au-dessus.
                    'after:absolute after:inset-0',
                  )}
                >
                  {article.title}
                  {article.series && article.part > 0 && (
                    <span className="sr-only"> — {t.seriesMark(article.series, article.part, total)}</span>
                  )}
                </Link>
                {/* « Long read » (2026-10-22, maquette d'Alexandre) : l'orange
                    des liens, cadre compris — c'est un signal, pas une surface.
                    Padding inline : le reset `* { padding: 0 }`. */}
                {article.minutes >= LONG_READ_MINUTES && (
                  <span
                    className="shrink-0 rounded-full text-[8px] font-medium uppercase leading-none text-[var(--color-link)]"
                    style={{ padding: '4px 8px', border: '1px solid var(--color-link)' }}
                  >
                    {t.longRead}
                  </span>
                )}
              </span>
              {/* Sous le titre : la série (lien, à l'encre) puis les
                  thématiques (grises comme la date ; un clic filtre l'index
                  sur elles). Tout passe au papier sur la ligne inversée. */}
              {(mark || article.tags.length > 0) && (
                <span
                  className={cn(
                    MICRO_LABEL,
                    'flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--color-fg-muted)] transition-colors duration-200 motion-reduce:transition-none',
                    'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
                  )}
                >
                  {mark &&
                    (article.seriesSlug ? (
                      <Link
                        href={seriesPath(article.seriesSlug, lang)}
                        aria-label={`${t.seriesPage} — ${t.seriesMark(article.series!, article.part, total)}`}
                        // Au-dessus du lien étiré du titre, comme le « + ».
                        // Bleu du logo au repos ; papier sur la ligne inversée
                        // (le bleu y tomberait à ~2:1) ; orange du surlignage de
                        // la nav sous le pointeur, souligné de papier — `!` :
                        // le survol du lien l'emporte sur celui de la ligne.
                        className={cn(
                          'group/series relative z-10 text-[var(--color-accent)]',
                          'transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none',
                          'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
                          'hover:text-[var(--color-active-bg)]! focus-visible:text-[var(--color-active-bg)]!',
                        )}
                      >
                        {mark}
                      </Link>
                    ) : (
                      <span className="text-[var(--color-accent)] group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]">
                        {mark}
                      </span>
                    ))}
                  {article.tags.length > 0 && (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="sr-only">{t.themesHeading}: </span>
                      {article.tags.map((tag) => (
                        <button
                          key={tag.slug}
                          type="button"
                          onClick={() => onTheme(tag.slug)}
                          // Au-dessus du lien étiré, comme la série.
                          className="relative z-10 flex items-center gap-[6px] uppercase underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 hover:decoration-current focus-visible:decoration-current focus-visible:outline-none motion-reduce:transition-none"
                        >
                          <TagSwatch color={tag.color} />
                          {tag.title}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              )}
            </span>
          </div>
          {/* Le « + » dit ce qu'il fait (2026-10-27) : seul, il passait pour un
              ornement de la ligne, puisque toute la ligne est un lien et
              s'inverse d'un bloc. D'où un libellé (« Aperçu », « Fermer » une
              fois ouvert) — révélé au survol de la ligne sur desktop, toujours
              là sur téléphone où le survol n'existe pas — et un second état
              sous le pointeur : la ligne passe à l'encre, le bouton repasse au
              papier. On voit la cible changer en quittant le titre. Le nom
              accessible reprend le libellé visible (WCAG 2.5.3). Padding
              inline : le reset `* { padding: 0 }`. */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              MICRO_LABEL,
              'relative z-10 -my-[6px] flex h-11 shrink-0 items-center gap-2 text-[var(--color-fg)]',
              'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
              // `!` : le survol du bouton l'emporte sur celui de la ligne, comme le lien de série.
              'hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]! focus-visible:bg-[var(--color-bg)] focus-visible:text-[var(--color-fg)]! focus-visible:outline-none',
              'transition-colors duration-150 ease-out motion-reduce:transition-none',
            )}
            style={{ paddingInline: '12px 10px' }}
          >
            {/* `leading-none` + 1 px : les capitales d'Helvetica sont plus
                hautes que le centre de leur boîte (le jambage du bas y est
                compté) ; sans ce cran, « APERÇU » flottait au-dessus du « + ». */}
            <span
              className={cn(
                'leading-none translate-y-px transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
                !open &&
                  'md:translate-x-[6px] md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100 md:group-focus-within:translate-x-0 md:group-focus-within:opacity-100',
              )}
            >
              {open ? t.close : t.preview}
              <span className="sr-only"> — {article.title}</span>
            </span>
            {/* Un tracé plutôt que le glyphe « + » : son centre est celui de
                sa boîte, quelle que soit la fonte système qui le dessinerait. */}
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              width={12}
              height={12}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className={cn(
                'shrink-0',
                // Tailwind v4 : `rotate-45` écrit la propriété `rotate` — d'où
                // `transition-[rotate]` et pas `transition-transform` (CLAUDE.md §7).
                'transition-[rotate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                // Quart de tour en boucle au survol (globals.css, `journal-plus-turn`).
                open
                  ? 'rotate-45'
                  : 'motion-safe:md:group-hover:animate-[journal-plus-turn_1.4s_infinite] motion-safe:md:group-focus-within:animate-[journal-plus-turn_1.4s_infinite]',
              )}
            >
              <path d="M6 0v12M0 6h12" />
            </svg>
          </button>
        </div>

        {/* Dépli DANS la ligne (2026-10-22) : le sous-titre, sous le titre,
            dans la même surface — la ligne grandit, les suivantes descendent.
            Grille 0fr → 1fr pour animer une hauteur inconnue ; ouverture
            300 ms qui freine, fermeture 200 ms qui accélère ; le texte arrive
            60 ms après la boîte (chevauchement). Le lien étiré du titre le
            couvre aussi : un clic sur le sous-titre ouvre l'article. */}
        <div
          id={panelId}
          className={cn(
            'grid transition-[grid-template-rows] motion-reduce:transition-none',
            open ? 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : 'duration-200 ease-in',
          )}
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden" inert={!open}>
            {/* À droite, la place du « + » (32) et de son écart (12). */}
            <div
              className={cn(
                'md:grid transition-opacity motion-reduce:transition-none',
                open ? 'opacity-100 duration-300 ease-out delay-[60ms]' : 'opacity-0 duration-150 ease-in',
              )}
              style={{ gridTemplateColumns: `${DATE_COL - 8}px minmax(0, 1fr)`, paddingTop: 10, paddingRight: 44 }}
            >
              <span aria-hidden className="hidden md:block" />
              <p
                className={cn(
                  'max-w-[var(--editorial-measure)] text-[17px] md:text-[20px] font-bold tracking-[-0.02em] leading-[1.3] text-[var(--color-fg-muted)]',
                  'transition-colors duration-200 motion-reduce:transition-none',
                  'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
                )}
              >
                {article.dek}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
