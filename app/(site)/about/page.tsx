import { PageShell } from '@/components/site/PageShell';
import { PortableBody } from '@/components/site/PortableBody';
import { getSiteSettings } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'About',
  description:
    "Démarche d'A. Matencio — photographie d'auteur entre rue, paysage et portrait.",
  path: '/about',
});

export const revalidate = 300;

export default async function AboutPage() {
  const settings = await getSiteSettings();
  return (
    <PageShell title="About" subtitle="Démarche & parcours">
      <PortableBody
        value={settings?.aboutBody}
        fallback={
          <div className="space-y-5 text-[var(--color-fg)]/85 text-base md:text-lg leading-relaxed">
            <p>
              <em className="text-[var(--color-fg-muted)]">
                [Placeholder — à remplir dans /studio]
              </em>
            </p>
            <p>
              A. Matencio est photographe d'auteur. Son travail explore la rue, le paysage et le portrait — trois disciplines qu'il aborde comme trois manières d'écouter ce qui est déjà là, plutôt que de produire ce qui n'y est pas.
            </p>
            <p>
              Né en [année], il photographie depuis [année] entre [villes / régions]. Ses séries ont été présentées à [galeries / festivals / publications].
            </p>
            <p>
              La démarche tient en une phrase : <em>regarder lentement, déclencher juste</em>. Pas de mise en scène, pas de filtre. Le numérique comme un négatif silencieux.
            </p>
            <h2 className="mt-12 mb-4 font-bold uppercase text-xl md:text-2xl tracking-tight">
              Expositions
            </h2>
            <p>[Liste à compléter via le CMS.]</p>
            <h2 className="mt-12 mb-4 font-bold uppercase text-xl md:text-2xl tracking-tight">
              Publications
            </h2>
            <p>[Liste à compléter via le CMS.]</p>
          </div>
        }
      />
    </PageShell>
  );
}
