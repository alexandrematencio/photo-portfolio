import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Contact',
  description: 'Get in touch with A. Matencio.',
  path: '/contact',
});

export const revalidate = 300;

const EMAIL = 'hello@amatencio.photo';

export default function ContactPage() {
  return (
    <article
      className="max-w-[1107px]"
      style={{ paddingLeft: 32, paddingRight: 32 }}
    >
      <div className="flex flex-col gap-10 md:gap-14">
        <h1 className="text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em] leading-none pb-2 md:pb-4 text-[var(--color-fg)]">
          CONTACT
        </h1>

        <div className="flex flex-col gap-8">
          <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]">
            For any enquiry — press, exhibitions, prints, editorial collaboration — write.
          </p>

          <h2 className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]">
            EMAIL
          </h2>

          <a
            href={`mailto:${EMAIL}`}
            className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)] underline underline-offset-[6px] decoration-2 hover:opacity-60 transition-opacity motion-reduce:transition-none w-fit"
          >
            {EMAIL}
          </a>

          <div className="flex flex-col pb-4 md:pb-8">
            <h3 className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.375] text-[var(--color-fg)]">
              The rest
            </h3>
            <p className="text-[17px] md:text-[24px] font-bold tracking-[-0.02em] leading-[1.46] text-[var(--color-fg)] whitespace-pre-line">
              {`+ Usual response time: 48 to 72 hours.
+ Studio in [city], travel across France and worldwide.`}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
