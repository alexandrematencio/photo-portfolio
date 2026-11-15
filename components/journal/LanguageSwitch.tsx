'use client';

import { ChevronUp } from 'lucide-react';
import { asset } from '@/lib/utils/asset';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { DICT, LANGS, LOCALE, rememberLang, type Lang } from '@/lib/journal/i18n';
import { announceSwitch, patchSwitch } from '@/lib/journal/langSwitch';
import { HASH_KEY } from '@/components/journal/concept-map/model';
import type { Alternates } from '@/lib/journal/types';

/**
 * Le sélecteur de langue du journal — trois drapeaux (France, Royaume-Uni,
 * Russie ; demande Alexandre, 2026-10-18, à la place de « FR · EN · RU »),
 * sur l'accueil (colonne de filtres) et sur les articles et les séries (rail
 * du bouton Back). Le nom de la langue reste lisible des lecteurs d'écran.
 *
 * La langue courante est marquée d'un chevron sous son drapeau, pointé vers
 * lui (demande Alexandre, 2026-10-19, à la place du voyant orange) ; les
 * autres drapeaux sont estompés et s'allument au survol. Le chevron est
 * toujours rendu (opacité) : le choix ne change pas la géométrie du contrôle.
 *
 * Un `<a>` ordinaire, pas un `Link` : chaque langue a son propre layout
 * racine (`<html lang>`), la navigation recharge donc la page de toute
 * façon. Le clic RETIENT le choix (`rememberLang`) — il prime ensuite sur la
 * langue du système (`languageScript`). Une langue où la page n'existe pas
 * reste visible, grisée : la place est prise, rien ne saute d'une page à
 * l'autre.
 *
 * Changer de langue garde sa place (2026-11-07, demande Alexandre) : au clic,
 * le lien emporte l'ancre du paragraphe en haut de l'écran (`#p-<clé>`). Les
 * clés sont communes au FR, à l'EN et au RU (`align-translation-keys`) : la
 * page d'arrivée s'ouvre sur le même passage, que `PassageArrival` souligne
 * du filet orange. On modifie le `href` au lieu d'empêcher la navigation :
 * Cmd+clic, qui ouvre un onglet, en profite aussi.
 *
 * Au plus près, au sein du paragraphe (2026-11-16) : on emporte aussi la
 * fraction du paragraphe déjà lue, que `PassageArrival` rend à la page
 * d'arrivée (un paragraphe russe n'a pas la hauteur du français, mais la
 * proportion tient). Sur la Concept Map, l'ancre est le nœud choisi
 * (`#n=<id>`, neutre en langue), et la carte dépose le reste de son état au
 * départ (`LANG_SWITCH_EVENT`, lib/journal/langSwitch.ts).
 */

/** La marge d'ancre des passages (`.journal-passage`, globals.css). */
const PASSAGE_TOP = 32;

/**
 * L'ancre du paragraphe que lit le lecteur : le premier dont le bas passe sous
 * le haut de l'écran. Rien tant qu'on est au-dessus du texte (titre, chapeau) :
 * la page d'arrivée s'ouvre alors en haut, comme avant. Rien non plus hors
 * d'un article : il n'y a pas de passage.
 */
function passageAtTop(): { id: string; frac: number } | null {
  const passages = document.querySelectorAll<HTMLElement>('.journal-passage[id^="p-"]');
  // Le haut de l'écran est celui du conteneur qui défile (FramedScroll, sous
  // la barre du haut), pas celui de la fenêtre.
  const frame = document.querySelector('[data-scroll-container]')?.getBoundingClientRect().top ?? 0;
  for (let i = 0; i < passages.length; i++) {
    const box = passages[i].getBoundingClientRect();
    if (box.bottom <= frame + PASSAGE_TOP) continue;
    if (i === 0 && box.top >= frame) return null;
    // La part du paragraphe déjà passée sous le haut de l'écran (0 s'il commence en dessous).
    const frac = box.height > 0 ? Math.min(1, Math.max(0, (frame + PASSAGE_TOP - box.top) / box.height)) : 0;
    return { id: passages[i].id, frac };
  }
  return null;
}

export function LanguageSwitch({
  lang,
  alternates,
  heading = false,
  end = false,
}: {
  lang: Lang;
  alternates: Alternates;
  /** `true` : l'en-tête « Langue » des colonnes de filtres (accueil). */
  heading?: boolean;
  /**
   * `true` : les drapeaux se serrent au fer droit (rangée mobile de
   * l'accueil, 2026-10-24 — répartis sur toute la largeur, ils laissaient
   * trop de vide entre eux).
   */
  end?: boolean;
}) {
  const t = DICT[lang];
  // Hors en-tête, la rangée se justifie sur la largeur qu'on lui donne : dans
  // le rail d'un article, celle du bouton Back (PageShell).
  const row = (
    <ul className={cn('flex items-center gap-x-4', end ? 'justify-end' : !heading && 'justify-between')}>
      {LANGS.map((l) => {
        const here = l === lang;
        const href = alternates[l];
        const label = (
          <>
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
            <ChevronUp
              size={14}
              strokeWidth={2.75}
              aria-hidden
              className="text-[var(--color-fg)]"
              style={{ opacity: here ? 1 : 0 }}
            />
            <span className="sr-only">{LOCALE[l].native}</span>
          </>
        );
        const base = 'flex flex-col items-center gap-[4px] leading-none';
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
                onClick={(e) => {
                  rememberLang(l);
                  const at = passageAtTop();
                  // Carte : le nœud choisi voyage dans l'adresse ; article : le paragraphe.
                  e.currentTarget.hash = at ? at.id : location.hash.startsWith(`#${HASH_KEY}=`) ? location.hash.slice(1) : '';
                  announceSwitch(l);
                  if (at) patchSwitch({ passage: at });
                }}
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
      {/* Souligné noir et serré, comme « Sommaire » dans le rail d'un article
          (2026-10-25). 16 + les 6 du drapeau : filet → drapeaux = drapeaux →
          filet suivant, le chevron pendant dessous (`JournalIndex`). */}
      <span
        className={cn(MICRO_LABEL, 'leading-none text-[var(--color-fg-muted)]')}
        style={{ paddingBottom: 4, borderBottom: '1px solid var(--color-fg)' }}
      >
        {t.language}
      </span>
      <div style={{ paddingTop: 16 }}>{row}</div>
    </nav>
  );
}
