import localFont from 'next/font/local';

/**
 * Inter, servie depuis le dépôt. `next/font/google` allait chercher les
 * fichiers chez Google À CHAQUE build : un échec réseau sur le VPS faisait
 * échouer le build lancé par un Publish, et la modif n'arrivait jamais en
 * ligne (payé le 2026-10-19). Mêmes fichiers statiques que Google servait,
 * découpés aux mêmes plages Unicode (fontTools, sans hinting).
 *
 * Deux jeux : le portfolio n'écrit qu'en latin ; le journal ajoute le
 * cyrillique pour le russe.
 */


// next/font/local exige des littéraux : la liste est écrite en entier.
export const interLatin = localFont({
  src: [
    { path: './inter/inter-400-normal-latin.woff2', weight: '400', style: 'normal' },
    { path: './inter/inter-400-italic-latin.woff2', weight: '400', style: 'italic' },
    { path: './inter/inter-500-normal-latin.woff2', weight: '500', style: 'normal' },
    { path: './inter/inter-500-italic-latin.woff2', weight: '500', style: 'italic' },
    { path: './inter/inter-700-normal-latin.woff2', weight: '700', style: 'normal' },
    { path: './inter/inter-700-italic-latin.woff2', weight: '700', style: 'italic' },
    { path: './inter/inter-900-normal-latin.woff2', weight: '900', style: 'normal' },
    { path: './inter/inter-900-italic-latin.woff2', weight: '900', style: 'italic' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const interLatinCyrillic = localFont({
  src: [
    { path: './inter/inter-400-normal-latin-cyrillic.woff2', weight: '400', style: 'normal' },
    { path: './inter/inter-400-italic-latin-cyrillic.woff2', weight: '400', style: 'italic' },
    { path: './inter/inter-500-normal-latin-cyrillic.woff2', weight: '500', style: 'normal' },
    { path: './inter/inter-500-italic-latin-cyrillic.woff2', weight: '500', style: 'italic' },
    { path: './inter/inter-700-normal-latin-cyrillic.woff2', weight: '700', style: 'normal' },
    { path: './inter/inter-700-italic-latin-cyrillic.woff2', weight: '700', style: 'italic' },
    { path: './inter/inter-900-normal-latin-cyrillic.woff2', weight: '900', style: 'normal' },
    { path: './inter/inter-900-italic-latin-cyrillic.woff2', weight: '900', style: 'italic' },
  ],
  variable: '--font-inter',
  display: 'swap',
});
