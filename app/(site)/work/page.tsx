import { PageShell } from '@/components/site/PageShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { WorkCarousels } from '@/components/work/WorkCarousels';
import { getSeriesWithPhotos } from '@/lib/sanity/queries';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, imageGalleryJsonLd, pageUrl } from '@/lib/seo/jsonld';
import { splitSeriesAndWork } from '@/lib/site/series';
import { MICRO_LABEL } from '@/lib/site/typography';

/**
 * /work — l'étage entre /series (des récits) et /archives (le fonds complet) :
 * des collections par genre, une par onglet. Contenu : `workPage.collections`
 * (Studio, rubrique « Pages »), cf. `sanity/schemas/pages.ts`.
 */
export const metadata = buildMetadata({
  title: 'Work',
  description:
    'Selected photographs by Alexandre Matencio, sorted by genre: street photography, portraits, architecture and shapes, quiet realism.',
  path: '/work',
});

export const revalidate = 60;

/**
 * Corps du titre = celui du lettrage « SERIES » de /series (272,63 px de corps pour 1000 de large de
 * boîte, boîte à 58 % de la page, plafonnée à 1076 — cf. `SeriesWordmark` et `useWordmarkFold`).
 * `max()` avec le corps de page : sous `md`, où /series revient au titre ordinaire, /work aussi.
 */
const WORK_TITLE_SIZE =
  'max(var(--page-title-size), calc(min(0.58 * (100vw - 2 * var(--page-gutter)), 1076px) * 0.27263))';

export default async function WorkPage() {
  const { items, seriesOrderRefs, workRefs } = await getSeriesWithPhotos();
  const { work } = splitSeriesAndWork(items, seriesOrderRefs, workRefs);
  const total = work.reduce((n, c) => n + c.photos.length, 0);

  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Work', path: '/work' },
    ]),
    ...work.map((c) =>
      imageGalleryJsonLd({
        name: c.title,
        path: `/series/${c.slug}`,
        id: `${pageUrl('/work')}#work-${c.slug}`,
        description: c.subtitle,
        photos: c.photos,
      })
    ),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageShell
        bleed
        title="WORK"
        titleAlign="center"
        titleSize={WORK_TITLE_SIZE}
        subtitle={
          <p className={`${MICRO_LABEL} text-[var(--color-fg-muted)]`}>
            {work.length} collection{work.length === 1 ? '' : 's'} · {total} photo
            {total === 1 ? '' : 's'} · sorted by genre
          </p>
        }
      >
        {work.length > 0 ? (
          <WorkCarousels collections={work} />
        ) : (
          <p className="py-32 text-center text-sm text-[var(--color-fg-muted)]">
            No collections yet.
          </p>
        )}
      </PageShell>
    </>
  );
}
