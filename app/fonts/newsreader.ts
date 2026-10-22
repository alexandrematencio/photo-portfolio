import localFont from 'next/font/local';

/**
 * Newsreader (Production Type), la voix des citations en exergue du journal
 * (choix d'Alexandre, 2026-10-22) — un serif éditorial face à Inter. Servie
 * depuis le dépôt pour la même raison qu'Inter (cf. inter.ts) : fichier
 * variable de fontsource, axes graisse ET taille optique — c'est l'axe
 * `opsz` qui lui donne son dessin de titrage aux grands corps.
 *
 * Latin seul : Newsreader n'a pas de cyrillique. En russe, les citations
 * passent au serif de repli (Times New Roman calé sur ses métriques).
 */
export const newsreader = localFont({
  src: [{ path: './newsreader/newsreader-opsz-normal-latin.woff2', weight: '200 800', style: 'normal' }],
  variable: '--font-newsreader',
  display: 'swap',
  // Le navigateur ne la télécharge qu'à la première citation rendue.
  preload: false,
  // Le repli calé sur ses métriques part d'Arial par défaut : le cyrillique
  // tombait en sans-serif. Un serif, pour que le russe garde la voix.
  adjustFontFallback: 'Times New Roman',
});
