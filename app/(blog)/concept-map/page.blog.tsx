import type { Metadata } from 'next';
import { JournalConceptMap, conceptMapMetadata } from '@/components/journal/pages';

/** La Concept Map du journal — fr seulement (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return conceptMapMetadata();
}

export default function Page() {
  return <JournalConceptMap />;
}
