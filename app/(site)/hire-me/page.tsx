import { PageShell } from '@/components/site/PageShell';
import { PortableBody } from '@/components/site/PortableBody';
import { getSiteSettings } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Hire Me',
  description:
    'Prestations commerciales — commandes, reportages, portraits, collaborations.',
  path: '/hire-me',
});

export const revalidate = 300;

export default async function HirePage() {
  const settings = await getSiteSettings();
  return (
    <PageShell title="Hire Me" subtitle="Prestations & commandes">
      <PortableBody
        value={settings?.hireBody}
        fallback={
          <div className="space-y-6 text-[var(--color-fg)]/85 text-base md:text-lg leading-relaxed">
            <p>
              <em className="text-[var(--color-fg-muted)]">
                [Placeholder — à remplir dans /studio]
              </em>
            </p>
            <p>
              Disponible pour des commandes éditoriales et corporate :
            </p>
            <ul className="space-y-3 list-none pl-0">
              <li>— Portraits d'auteur (presse, livres, fondations).</li>
              <li>— Reportages photographiques (architecture, territoires, expéditions).</li>
              <li>— Campagnes (mode, hôtellerie, gastronomie).</li>
              <li>— Tirages d'art & expositions.</li>
            </ul>
            <h2 className="mt-12 mb-4 font-bold uppercase text-xl md:text-2xl tracking-tight">
              Tarifs
            </h2>
            <p>
              Devis sur mesure. Une demi-journée à partir de [montant]. Voyages et droits sur devis.
            </p>
            <p className="mt-10">
              <a
                href="mailto:hello@amatencio.photo?subject=Demande%20de%20devis"
                className="inline-block border border-[var(--color-fg)] px-8 py-3 text-xs uppercase tracking-[0.25em] hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)] transition-colors motion-reduce:transition-none"
              >
                Demander un devis
              </a>
            </p>
          </div>
        }
      />
    </PageShell>
  );
}
