import type { Metadata } from 'next';
import { JournalAbout, aboutMetadata } from '@/components/journal/pages';

/** À propos de ce journal — en (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return aboutMetadata('en');
}

export default function Page() {
  return <JournalAbout lang="en" />;
}
