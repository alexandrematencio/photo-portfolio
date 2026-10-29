import localFont from 'next/font/local';

/**
 * Switzer (Indian Type Foundry, licence ITF Free Font), la voix des index de
 * la Concept Map, thèses/ et mécanismes/ (choix d'Alexandre, 2026-10-29).
 * Servie depuis le dépôt pour la même raison qu'Inter (cf. inter.ts) :
 * fichiers de Fontshare, tels quels.
 *
 * Latin seul : Switzer n'a pas de cyrillique. En russe, les entrées
 * retombent sur Inter (`--font-index`, globals.css).
 */
export const switzer = localFont({
  src: [
    { path: './switzer/switzer-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './switzer/switzer-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './switzer/switzer-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-switzer',
  display: 'swap',
  // Le navigateur ne la télécharge qu'à la première entrée d'index rendue.
  preload: false,
});
