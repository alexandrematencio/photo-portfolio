import type { Metadata } from 'next';
import { JournalConceptMap, conceptMapMetadata } from '@/components/journal/pages';

/** La Concept Map du journal — en (components/journal/pages.tsx). */
export async function generateMetadata(): Promise<Metadata> {
  return conceptMapMetadata('en');
}

export default function Page() {
  return <JournalConceptMap lang="en" />;
}
