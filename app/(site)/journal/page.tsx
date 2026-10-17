import type { Metadata } from 'next';
import { PageShell } from '@/components/site/PageShell';
import { JournalIndex } from '@/components/journal/JournalIndex';
import { getArticles, summarize } from '@/lib/journal/articles';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Page d'accueil du journal (brand book §14.7), reprise de stripe.dev/blog.
 * MAQUETTE : `noindex` et hors sitemap tant que le journal n'est pas ouvert.
 */
export const metadata: Metadata = {
  ...buildMetadata({
    title: 'Journal',
    description: 'Textes de A. Matencio : marchés de collection, conscience.',
    path: '/journal',
  }),
  robots: { index: false, follow: false },
};

export default async function JournalPage() {
  const articles = (await getArticles()).map(summarize);
  return (
    <div lang="fr">
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
    </div>
  );
}
