import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/JsonLd';
import { PageShell } from '@/components/site/PageShell';
import { PortableBody } from '@/components/site/PortableBody';
import { SeriesPhotoGrid } from '@/components/series/page/SeriesPhotoGrid';
import { getSeriesTexts, getSeriesWithPhotos } from '@/lib/sanity/queries';
import { urlFor } from '@/lib/sanity/image';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, imageGalleryJsonLd } from '@/lib/seo/jsonld';
import { prepareSeries, seriesFacts } from '@/lib/site/series';
import { AUTHOR_NAME } from '@/lib/site/author';
import {
  EDITORIAL_ANNEX,
  EDITORIAL_LEAD,
  EDITORIAL_LINK_DECORATION,
  pageTitleFit,
} from '@/lib/site/typography';

/**
 * Page indexable d'UNE série — le chantier reporté de la spec /series §9.
 *
 * Pourquoi elle existe : `/series` est une expérience (rangée de piles, vols de
 * clones) dont l'URL n'ouvre aucune série (invariant 16), donc invisible pour un
 * moteur. Cette page est son pendant lisible : un titre, du texte, les photos en
 * vraies balises image avec `alt`, un `ImageGallery`, une adresse à soi. Elle ne
 * touche NI à l'expérience NI à son contrat d'URL.
 *
 * Export statique : `generateStaticParams` fixe la liste, `dynamicParams` à
 * `false` fait de toute autre adresse un 404.
 */
export const dynamicParams = false;
export const revalidate = 60;

async function load(slug: string) {
  const [{ items, seriesOrderRefs }, texts] = await Promise.all([
    getSeriesWithPhotos(),
    getSeriesTexts(),
  ]);
  const all = prepareSeries(items, seriesOrderRefs);
  const series = all.find((s) => s.slug === slug);
  return { all, series, text: texts.find((t) => t.slug === slug) };
}

export async function generateStaticParams() {
  const { items, seriesOrderRefs } = await getSeriesWithPhotos();
  return prepareSeries(items, seriesOrderRefs).map((s) => ({ slug: s.slug }));
}

function firstBlockText(value?: unknown[]): string {
  const block = (value ?? [])[0] as
    | { children?: { text?: string }[] }
    | undefined;
  return (block?.children ?? []).map((c) => c.text ?? '').join('').trim();
}

function metaDescription(
  title: string,
  facts: string,
  text?: { subtitle?: string; description?: unknown[] }
): string {
  const own = text?.subtitle?.trim() || firstBlockText(text?.description);
  if (own) return own.length > 160 ? `${own.slice(0, 157).trimEnd()}…` : own;
  return `${title} — ${facts}. Photographs by ${AUTHOR_NAME}.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { series, text } = await load(slug);
  if (!series) return {};
  const cover = series.cover.image ? urlFor(series.cover.image) : null;
  return buildMetadata({
    title: series.title,
    description: metaDescription(series.title, seriesFacts(series.photos), text),
    path: `/series/${slug}`,
    image: cover?.width(1200).height(630).fit('crop').auto('format').url(),
  });
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { all, series, text } = await load(slug);
  if (!series) notFound();

  const facts = seriesFacts(series.photos);
  const description = metaDescription(series.title, facts, text);
  const fit = pageTitleFit(series.title);
  const others = all.filter((s) => s.slug !== slug);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Series', path: '/series' },
            { name: series.title, path: `/series/${slug}` },
          ]),
          imageGalleryJsonLd({
            name: series.title,
            path: `/series/${slug}`,
            description,
            photos: series.photos,
          }),
        ]}
      />
      <PageShell
        title={fit < 1 ? <span style={{ fontSize: `${fit}em` }}>{series.title}</span> : series.title}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {text?.description && text.description.length > 0 ? (
              <PortableBody value={text.description} variant="editorial" />
            ) : text?.subtitle ? (
              <p className={EDITORIAL_LEAD}>{text.subtitle}</p>
            ) : null}
            <p className={EDITORIAL_ANNEX}>{facts}</p>
          </div>

          <SeriesPhotoGrid photos={series.photos} />

          {/* Cocon : chaque série renvoie aux autres, à l'expérience, à About
              et à Contact — une page sans lien entrant ni sortant ne se classe
              pas (CLAUDE.md §5 : pas de page orpheline). */}
          <nav aria-label="More series" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className={EDITORIAL_ANNEX}>
              <Link href="/series/" className={EDITORIAL_LINK_DECORATION}>
                Browse all series
              </Link>
              {' · '}
              <Link href="/about/" className={EDITORIAL_LINK_DECORATION}>
                About the photographer
              </Link>
              {' · '}
              <Link href="/contact/" className={EDITORIAL_LINK_DECORATION}>
                Licensing and contact
              </Link>
            </p>
            {others.length > 0 && (
              <p className={EDITORIAL_ANNEX}>
                {others.map((s, i) => (
                  <span key={s.slug}>
                    {i > 0 && ' · '}
                    <Link href={`/series/${s.slug}/`} className={EDITORIAL_LINK_DECORATION}>
                      {s.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </nav>
        </div>
      </PageShell>
    </>
  );
}
