'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PreparedSeries } from '@/lib/site/series';
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
 * ⚠️ **L'URL N'OUVRE PLUS RIEN, ET N'ENREGISTRE PLUS RIEN** (demande Alexandre,
 * 2026-08-23). La page s'ouvrait sur l'état ouvert quand l'URL portait une
 * ancre `#<slug>`, et écrivait cette ancre en `replaceState` à chaque
 * ouverture. Les deux moitiés sont retirées ENSEMBLE, et il faut les garder
 * ensemble : une ancre écrite mais plus lue produirait une URL qui ment sur ce
 * qu'elle restaure, et c'est précisément ce qui a fait le bug.
 *
 * Le symptôme : arriver sur /series et tomber directement dans une série,
 * toujours la même. Tous les chemins INTERNES étaient pourtant propres —
 * vérifié au navigateur, ouverture/fermeture, logo, menu, retour navigateur,
 * changement de série, en desktop comme en mobile : l'ancre était bien retirée
 * à chaque fois. Ce qui restait, c'est le navigateur lui-même — une
 * autocomplétion de la barre d'adresse, un onglet restauré, un signet : l'URL
 * `/series/#olympiades` avait été écrite une fois, elle vivait sa vie, et
 * chaque rechargement rouvrait la série. Une page dont l'état d'accueil dépend
 * de l'historique du navigateur n'est pas rattrapable chemin par chemin ;
 * l'entrée doit être inconditionnelle.
 *
 * Un fragment qui traîne est donc EFFACÉ au montage : les URL déjà semées dans
 * les historiques se soignent d'elles-mêmes à la première visite.
 *
 * Ce qui disparaît avec : le lien partageable `/series#<slug>`. Il n'était de
 * toute façon pas indexable (une ancre est invisible pour un moteur) et rien
 * ne le consommait — ni le Studio, ni le sitemap. Le vrai lien profond par
 * série reste le chantier `/series/[slug]`, cadré dans la spec §9.
 */
export function SeriesExperience({ series }: { series: PreparedSeries[] }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Nettoyage d'un fragment hérité (autocomplétion, onglet restauré, signet).
    // `replaceState` et non `location.hash = ''` : le second laisse un `#` nu
    // dans la barre d'adresse ET empile une entrée d'historique.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search
      );
    }
    setHydrated(true);
  }, []);

  // `photoIndex` : photo d'arrivée. 0 par défaut (clic sur une pile, un nom) ;
  // la navigation clavier entre « à reculons » dans une série (flèche gauche
  // depuis la première photo) et arrive alors sur sa dernière photo.
  const open = useCallback((slug: string, photoIndex = 0) => {
    setOpenSlug(slug);
    setActiveIndex(photoIndex);
  }, []);

  const close = useCallback(() => {
    setOpenSlug(null);
  }, []);

  /**
   * Clic sur « Series » alors qu'on est DÉJÀ sur /series → retour à l'accueil
   * de la page : la rangée de covers en bas d'écran en desktop, la liste en
   * mobile. Next ne remonte pas la page pour une navigation vers elle-même,
   * donc sans cet écouteur la série ouverte le restait et le menu semblait
   * ne rien faire (signalé le 2026-08-23).
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
