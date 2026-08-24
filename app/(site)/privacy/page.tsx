import { buildMetadata } from '@/lib/seo/metadata';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import { EDITORIAL_BODY } from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description: 'How personal data is handled on amatencio.photo.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <PageShell title="PRIVACY">
      <div className="flex flex-col gap-8">
        <p className={EDITORIAL_BODY}>
          Placeholder. Final wording must comply with GDPR (EU 2016/679) and the French CNIL guidelines before going live.
        </p>

        <p className={EDITORIAL_BODY}>
          amatencio.photo sets no non-essential cookies and collects no personal data without explicit consent. The only data processed is what you voluntarily send by email when getting in touch.
        </p>

        <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
          YOUR RIGHTS
        </h2>

        <p className={EDITORIAL_BODY}>
          Under articles 15 to 22 of the GDPR, you have rights to access, rectification, erasure, objection, restriction and portability of your data. To exercise them,{' '}
          <ProtectedEmail className="underline underline-offset-[6px] decoration-2 hover:opacity-60 transition-opacity motion-reduce:transition-none">
            write to me directly
          </ProtectedEmail>
          .
        </p>

        <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
          IMAGE RIGHTS
        </h2>

        <p className={`${EDITORIAL_BODY} pb-4 md:pb-8`}>
          If you believe you appear on a published photograph without your consent, contact us to request its removal. Maximum processing time: 30 days.
        </p>
      </div>
    </PageShell>
  );
}
