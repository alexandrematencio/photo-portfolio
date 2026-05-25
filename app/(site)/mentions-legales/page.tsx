import { PageShell } from '@/components/site/PageShell';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Mentions légales',
  description: 'Informations légales du site amatencio.photo.',
  path: '/mentions-legales',
});

export default function LegalNoticePage() {
  return (
    <PageShell title="Mentions légales" subtitle="Stub — à compléter avant mise en ligne">
      <div className="space-y-6 text-sm md:text-base text-[var(--color-fg)]/85 leading-relaxed">
        <p>
          <em className="text-[var(--color-fg-muted)]">
            Cette page est un placeholder. Avant mise en production, complétez-la
            avec les informations exigées par la loi française pour la confiance
            dans l'économie numérique (LCEN, art. 6 III).
          </em>
        </p>
        <h2 className="font-bold uppercase text-base md:text-lg tracking-tight mt-8">
          Éditeur du site
        </h2>
        <p>
          [Nom / raison sociale]<br />
          [Statut juridique, SIRET le cas échéant]<br />
          [Adresse]<br />
          [Email] — [Téléphone]<br />
          Directeur de la publication : [Nom]
        </p>
        <h2 className="font-bold uppercase text-base md:text-lg tracking-tight mt-8">
          Hébergeur
        </h2>
        <p>
          Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.<br />
          <a className="underline" href="https://vercel.com">vercel.com</a>
        </p>
        <h2 className="font-bold uppercase text-base md:text-lg tracking-tight mt-8">
          Propriété intellectuelle
        </h2>
        <p>
          L'ensemble des photographies et textes publiés sur ce site sont
          protégés par le droit d'auteur. Toute reproduction, même partielle,
          est interdite sans autorisation écrite préalable.
        </p>
      </div>
    </PageShell>
  );
}
