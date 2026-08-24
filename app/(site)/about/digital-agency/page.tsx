import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { EDITORIAL_BODY } from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

export const metadata = buildMetadata({
  title: 'Digital Agency',
  description:
    'Digital agency services — strategy, design, photography, production.',
  path: '/about/digital-agency',
});

export const revalidate = 300;

// Fallback only — used when `siteSettings.digitalAgencyBody` is empty. The page
// is edited from Studio (Réglages du site → Page « Digital Agency »). Don't
// grow this fallback to mirror published content — CLAUDE.md §8.5.
const FALLBACK = `Edit this copy from Studio (Réglages du site → Page « Digital Agency ») to take over.`;

export default async function DigitalAgencyPage() {
  const settings = await getSiteSettings();
  const body = settings?.digitalAgencyBody;

  return (
    <PageShell title="DIGITAL AGENCY">
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
