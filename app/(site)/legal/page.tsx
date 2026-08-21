import { buildMetadata } from '@/lib/seo/metadata';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import { EDITORIAL_BODY, EDITORIAL_BODY_LINK } from '@/lib/site/typography';

export const metadata = buildMetadata({
  title: 'Legal Notice',
  description: 'Legal information for amatencio.photo.',
  path: '/legal',
});

export default function LegalPage() {
  return (
    <article
      className="max-w-[1107px]"
      style={{ paddingLeft: 32, paddingRight: 32 }}
    >
      <div className="flex flex-col gap-10 md:gap-14">
        <h1 className="text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em] leading-none pb-2 md:pb-4 text-[var(--color-fg)]">
          LEGAL NOTICE
        </h1>

        <div className="flex flex-col gap-8">
          <p className={EDITORIAL_BODY}>
            Placeholder. Before going live, fill in the details required by French law (LCEN, art. 6 III) and the EU regulations applicable to publishers established in the European Union.
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            PUBLISHER
          </h2>

          <div className="flex flex-col pb-4 md:pb-8">
            <h3 className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.375] text-[var(--color-fg)]">
              Editor of record
            </h3>
            <p className="text-[17px] md:text-[24px] font-bold tracking-[-0.02em] leading-[1.46] text-[var(--color-fg)] whitespace-pre-line">
              {`+ [Name / legal entity]
+ [Legal status, SIRET if applicable]
+ [Address]
+ [Email] · [Phone]
+ Publication director: [Name]`}
            </p>
          </div>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            HOSTING
          </h2>

          <p className={EDITORIAL_BODY}>
            Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            INTELLECTUAL PROPERTY
          </h2>

          <p className={EDITORIAL_BODY}>
            All photographs and texts published on this site are protected by copyright. Any reproduction, even partial, is forbidden without prior written authorization.
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            CONTACT
          </h2>

          <ProtectedEmail className={EDITORIAL_BODY_LINK}>
            Get in touch by email
          </ProtectedEmail>
        </div>
      </div>
    </article>
  );
}
