import type { Metadata } from 'next';
import { ArticlePreview } from '@/components/journal/ArticlePreview';

/**
 * L'APERÇU D'UN BROUILLON — page vide du blog, que l'onglet « Aperçu » du
 * Studio remplit (sanity/preview/ArticlePreviewView.tsx). Hors sitemap,
 * jamais indexée : elle n'a de contenu que dans le Studio.
 */
export const metadata: Metadata = {
  title: 'Aperçu',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ArticlePreview />;
}
