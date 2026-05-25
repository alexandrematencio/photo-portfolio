import { PageShell } from '@/components/site/PageShell';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Politique de confidentialité',
  description: 'Traitement des données personnelles du site amatencio.photo.',
  path: '/politique-de-confidentialite',
});

export default function PrivacyPage() {
  return (
    <PageShell
      title="Politique de confidentialité"
      subtitle="Stub — à compléter avant mise en ligne"
    >
      <div className="space-y-6 text-sm md:text-base text-[var(--color-fg)]/85 leading-relaxed">
        <p>
          <em className="text-[var(--color-fg-muted)]">
            Cette page est un placeholder à compléter avec un texte conforme au
            RGPD (UE 2016/679) et aux recommandations de la CNIL.
          </em>
        </p>
        <p>
          Le site amatencio.photo ne dépose aucun cookie non essentiel et ne
          recueille pas de données personnelles sans votre consentement explicite.
          Les seules données traitées sont celles que vous transmettez
          volontairement par email pour entrer en contact.
        </p>
        <h2 className="font-bold uppercase text-base md:text-lg tracking-tight mt-8">
          Vos droits
        </h2>
        <p>
          Conformément aux articles 15 à 22 du RGPD, vous disposez d'un droit
          d'accès, de rectification, d'effacement, d'opposition, de limitation
          et de portabilité sur vos données. Pour les exercer :{' '}
          <a className="underline" href="mailto:hello@amatencio.photo">
            hello@amatencio.photo
          </a>
          .
        </p>
        <h2 className="font-bold uppercase text-base md:text-lg tracking-tight mt-8">
          Droit à l'image
        </h2>
        <p>
          Si vous estimez apparaître sur une photographie publiée sans votre
          accord, contactez-nous pour demander son retrait. Le délai de
          traitement est de 30 jours maximum.
        </p>
      </div>
    </PageShell>
  );
}
