'use client';

import { useEffect, useState, type RefObject } from 'react';
import { List, Network } from 'lucide-react';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * La pastille « Carte » / « Liste » du téléphone (2026-11-02, Alexandre).
 *
 * Sous 768 px, la Concept Map s'ouvre en liste : 174 nœuds tiennent mal sur
 * 390 px. Mais la seule porte vers la carte était une icône muette du bandeau
 * des filtres — une page qui s'appelle « Concept Map » sans jamais montrer de
 * carte. Le motif retenu est celui des applis de réservation et de cartes
 * (Airbnb, Booking, Google Maps local) : un bouton en bas au centre, libellé
 * en clair, qui nomme la vue où il MÈNE. Préféré à une modale au chargement :
 * la décision se défait d'un geste, elle n'a pas à interrompre.
 *
 * Deux poses, une seule pastille :
 * - en liste (`floating`), elle flotte au bas de l'écran tant que la liste
 *   passe DERRIÈRE elle — ni sur le titre, ni sur le pied de page sombre, où
 *   l'encre ne se lirait plus ;
 * - sur la carte, elle se pose dans le cadre, en bas au centre, comme les
 *   touches de zoom à sa droite : la carte est moins haute que l'écran, une
 *   pastille fixe tomberait sur le pied de page.
 *
 * Entrée 250 ms ease-out (monte de 12 px), sortie 150 ms ease-in : petit
 * objet, sortie plus courte que l'entrée. Rentrée quand le tiroir des filtres
 * est levé.
 */

/** La bande où se pose la pastille flottante, mesurée depuis le bas de l'écran. */
const BAND_BOTTOM = 20;
const BAND_HEIGHT = 44;

export function MapViewPill({
  to,
  floating,
  stage,
  hidden,
  labels,
  onPick,
}: {
  /** La vue où mène la pastille. */
  to: 'map' | 'list';
  floating: boolean;
  /** Ce qui doit passer derrière la pastille flottante pour qu'elle paraisse. */
  stage?: RefObject<HTMLElement | null>;
  /** Le tiroir des filtres est levé : la pastille lui laisse la place. */
  hidden: boolean;
  labels: { map: string; list: string };
  onPick: (v: 'map' | 'list') => void;
}) {
  const [behind, setBehind] = useState(!floating);
  useEffect(() => {
    const el = stage?.current;
    if (!floating || !el) return;
    // La racine est réduite à la bande de la pastille : visible si et seulement
    // si la scène couvre cette bande.
    let io: IntersectionObserver | null = null;
    const watch = () => {
      io?.disconnect();
      const top = Math.max(0, window.innerHeight - BAND_BOTTOM - BAND_HEIGHT);
      io = new IntersectionObserver(([e]) => setBehind(e.isIntersecting), { rootMargin: `-${top}px 0px -${BAND_BOTTOM}px 0px` });
      io.observe(el);
    };
    watch();
    window.addEventListener('resize', watch);
    return () => {
      window.removeEventListener('resize', watch);
      io?.disconnect();
    };
  }, [floating, stage]);

  const on = behind && !hidden;
  const Icon = to === 'map' ? Network : List;

  return (
    <div
      className={cn('pointer-events-none inset-x-0 z-30 flex justify-center md:hidden', floating ? 'fixed' : 'absolute')}
      style={{ bottom: floating ? `calc(${BAND_BOTTOM}px + env(safe-area-inset-bottom))` : 12 }}
    >
      <button
        type="button"
        onClick={() => onPick(to)}
        tabIndex={on ? 0 : -1}
        aria-hidden={!on}
        className={cn(
          MICRO_LABEL,
          'flex items-center gap-2 bg-[var(--color-fg)] text-[var(--color-bg)] shadow-[0_2px_10px_rgba(10,10,10,0.22)] transition-[opacity,translate] motion-reduce:transition-none',
          on ? 'pointer-events-auto translate-y-0 opacity-100 duration-[250ms] ease-out' : 'translate-y-3 opacity-0 duration-150 ease-in',
        )}
        style={{ minHeight: BAND_HEIGHT, padding: '0 20px 0 16px' }}
      >
        <Icon aria-hidden size={16} strokeWidth={2} />
        {to === 'map' ? labels.map : labels.list}
      </button>
    </div>
  );
}
