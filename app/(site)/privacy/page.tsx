import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description: 'How personal data is handled on amatencio.photo.',
  path: '/privacy',
});

const EMAIL = 'amatencio@pm.me';

export default function PrivacyPage() {
  return (
    <article
      className="max-w-[1107px]"
      style={{ paddingLeft: 32, paddingRight: 32 }}
    >
      <div className="flex flex-col gap-10 md:gap-14">
        <h1 className="text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em] leading-none pb-2 md:pb-4 text-[var(--color-fg)]">
          PRIVACY
        </h1>

        <div className="flex flex-col gap-8">
          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]">
            Placeholder. Final wording must comply with GDPR (EU 2016/679) and the French CNIL guidelines before going live.
          </p>

          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]">
            amatencio.photo sets no non-essential cookies and collects no personal data without explicit consent. The only data processed is what you voluntarily send by email when getting in touch.
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            YOUR RIGHTS
          </h2>

          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]">
            Under articles 15 to 22 of the GDPR, you have rights to access, rectification, erasure, objection, restriction and portability of your data. To exercise them, write to{' '}
            <a
              href={`mailto:${EMAIL}`}
              className="underline underline-offset-[6px] decoration-2 hover:opacity-60 transition-opacity motion-reduce:transition-none"
            >
              {EMAIL}
            </a>
            .
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            IMAGE RIGHTS
          </h2>

          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)] pb-4 md:pb-8">
            If you believe you appear on a published photograph without your consent, contact us to request its removal. Maximum processing time: 30 days.
          </p>
        </div>
      </div>
    </article>
  );
}
