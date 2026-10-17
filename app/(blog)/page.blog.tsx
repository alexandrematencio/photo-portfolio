import type { Metadata } from 'next';
import { PageShell } from '@/components/site/PageShell';
import { JournalIndex } from '@/components/journal/JournalIndex';
import { getArticles, summarize } from '@/lib/journal/articles';
import { SITE_INFO, buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { blogJsonLd } from '@/lib/seo/journal-jsonld';

/**
 * Page d'accueil du journal (brand book §14.7), reprise de stripe.dev/blog —
 * racine de blog.amatencio.com. Indexée : c'est la page qui présente le
 * journal dans les résultats, et elle relie chaque article.
 */
export const metadata: Metadata = {
  ...buildMetadata({
    // Le nom du site EST le titre de cette page : pas de suffixe répété.
    absoluteTitle: SITE_INFO.name,
    path: '/',
  }),
};

export default async function JournalPage() {
  const articles = (await getArticles()).map(summarize);
  return (
    <>
      <JsonLd data={blogJsonLd(articles)} />
      <PageShell
        centered
        title={
          <>
            Journal
            {/* Le compteur en exposant, comme le « (123) » de Stripe. Gris :
                un compteur est une donnée, pas un état (§4.3). */}
            <sup
              aria-hidden
              className="font-bold tabular-nums text-[var(--color-fg-muted)]"
              style={{ fontSize: '0.24em', verticalAlign: 'top', position: 'relative', top: '0.35em', marginLeft: '0.15em' }}
            >
              ({articles.length})
            </sup>
            <span className="sr-only"> — {articles.length} articles</span>
          </>
        }
      >
        <JournalIndex articles={articles} />
      </PageShell>
    </>
  );
}
