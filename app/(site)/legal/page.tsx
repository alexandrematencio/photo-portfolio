import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Legal Notice',
  description: 'Legal information for amatencio.photo.',
  path: '/legal',
});

const EMAIL = 'amatencio@pm.me';

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
          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]">
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

          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]">
            Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            INTELLECTUAL PROPERTY
          </h2>

          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]">
            All photographs and texts published on this site are protected by copyright. Any reproduction, even partial, is forbidden without prior written authorization.
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            CONTACT
          </h2>

          <a
            href={`mailto:${EMAIL}`}
            className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)] underline underline-offset-[6px] decoration-2 hover:opacity-60 transition-opacity motion-reduce:transition-none w-fit"
          >
            {EMAIL}
          </a>
        </div>
      </div>
    </article>
  );
}
