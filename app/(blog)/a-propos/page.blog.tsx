import type { Metadata } from 'next';
import { JournalAbout, aboutMetadata } from '@/components/journal/pages';

/** À propos de ce journal — fr (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return aboutMetadata('fr');
}

export default function Page() {
  return <JournalAbout lang="fr" />;
}
