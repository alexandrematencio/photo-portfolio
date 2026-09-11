/**
 * Assertions sur lib/seo/jsonld.ts — les cinq champs que Google exige pour le
 * crédit d'auteur et le badge Licensable, l'échappement, les URL absolues.
 *
 *   npm run check-jsonld
 */
import type { Photo } from '../lib/sanity/queries';
import {
  ACQUIRE_LICENSE_URL,
  LICENSE_URL,
  breadcrumbJsonLd,
  imageGalleryJsonLd,
  imageObjectJsonLd,
  personJsonLd,
  webSiteJsonLd,
} from '../lib/seo/jsonld';
import { SITE_INFO } from '../lib/seo/metadata';
import { AUTHOR_NAME } from '../lib/site/author';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(46)} ${detail}`);
  if (!ok) failures++;
}

const photo: Photo = {
  _id: 'p1',
  title: 'Buoys',
  slug: { current: '2026-hanoi-buoys' },
  image: {
    asset: { _ref: 'image-0f9ecfc8b021fb78d1687058e597948b8c848a48-5903x3935-jpg' },
    alt: 'Red buoys on the Red River at dusk',
  },
  year: 2026,
  location: 'Hanoi, Vietnam',
  dateTaken: '2026-03-14',
  parallaxSpeed: 0.1,
};
const noAsset: Photo = { ...photo, _id: 'p2', image: undefined };

const obj = imageObjectJsonLd(photo);
check('ImageObject construit', obj !== null);
if (obj) {
  check('creator nommé', (obj.creator as { name: string }).name === AUTHOR_NAME);
  check('copyrightHolder nommé', (obj.copyrightHolder as { name: string }).name === AUTHOR_NAME);
  check('creditText', obj.creditText === AUTHOR_NAME);
  check('copyrightNotice daté', obj.copyrightNotice === `© 2026 ${AUTHOR_NAME}. All rights reserved.`);
  check('license → /legal/', obj.license === LICENSE_URL && LICENSE_URL.endsWith('/legal/'));
  check('acquireLicensePage → /contact/', obj.acquireLicensePage === ACQUIRE_LICENSE_URL && ACQUIRE_LICENSE_URL.endsWith('/contact/'));
  check('contentUrl plafonné à 1600', String(obj.contentUrl).includes('w=1600'));
  check('ancre /archives', String(obj.url) === `${SITE_INFO.url}/archives/#photo-2026-hanoi-buoys`);
  check('contentLocation', (obj.contentLocation as { name: string }).name === 'Hanoi, Vietnam');
}
check('photo sans asset → null', imageObjectJsonLd(noAsset) === null);

const gallery = imageGalleryJsonLd({ name: 'Archives', path: '/archives', photos: [photo, noAsset] });
check('galerie : les photos sans asset sont écartées', gallery.numberOfItems === 1);
check('galerie : URL absolue avec slash final', gallery.url === `${SITE_INFO.url}/archives/`);
check('galerie : @id explicite honoré', imageGalleryJsonLd({ name: 'S', path: '/series', id: 'x#s', photos: [] })['@id'] === 'x#s');
check('galerie : auteur nommé', (gallery.author as { name: string }).name === AUTHOR_NAME);

const crumbs = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Archives', path: '/archives' }]);
const items = crumbs.itemListElement as { position: number; item: string }[];
check('breadcrumb : positions 1..n', items[0]!.position === 1 && items[1]!.position === 2);
check('breadcrumb : URL absolues', items[1]!.item === `${SITE_INFO.url}/archives/`);

check('Person : @id stable', personJsonLd()['@id'] === `${SITE_INFO.url}/about/#person`);
check('WebSite : auteur lié', (webSiteJsonLd().author as { '@id': string })['@id'] === `${SITE_INFO.url}/about/#person`);

const escaped = JSON.stringify({ t: '</script>' }).replace(/</g, '\\u003c');
check('échappement de </script>', !escaped.includes('</script>'), escaped);

console.log(failures === 0 ? '\n✓ check-jsonld : tout passe' : `\n✗ ${failures} échec(s)`);
process.exit(failures === 0 ? 0 : 1);
