import type { Metadata } from 'next';
import { JournalHome, homeMetadata } from '@/components/journal/pages';

/** Accueil du journal — en (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata('en');
}

export default function Page() {
  return <JournalHome lang="en" />;
}
