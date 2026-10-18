import type { Metadata } from 'next';
import { JournalHome, homeMetadata } from '@/components/journal/pages';

/** Accueil du journal (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata('fr');
}

export default function Page() {
  return <JournalHome lang="fr" />;
}
