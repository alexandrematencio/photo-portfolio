'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { backGoesBack } from '@/components/journal/BackLink';
import { LANGS, homePath } from '@/lib/journal/i18n';
import { isSamePage } from '@/lib/site/nav';
import { announcePageArrival, isExiting, pushAway } from '@/lib/site/page-transition';

/**
 * Retour à l'accueil du journal depuis une autre de ses pages (essai du
 * 2026-10-27, demande Alexandre) : la page quittée sort par la DROITE,
 * l'accueil entre par la GAUCHE — on revient « en arrière ».
 *
 * La mécanique est celle des transitions latérales du portfolio
 * (`lib/site/page-transition.ts`) : copie de la page qui glisse, témoin
 * laissé à `PageArrival` qui fait entrer l'accueil. Seul le déclenchement
 * est propre au journal — on ne le pose pas sur chaque lien (logo, menu,
 * « Back », thématique d'un article, bouton Retour du navigateur…) : on
 * regarde OÙ va la navigation.
 *
 * - Clic sur un lien vers l'accueil. Pas de test sur `defaultPrevented` :
 *   `next/link` annule TOUJOURS le clic natif pour naviguer lui-même. « Back »
 *   est l'exception — quand il remonte l'historique, sa vraie destination
 *   n'est pas son `href` : on le laisse au `popstate`.
 * - `popstate` : l'historique ramène à l'accueil. Écouté après celui du
 *   routeur, qui ne fait que programmer le rendu — la page quittée est
 *   encore là quand on la copie.
 *
 * Mouvement réduit : rien, la navigation reste instantanée.
 */
const isHome = (path: string) => LANGS.some((l) => isSamePage(homePath(l), path));

export function HomeReturn() {
  const pathname = usePathname();
  const current = useRef(pathname);
  useEffect(() => {
    current.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const leave = (to: string) => {
      if (isExiting() || isHome(current.current) || !isHome(to)) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const page = document.querySelector<HTMLElement>('[data-scroll-container]');
      if (!page) return;
      announcePageArrival(to, -1);
      pushAway(page, 1);
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      if (a.hasAttribute('data-back-link') && backGoesBack()) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      leave(url.pathname);
    };
    const onPop = () => leave(location.pathname);

    window.addEventListener('click', onClick);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  return null;
}
