import type { Metadata } from 'next';
import { JournalArticle, articleMetadata, articleParams } from '@/components/journal/pages';

/** Un article du journal — ru (components/journal/pages.tsx). */
export const dynamicParams = false;

export function generateStaticParams() {
  return articleParams('ru');
}

type Props = { params: Promise<{ slug: string }> };

export function generateMetadata(props: Props): Promise<Metadata> {
  return articleMetadata('ru', props);
}

export default function Page(props: Props) {
  return <JournalArticle lang="ru" {...props} />;
}
