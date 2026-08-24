import { buildMetadata } from '@/lib/seo/metadata';
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

export default function PrivacyPage() {
  return (
    <PageShell title="PRIVACY">
      <div className="flex flex-col gap-6">
        <p className={EDITORIAL_LEAD}>
          Placeholder. Final wording must comply with GDPR (EU 2016/679) and the French CNIL guidelines before going live.
        </p>

        <p className={EDITORIAL_BODY}>
          amatencio.photo sets no non-essential cookies and collects no personal data without explicit consent. The only data processed is what you voluntarily send by email when getting in touch.
        </p>

        <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
          YOUR RIGHTS
        </h2>

        <p className={EDITORIAL_BODY}>
          Under articles 15 to 22 of the GDPR, you have rights to access, rectification, erasure, objection, restriction and portability of your data. To exercise them,{' '}
          {/* Lien INLINE dans un paragraphe : la décoration partagée, jamais
              une chaîne recopiée (§7.5) — la copie qui vivait ici avait déjà
              dérivé (survol en opacité là où tout le site fonce la couleur). */}
          <ProtectedEmail className={EDITORIAL_LINK_DECORATION}>
            write to me directly
          </ProtectedEmail>
          .
        </p>

        <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
          IMAGE RIGHTS
        </h2>

        <p className={`${EDITORIAL_BODY} pb-4 md:pb-8`}>
          If you believe you appear on a published photograph without your consent, contact us to request its removal. Maximum processing time: 30 days.
        </p>
      </div>
    </PageShell>
  );
}
