import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import {
  EDITORIAL_BODY,
  EDITORIAL_H2,
  EDITORIAL_LEAD,
  EDITORIAL_LINK_DECORATION,
} from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

/** Cf. `/legal` — même raison : rétablir l'asymétrie d'un titre dans une
 *  colonne à `gap` uniforme (24 + 40 = `RHYTHM.h2Top`). */
const SECTION_TOP = 40;

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description: 'How personal data is handled on amatencio.photo.',
  path: '/privacy',
});

export const revalidate = 300;

/** Repli, affiché tant que `siteSettings.privacyBody` est vide (CLAUDE.md §8.5). */
function PrivacyFallback() {
  return (
    <div className="flex flex-col gap-6">
      <p className={EDITORIAL_LEAD}>
        This site sets no cookies and runs no analytics. The only personal data
        it processes is what you choose to send by email when getting in touch.
      </p>

      <p className={EDITORIAL_BODY}>
        Pages are served by GitHub, Inc. (USA) and images by Sanity AS (Norway).
        Their servers may record technical logs (IP address, browser) for
        security purposes, under their own data-protection terms; this may
        involve a transfer outside the European Union covered by standard
        contractual clauses.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        YOUR RIGHTS
      </h2>

      <p className={EDITORIAL_BODY}>
        Under articles 15 to 22 of the GDPR, you have rights to access,
        rectification, erasure, objection, restriction and portability of your
        data. To exercise them,{' '}
        {/* Lien INLINE dans un paragraphe : la décoration partagée, jamais une
            chaîne recopiée (§7.5). */}
        <ProtectedEmail className={EDITORIAL_LINK_DECORATION}>
          write to me directly
        </ProtectedEmail>
        . You may also lodge a complaint with the CNIL (cnil.fr).
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        IMAGE RIGHTS
      </h2>

      <p className={`${EDITORIAL_BODY} pb-4 md:pb-8`}>
        If you believe you appear on a published photograph without your
        consent, contact me to request its removal. Maximum processing time:
        30 days.
      </p>
    </div>
  );
}

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  return (
    <PageShell title="PRIVACY">
      <PortableBody
        value={settings?.privacyBody}
        variant="editorial"
        fallback={<PrivacyFallback />}
      />
    </PageShell>
  );
}
