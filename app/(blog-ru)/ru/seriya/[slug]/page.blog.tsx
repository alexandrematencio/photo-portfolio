import type { Metadata } from 'next';
import { JournalSeriesPage, seriesMetadata, seriesParams } from '@/components/journal/pages';

/** La page d'une série du journal — ru (components/journal/pages.tsx). */
export const dynamicParams = false;

export function generateStaticParams() {
  return seriesParams('ru');
}

type Props = { params: Promise<{ slug: string }> };

export function generateMetadata(props: Props): Promise<Metadata> {
  return seriesMetadata('ru', props);
}

export default function Page(props: Props) {
  return <JournalSeriesPage lang="ru" {...props} />;
}
