'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreparedSeries } from '@/lib/site/series';
import { seriesSlugFromHash } from '@/lib/site/series';
import { SAME_PAGE_NAV_EVENT } from '@/lib/site/nav';
import { DesktopSeries } from './desktop/DesktopSeries';
import { MobileSeries } from './mobile/MobileSeries';

/**
 * Porteur d'état unique de la page /series (spec §4) : quelle série est
 * ouverte, quelle photo est affichée. Tout le reste en découle. Les branches
 * desktop et mobile ne partagent AUCUN code d'animation — seulement ces deux
 * morceaux d'état et les données.
 *
 * Les deux branches sont rendues côté serveur ; le CSS (`md:`) décide laquelle
 * est visible. Décision spec §4 : pas de détection de largeur en JS, qui
 * clignoterait à l'hydratation puisque le serveur ignore la taille d'écran.
 *
 * Ancre : `/series#<slug>` ↔ état ouvert. Lue au montage (lien partageable),
 * écrite en `replaceState` à chaque ouverture/fermeture — pas de `pushState`
 * ici : la pile d'historique mobile est gérée par modalHistory DANS la branche
 * mobile, et le desktop garde un historique propre (back = quitter la page).
 */
export function SeriesExperience({ series }: { series: PreparedSeries[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Ancre initiale consommée une seule fois — l'ouverture au chargement se
  // fait sans grande animation (on arrive sur un état, pas sur un geste).
  const initialSlugRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    initialSlugRef.current = seriesSlugFromHash(window.location.hash, series);
    if (initialSlugRef.current) {
      setOpenSlug(initialSlugRef.current);
      setActiveIndex(0);
    }
    setHydrated(true);
    // series est stable (props serveur) ; lecture unique au montage voulue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncHash = useCallback((slug: string | null) => {
    const url = slug
      ? `${window.location.pathname}#${slug}`
      : window.location.pathname;
    window.history.replaceState(window.history.state, '', url);
  }, []);

  // `photoIndex` : photo d'arrivée. 0 par défaut (clic sur une pile, un nom) ;
  // la navigation clavier entre « à reculons » dans une série (flèche gauche
  // depuis la première photo) et arrive alors sur sa dernière photo.
  const open = useCallback(
    (slug: string, photoIndex = 0) => {
      setOpenSlug(slug);
      setActiveIndex(photoIndex);
      syncHash(slug);
    },
    [syncHash]
  );

  const close = useCallback(() => {
    setOpenSlug(null);
    syncHash(null);
  }, [syncHash]);

  /**
   * Clic sur « Series » alors qu'on est DÉJÀ sur /series → retour à l'accueil
   * de la page : la rangée de covers en bas d'écran en desktop, la liste en
   * mobile. Next ne remonte pas la page pour une navigation vers elle-même,
   * donc sans cet écouteur la série ouverte le restait et le menu semblait
   * ne rien faire (signalé le 2026-08-23). Passe par `close()`, donc l'ancre
   * `#slug` est retirée de l'URL au passage.
   */
  useEffect(() => {
    const onSamePage = (e: Event) => {
      const href = (e as CustomEvent<{ href?: string }>).detail?.href;
      if (href === '/series') close();
    };
    window.addEventListener(SAME_PAGE_NAV_EVENT, onSamePage);
    return () => window.removeEventListener(SAME_PAGE_NAV_EVENT, onSamePage);
  }, [close]);

  const openSeries = openSlug
    ? (series.find((s) => s.slug === openSlug) ?? null)
    : null;

  return (
    <>
      <div className="hidden md:block">
        <DesktopSeries
          series={series}
          openSeries={openSeries}
          activeIndex={activeIndex}
          hydrated={hydrated}
          initialSlug={initialSlugRef.current}
          onOpen={open}
          onClose={close}
          onSelectPhoto={setActiveIndex}
        />
      </div>
      <div className="md:hidden">
        <MobileSeries
          series={series}
          openSeries={openSeries}
          activeIndex={activeIndex}
          onOpen={open}
          onClose={close}
          onSelectPhoto={setActiveIndex}
        />
      </div>
    </>
  );
}
