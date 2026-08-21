import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { EDITORIAL_BODY } from '@/lib/site/typography';

export const metadata = buildMetadata({
  title: 'About',
  description:
    "A. Matencio’s approach — author photography between street, landscape and portrait.",
  path: '/about',
});

export const revalidate = 300;

// Fallback only — used when `siteSettings.aboutBody` is empty (initial Sanity
// state, or local dev without a configured client). CLAUDE.md §8.5: Sanity is
// the single source of truth for every editable section here (bio, gear, lens
// lists, anything the photographer might rephrase). Don't grow this fallback
// to mirror current Sanity content — that would re-introduce the divergence
// bug it exists to prevent.
const BIO_FALLBACK = `I’m 🇫🇷🇪🇸🇻🇳, I grew up in the 🇳🇱, and worked in 🇹🇳 🇻🇳 and now in 🇫🇷.

Art Director for 8 years, photographer by way of cinema. Edit this copy from Studio (Réglages du site → Page "About") to take over.`;

export default async function AboutPage() {
  const settings = await getSiteSettings();
  const aboutBody = settings?.aboutBody;

  return (
    <article
      className="max-w-[1107px]"
      style={{ paddingLeft: 32, paddingRight: 32 }}
    >
      <div className="flex flex-col gap-10 md:gap-14">
        <h1 className="text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em] leading-none pb-2 md:pb-4 text-[var(--color-fg)]">
          ABOUT
        </h1>

        <PortableBody
          value={aboutBody}
          variant="editorial"
          fallback={
            <p className={`${EDITORIAL_BODY} whitespace-pre-line`}>
              {BIO_FALLBACK}
            </p>
          }
        />
      </div>
    </article>
  );
}
