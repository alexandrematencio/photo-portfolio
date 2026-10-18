'use client';

import { StateDot } from '@/components/site/StateDot';
import { asset } from '@/lib/utils/asset';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { DICT, LANGS, LOCALE, rememberLang, type Lang } from '@/lib/journal/i18n';
import type { Alternates } from '@/lib/journal/types';

/**
 * Le sélecteur de langue du journal — trois drapeaux (France, Royaume-Uni,
 * Russie ; demande Alexandre, 2026-10-18, à la place de « FR · EN · RU »),
 * sur l'accueil (colonne de filtres) et sur les articles et les séries (rail
 * du bouton Back). Le nom de la langue reste lisible des lecteurs d'écran.
 *
 * Grammaire des filtres de l'accueil : voyant orange devant la langue
 * courante, les autres drapeaux estompés qui s'allument au survol. Le voyant
 * est toujours rendu (opacité) : le choix ne change pas la largeur du contrôle.
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
  /** `true` : l'en-tête « Langue » des colonnes de filtres (accueil). */
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
            {/* Le SVG porte 2 px de marge de chaque côté (viewBox 28 × 17). */}
            <img
              src={asset(`/img/flags/${LOCALE[l].flag}.svg`)}
              alt=""
              aria-hidden
              draggable={false}
              width={28}
              height={17}
              className="h-[17px] w-auto transition-[opacity,filter] duration-200 motion-reduce:transition-none"
            />
            <span className="sr-only">{LOCALE[l].native}</span>
          </>
        );
        const base = 'flex items-center gap-[6px] leading-none';
        return (
          <li key={l}>
            {here ? (
              <span aria-current="true" className={base} style={{ paddingBlock: 6 }}>
                {label}
              </span>
            ) : href ? (
              <a
                href={href}
                hrefLang={LOCALE[l].bcp47}
                lang={LOCALE[l].bcp47}
                onClick={() => rememberLang(l)}
                className={cn(base, '[&>img]:opacity-45 hover:[&>img]:opacity-100 focus-visible:[&>img]:opacity-100')}
                style={{ paddingBlock: 6 }}
              >
                {label}
              </a>
            ) : (
              <span aria-disabled="true" className={cn(base, '[&>img]:opacity-20 [&>img]:grayscale')} style={{ paddingBlock: 6 }}>
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
        {t.language}
      </span>
      <div style={{ paddingTop: 12 }}>{row}</div>
    </nav>
  );
}
