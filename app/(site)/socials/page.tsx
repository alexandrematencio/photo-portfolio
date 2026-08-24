import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { EDITORIAL_BODY } from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

export const metadata = buildMetadata({
  title: 'Socials',
  description:
    'Where to find A. Matencio across social platforms.',
  path: '/socials',
});

export const revalidate = 300;

// Fallback only — used when `siteSettings.socialsBody` is empty. The page is
// edited from Studio (Réglages du site → Page « Socials »). CLAUDE.md §8.5.
const FALLBACK = `Edit this copy from Studio (Réglages du site → Page « Socials ») to take over.`;

export default async function SocialsPage() {
  const settings = await getSiteSettings();
  const body = settings?.socialsBody;

  return (
    <PageShell title="SOCIALS">
      <PortableBody
        value={body}
        variant="editorial"
        fallback={
          <p className={`${EDITORIAL_BODY} whitespace-pre-line`}>
            {FALLBACK}
          </p>
        }
      />
    </PageShell>
  );
}
