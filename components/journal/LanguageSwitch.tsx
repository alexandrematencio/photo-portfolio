'use client';

import { StateDot } from '@/components/site/StateDot';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { DICT, LANGS, LOCALE, rememberLang, type Lang } from '@/lib/journal/i18n';
import type { Alternates } from '@/lib/journal/types';

/**
 * Le sélecteur de langue du journal — FR · EN · RU, sur l'accueil (colonne
 * de filtres) et sur les articles et les séries (rail du bouton Back).
 *
 * Grammaire des filtres de l'accueil : voyant orange devant la langue
 * courante, les autres en gris qui noircissent au survol. Le voyant est
 * toujours rendu (opacité) : le choix ne change pas la largeur du contrôle.
 *
 * Un `<a>` ordinaire, pas un `Link` : chaque langue a son propre layout
 * racine (`<html lang>`), la navigation recharge donc la page de toute
 * façon. Le clic RETIENT le choix (`rememberLang`) — il prime ensuite sur la
 * langue du système (`languageScript`). Une langue où la page n'existe pas
 * reste visible, grisée : la place est prise, rien ne saute d'une page à
 * l'autre.
 */
export function LanguageSwitch({
  lang,
  alternates,
  heading = false,
}: {
  lang: Lang;
  alternates: Alternates;
  /** `true` : l'en-tête « / Langue » des colonnes de filtres (accueil). */
  heading?: boolean;
}) {
  const t = DICT[lang];
  const row = (
    <ul className="flex items-center gap-x-4">
      {LANGS.map((l) => {
        const here = l === lang;
        const href = alternates[l];
        const label = (
          <>
            <StateDot on={here} />
            <span>{LOCALE[l].code}</span>
            <span className="sr-only"> — {LOCALE[l].native}</span>
          </>
        );
        const base = 'flex items-center gap-[8px] text-[15px] font-bold tracking-[-0.02em] leading-none';
        return (
          <li key={l}>
            {here ? (
              <span aria-current="true" className={cn(base, 'text-[var(--color-fg)]')} style={{ paddingBlock: 6 }}>
                {label}
              </span>
            ) : href ? (
              <a
                href={href}
                hrefLang={LOCALE[l].bcp47}
                lang={LOCALE[l].bcp47}
                onClick={() => rememberLang(l)}
                className={cn(
                  base,
                  'text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)] motion-reduce:transition-none',
                )}
                style={{ paddingBlock: 6 }}
              >
                {label}
              </a>
            ) : (
              <span aria-disabled="true" className={cn(base, 'text-[var(--color-fg-faint)]')} style={{ paddingBlock: 6 }}>
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (!heading) return <nav aria-label={t.language}>{row}</nav>;
  return (
    <nav aria-label={t.language} className="flex flex-col">
      <span
        className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
        style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-line)' }}
      >
        / {t.language}
      </span>
      <div style={{ paddingTop: 12 }}>{row}</div>
    </nav>
  );
}
