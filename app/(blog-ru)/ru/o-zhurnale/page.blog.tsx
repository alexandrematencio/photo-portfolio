import type { Metadata } from 'next';
import { JournalAbout, aboutMetadata } from '@/components/journal/pages';

/** À propos de ce journal — ru (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return aboutMetadata('ru');
}

export default function Page() {
  return <JournalAbout lang="ru" />;
}
