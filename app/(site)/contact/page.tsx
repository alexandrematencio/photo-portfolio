import { PageShell } from '@/components/site/PageShell';
import { PortableBody } from '@/components/site/PortableBody';
import { getSiteSettings } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Contact',
  description: 'Prendre contact avec A. Matencio.',
  path: '/contact',
});

export const revalidate = 300;

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return (
    <PageShell title="Contact" subtitle="Restons en lien">
      <PortableBody
        value={settings?.contactBody}
        fallback={
          <div className="space-y-6 text-[var(--color-fg)]/85 text-base md:text-lg leading-relaxed">
            <p>
              <em className="text-[var(--color-fg-muted)]">
                [Placeholder — à remplir dans /studio]
              </em>
            </p>
            <p>
              Pour toute demande — presse, expositions, tirages, collaboration éditoriale — écrivez à :
            </p>
            <p>
              <a
                href="mailto:hello@amatencio.photo"
                className="underline underline-offset-4 text-lg md:text-xl"
              >
                hello@amatencio.photo
              </a>
            </p>
            <p className="text-sm text-[var(--color-fg-muted)]">
              Délai de réponse habituel : 48 à 72 heures.
            </p>
            <p className="text-sm text-[var(--color-fg-muted)]">
              Studio à [ville], déplacements possibles sur toute la France et à l'international.
            </p>
          </div>
        }
      />
    </PageShell>
  );
}
