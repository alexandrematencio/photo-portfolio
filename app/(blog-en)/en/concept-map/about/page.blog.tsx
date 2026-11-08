import type { Metadata } from 'next';
import { JournalMapAbout, mapAboutMetadata } from '@/components/journal/pages';

/** À propos de la Concept Map — en (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return mapAboutMetadata('en');
}

export default function Page() {
  return <JournalMapAbout lang="en" />;
}
