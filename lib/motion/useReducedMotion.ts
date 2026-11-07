'use client';

import { useEffect, useState } from 'react';

/**
 * Hook qui détecte `prefers-reduced-motion: reduce`.
 * Retourne `true` quand l'utilisateur a activé la réduction des animations.
 * Conforme CLAUDE.md §3.2 — règle non-négociable.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abonnement à matchMedia, false avant hydratation (voulu)
    setReduced(media.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
