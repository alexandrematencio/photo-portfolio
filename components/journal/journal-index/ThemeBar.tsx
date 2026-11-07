import { useRef, type Ref } from 'react';
import { DICT, type Lang } from '@/lib/journal/i18n';
import { StateDot } from '@/components/site/StateDot';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { TagSwatch } from '@/components/journal/TagSwatch';
import type { Filter } from '@/components/journal/FolderTree';

/**
 * Le bandeau « Filtrage » (2026-10-22) : il coiffe l'index tant qu'une
 * thématique filtre. Première ligne, ce qui filtre — à l'encre — et la sortie,
 * « × Tout afficher », au fer droit. Dessous, toutes les thématiques en
 * bascules, voyant compris : la grammaire de la colonne de filtres, au corps
 * des thématiques de ligne. Le voyant est toujours rendu, c'est son opacité
 * qui bascule : un clic ne décale jamais la rangée.
 *
 * Il s'ouvre comme le dépli d'une ligne (grille 0fr → 1fr, 300 ms qui freine,
 * le texte 60 ms après la boîte ; fermeture 200 ms qui accélère). À la
 * fermeture il garde la dernière sélection affichée : sans elle, il se
 * viderait avant de se replier.
 */
export function ThemeBar({
  ref,
  lang,
  themes,
  picked,
  onToggle,
  onClear,
}: {
  ref: Ref<HTMLDivElement>;
  lang: Lang;
  /** Toutes les thématiques, « Tout » exclu. */
  themes: Filter[];
  picked: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const t = DICT[lang];
  const open = picked.length > 0;
  const last = useRef<string[]>([]);
  // eslint-disable-next-line react-hooks/refs -- derniers choix gardés pendant le repli de la barre
  if (open) last.current = picked;
  // eslint-disable-next-line react-hooks/refs -- derniers choix gardés pendant le repli de la barre
  const names = themes.filter((f) => last.current.includes(f.key)).map((f) => f.label);

  return (
    <div
      ref={ref}
      className={cn(
        'grid transition-[grid-template-rows] motion-reduce:transition-none',
        open ? 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : 'duration-200 ease-in',
      )}
      style={{ gridTemplateRows: open ? '1fr' : '0fr', scrollMarginTop: 16 }}
    >
      <div className="overflow-hidden" inert={!open}>
        <div
          className={cn(
            'transition-opacity motion-reduce:transition-none',
            open ? 'opacity-100 duration-300 ease-out delay-[60ms]' : 'opacity-0 duration-150 ease-in',
          )}
          // Retrait des lignes (8) : le voyant des bascules tombe dans la
          // colonne des voyants de l'index, « × Tout afficher » au fer du « + ».
          style={{ paddingBottom: 28, paddingInline: 8 }}
        >
          <div className="flex items-baseline justify-between gap-4">
            <p aria-live="polite" className={cn(MICRO_LABEL, 'min-w-0 text-[var(--color-fg-muted)]')}>
              {t.filtering}
              {lang === 'fr' ? '\u00a0: ' : ': '}
              <span className="text-[var(--color-fg)]">{names.join(', ')}</span>
            </p>
            <button
              type="button"
              onClick={onClear}
              className={cn(
                MICRO_LABEL,
                'group/clear shrink-0 flex items-baseline gap-[6px] text-[var(--color-fg)]',
              )}
            >
              {/* Une croix DESSINÉE à la hauteur des capitales (7 px ; mesurée,
                  la capitale de l'étiquette à 11 px fait 7,2). En ligne de base,
                  une boîte sans texte s'aligne par son bas : elle se pose sur la
                  ligne du libellé, là où le glyphe « × » flottait à mi-hauteur. */}
              <svg aria-hidden width={7} height={7} viewBox="0 0 7 7" className="flex-none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M0.75 0.75l5.5 5.5M6.25 0.75l-5.5 5.5" />
              </svg>
              <span className="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 group-hover/clear:decoration-current group-focus-visible/clear:decoration-current motion-reduce:transition-none">
                {t.clearFilter}
              </span>
            </button>
          </div>
          <div role="group" aria-label={t.filterByTheme} className="flex flex-wrap gap-x-5 gap-y-2" style={{ paddingTop: 14 }}>
            {themes.map((f) => {
              const on = picked.includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(f.key)}
                  className={cn(
                    MICRO_LABEL,
                    'flex items-center gap-[8px] transition-colors duration-200 motion-reduce:transition-none',
                    on ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                  )}
                >
                  <StateDot on={on} />
                  <TagSwatch color={f.color ?? null} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

