import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { ContactForm } from '@/components/site/ContactForm';
import { CONTACT_FORM_ENABLED } from '@/lib/contact/config';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import { EDITORIAL_BODY, EDITORIAL_BODY_LINK } from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

export const metadata = buildMetadata({
  title: 'Contact',
  description: 'Get in touch with A. Matencio.',
  path: '/contact',
});

export const revalidate = 300;

// Repli SEUL — utilisé quand `siteSettings.contactBody` est vide (Sanity vierge,
// ou dev local sans client configuré). La page est éditée depuis le Studio
// (Réglages du site → Page « Contact »). CLAUDE.md §8.5 : ne pas faire grossir
// ce repli pour recopier le contenu publié, c'est exactement la divergence
// qu'il existe pour éviter. Le lien email y reste protégé (jamais d'adresse en
// clair dans le HTML exporté, cf. ProtectedEmail).
function ContactFallback() {
  return (
    <>
      <p className={`${EDITORIAL_BODY} whitespace-pre-line`}>
        For any enquiry — press, exhibitions, prints, editorial collaboration —
        write.
      </p>
      <ProtectedEmail className={EDITORIAL_BODY_LINK}>
        Write to me
      </ProtectedEmail>
    </>
  );
}

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <PageShell title="CONTACT">
      {/* UN seul enfant pour la coquille : son `gap` est l'écart titre → corps
          (96 px), il n'a pas à valoir entre deux blocs DU corps. Le texte du
          Studio et le formulaire gardent donc leur propre rythme, ici. */}
      <div className="flex flex-col gap-14">
        <PortableBody
          value={settings?.contactBody}
          variant="editorial"
          fallback={<ContactFallback />}
        />

        {/* Le formulaire se pose SOUS le texte du Studio, sans titre à lui :
            le titre qui l'annonce s'écrit dans le CMS, en fin de `contactBody`
            (§8.5 — pas de copie éditable en dur). Absent tant que le site est
            statique, cf. `lib/contact/config.ts`. */}
        {CONTACT_FORM_ENABLED && <ContactForm />}
      </div>
    </PageShell>
  );
}
