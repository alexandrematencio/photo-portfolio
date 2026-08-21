'use client';

import { useEffect, useState } from 'react';

/**
 * `true` au-dessus du breakpoint `md` (768 px) — celui qui sépare les deux
 * branches de /series (préfixe `md:` dans SeriesExperience).
 *
 * Raison d'être : les DEUX branches restent toujours montées (le CSS en
 * affiche une, CLAUDE.md §3.7), et une <img> `eager` se télécharge MÊME dans
 * un sous-arbre en `display: none`. Chaque branche doit donc conditionner ses
 * images eager à SA visibilité. Mesuré avant correctif : 3 images de 1100 px
 * (bande mobile) téléchargées à chaque ouverture sur desktop, 1 image de
 * 1600 px (centre desktop) à chaque ouverture sur mobile. Une image `lazy`
 * d'une branche cachée, elle, ne charge jamais : pas de boîte, donc pas
 * d'intersection.
 *
 * Défaut `false` avant hydratation : sans conséquence, les images concernées
 * ne sont rendues qu'après un geste utilisateur, bien après le premier effet.
 */
export function useMdUp(): boolean {
  const [mdUp, setMdUp] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    setMdUp(media.matches);

    const onChange = (event: MediaQueryListEvent) => setMdUp(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return mdUp;
}
