import type { Metadata } from 'next';
import { JournalConceptMap, conceptMapMetadata } from '@/components/journal/pages';

/** La Concept Map du journal (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return conceptMapMetadata('fr');
}

export default function Page() {
  return <JournalConceptMap lang="fr" />;
}
