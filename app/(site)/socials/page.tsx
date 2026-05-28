import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';

export const metadata = buildMetadata({
  title: 'Socials',
  description:
    'Where to find A. Matencio across social platforms.',
  path: '/socials',
});

export const revalidate = 300;

// Fallback only — used when `siteSettings.socialsBody` is empty. The page is
// edited from Studio (Réglages du site → Page « Socials »). CLAUDE.md §8.5.
const FALLBACK = `Edit this copy from Studio (Réglages du site → Page « Socials ») to take over.`;

export default async function SocialsPage() {
  const settings = await getSiteSettings();
  const body = settings?.socialsBody;

  return (
    <article
      className="max-w-[1107px]"
      style={{ paddingLeft: 32, paddingRight: 32 }}
    >
      <div className="flex flex-col gap-10 md:gap-14">
        <h1 className="text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em] leading-none pb-2 md:pb-4 text-[var(--color-fg)]">
          SOCIALS
        </h1>

        <PortableBody
          value={body}
          variant="editorial"
          fallback={
            <p className="text-[22px] md:text-[32px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)] whitespace-pre-line">
              {FALLBACK}
            </p>
          }
        />
      </div>
    </article>
  );
}
