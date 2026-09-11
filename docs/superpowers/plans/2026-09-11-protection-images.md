# Protection des photographies — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer les trois trous mesurés par l'audit (assets stockés en pleine résolution, contournements du plafond, absence totale de provenance lisible par les machines) et rendre l'auteur visible partout où une photo est servie, sans intervention d'Alexandre.

**Architecture:** Aucune nouvelle dépendance. Trois briques : (1) un module `lib/seo/jsonld.ts` de constructeurs Schema.org purs, rendus par un composant `<JsonLd />` dans les quatre pages qui montrent des photos ; (2) le pipeline d'import `scripts/prepare-image.ts` qui devient le SEUL chemin vers Sanity, signe chaque fichier (EXIF + XMP) et est verrouillé côté Studio par une validation sur les dimensions de l'asset ; (3) un script `scripts/downsize-assets.ts` idempotent, dry-run par défaut, qui refait passer les 121 assets hors plafond par ce pipeline et repointe les documents. Les mentions légales passent sous Sanity comme les quatre autres pages éditoriales.

**Tech Stack:** Next.js 16 (App Router, `output: 'export'`), TypeScript strict, Sanity v5 + `@sanity/client`, `sharp` 0.34 (`withExif`, `withXmp`), scripts `tsx`, GROQ.

**Spec:** `docs/superpowers/specs/2026-09-11-protection-images-audit.md` — à lire avant la tâche 1. Le plan argumente depuis elle ; les numéros R1…R7 ci-dessous renvoient à ses recommandations.

## Global Constraints

- **Branche** : `feat/image-protection`, créée depuis `main`. Ne jamais commiter sur `main` (CLAUDE.md §8.3). **Pas de déploiement dans ce plan** : le `npm run deploy` final attend le feu vert d'Alexandre (tâche 8).
- **Décisions d'Alexandre du 2026-09-11, acquises** : plan accepté tel quel ; **purge des anciens assets : OUI** (il détient les masters) — tâche 6 étape 7 ; **filigrane : NON**. R3 et R4 doivent valoir pour tout nouvel upload sans geste : c'est le cas par construction (le JSON-LD se dérive de Sanity à chaque build ; le verrou Studio et `prepareForWeb` couvrent les deux chemins d'import), et la tâche 8 le vérifie.
- **Zéro dépendance npm ajoutée.** `sharp` 0.34.5 est déjà en devDependency et expose `withExif`/`withXmp` ; `@sanity/client` est là.
- **TypeScript strict, aucun `any`** (CLAUDE.md §7.3). Alias `@/*` dans `app/`, `lib/`, `components/`, `sanity/` ; imports relatifs dans `scripts/` (convention du dossier).
- **Pas de framework de test** (CLAUDE.md §7.4). Les assertions vivent dans `scripts/check-*.ts`, sur le modèle de `scripts/check-image-prep.ts` : `check(label, ok, detail)` qui affiche `✓`/`✗` et `process.exit(1)` si un cas échoue.
- **Metadata TOUJOURS via `buildMetadata()`** (CLAUDE.md §5) — les balises `robots`/`tdm-*` s'ajoutent là et nulle part ailleurs.
- **Tout contenu éditable se lit depuis Sanity** (CLAUDE.md §8.5) : `legalBody`/`privacyBody` avec repli en dur, jamais l'inverse.
- **Tout dépôt d'asset image dans Sanity passe par `prepareForWeb`** — c'est l'invariant que ce plan installe (tâches 4 et 6) et qu'il inscrit dans CLAUDE.md (tâche 7).
- **Le nom de l'auteur vit à UN endroit** : `lib/site/author.ts`. `lib/seo/jsonld.ts` et `scripts/image-rights.ts` l'importent ; aucun littéral « Alexandre Matencio » ailleurs que dans le pied de page existant et les textes de repli.
- **Les URL absolues viennent de `NEXT_PUBLIC_SITE_URL`** (`.env.production`), jamais d'un littéral. Les scripts qui en ont besoin chargent `.env.production` PUIS `.env.local` (`node --env-file=.env.production --env-file=.env.local`) — le second l'emporte, et `.env.local` ne contient PAS cette variable (CLAUDE.md §2.1).
- **Langue** : commentaires, libellés Studio et messages en français ; textes du site public en anglais ; commits en Conventional Commits, sujet en français.
- **Fait à garder en tête** : sous `/photo-portfolio/`, `robots.txt` et `/.well-known/tdmrep.json` ne sont lus par aucun robot (la racine `alexandrematencio.github.io/robots.txt` répond 404). Ils sont écrits pour le domaine propre ; seules les balises `<meta>` agissent aujourd'hui. Ne pas « corriger » cela en déplaçant les fichiers : ils sont au bon endroit du dépôt.
- Après chaque tâche : `npm run typecheck` vert avant le commit.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `lib/site/author.ts` | Nom de l'auteur, avis de copyright — source unique | 1 |
| `lib/seo/jsonld.ts` | Constructeurs Schema.org purs (`Person`, `WebSite`, `ImageObject`, `ImageGallery`, `BreadcrumbList`) | 1 |
| `components/seo/JsonLd.tsx` | Rendu `<script type="application/ld+json">` | 1 |
| `scripts/check-jsonld.ts` | Assertions sur les constructeurs | 1 |
| `app/(site)/page.tsx`, `about/page.tsx`, `archives/page.tsx`, `series/page.tsx` | Montage des JSON-LD | 1 |
| `lib/seo/metadata.ts` | Balises `robots`, `noai`, `tdm-reservation` | 2 |
| `app/robots.ts` | Refus des robots d'entraînement IA | 2 |
| `public/.well-known/tdmrep.json` | Opposition TDM (directive DSM art. 4) | 2 |
| `app/sitemap.ts` | Sitemap image de `/archives` | 2 |
| `sanity/schemas/siteSettings.ts`, `lib/sanity/queries.ts` | Champs `legalBody`, `privacyBody` | 3 |
| `app/(site)/legal/page.tsx`, `privacy/page.tsx` | Pages pilotées par Sanity, replis corrigés | 3 |
| `components/site/SiteFooter.tsx` | Avis de copyright | 3 |
| `scripts/image-rights.ts` | EXIF + XMP de droits | 4 |
| `scripts/prepare-image.ts` | Signature des fichiers déposés | 4 |
| `scripts/check-image-prep.ts` | Assertions sur la signature | 4 |
| `scripts/upload-photos.ts`, `scripts/set-hero.ts` | Année transmise ; hero via le pipeline | 4 |
| `sanity/validation/assetWithinCap.ts`, `sanity/schemas/photo.ts`, `siteSettings.ts` | Verrou Studio sur les dimensions | 4 |
| `components/gallery/OriginalViewer.tsx` (supprimé), `components/site/PhotoGuard.tsx`, `next.config.ts` | Nettoyage | 4 |
| `scripts/make-og-image.ts`, `public/og-default.jpg` | Image de partage signée | 5 |
| `scripts/downsize-assets.ts` | Réduction des assets hors plafond, repointage | 6 |
| `lib/sanity/image.ts` | Docblock mis à jour (le plafond devient réel) | 6 |
| `docs/PROTECTION-IMAGES.md` | Guide pour Alexandre (Lightroom, preuve, riposte) | 7 |
| `CLAUDE.md`, `docs/JOURNAL-CLAUDE.md`, `resources/learning/protection-images.md` | Interdictions, journal, leçon | 7 |

---

### Task 1: Données structurées — auteur, licence et galeries (R3)

**Files:**
- Create: `lib/site/author.ts`
- Create: `lib/seo/jsonld.ts`
- Create: `components/seo/JsonLd.tsx`
- Create: `scripts/check-jsonld.ts`
- Modify: `package.json` (script `check-jsonld`)
- Modify: `app/(site)/page.tsx`, `app/(site)/about/page.tsx`, `app/(site)/archives/page.tsx`, `app/(site)/series/page.tsx`

**Interfaces:**
- Consumes: `Photo` (`lib/sanity/queries.ts`), `urlFor` (`lib/sanity/image.ts`), `SITE_INFO`, `withSlash` (`lib/seo/metadata.ts`), `PreparedSeries` (`lib/site/series.ts`).
- Produces: `AUTHOR_NAME`, `copyrightNotice(year)` (`lib/site/author.ts`) — réutilisés en tâches 3, 4, 5. `personJsonLd()`, `webSiteJsonLd()`, `imageObjectJsonLd(photo)`, `imageGalleryJsonLd(opts)`, `breadcrumbJsonLd(items)`, `LICENSE_URL`, `ACQUIRE_LICENSE_URL`, type `JsonLdObject`.

- [ ] **Step 1 : Créer la branche**

```bash
git checkout main && git pull && git checkout -b feat/image-protection
```

- [ ] **Step 2 : Écrire `lib/site/author.ts`**

```ts
/**
 * Identité de l'auteur, source unique. Consommée par les données structurées
 * (lib/seo/jsonld.ts), par la signature des fichiers déposés dans Sanity
 * (scripts/image-rights.ts) et par l'image de partage. Le pied de page et les
 * textes de repli des pages légales portent le nom en clair, mais ce sont des
 * textes, pas des identifiants : c'est ici que change le nom s'il doit changer.
 */
export const AUTHOR_NAME = 'Alexandre Matencio';
export const AUTHOR_SHORT = 'A. Matencio';

/** Avis de copyright, tel qu'il est écrit dans les fichiers ET dans le JSON-LD. */
export function copyrightNotice(year: number = new Date().getFullYear()): string {
  return `© ${year} ${AUTHOR_NAME}. All rights reserved.`;
}
```

- [ ] **Step 3 : Écrire `lib/seo/jsonld.ts`**

```ts
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { AUTHOR_NAME, AUTHOR_SHORT, copyrightNotice } from '@/lib/site/author';

/**
 * Constructeurs Schema.org — fonctions PURES, sans React.
 *
 * Pourquoi : Google Images n'affiche le crédit d'auteur et le badge
 * « Licensable » que si la page déclare `creator`, `creditText`,
 * `copyrightNotice`, `license` et `acquireLicensePage` sur chaque `ImageObject`
 * (ou si le fichier porte l'IPTC correspondant — ce que le CDN Sanity efface,
 * cf. spec §1). C'est donc la SEULE provenance lisible par les machines que ce
 * site peut offrir. Chaque page qui rend des photos monte un `ImageGallery`.
 */
export type JsonLdObject = Record<string, unknown>;

const CONTEXT = 'https://schema.org';

export const AUTHOR_ID = `${SITE_INFO.url}/about/#person`;
/** Page qui porte la clause de réutilisation (spec R4). */
export const LICENSE_URL = `${SITE_INFO.url}/legal/`;
/** Page par laquelle on demande une licence — Google l'affiche en bouton. */
export const ACQUIRE_LICENSE_URL = `${SITE_INFO.url}/contact/`;

function pageUrl(path: string): string {
  return `${SITE_INFO.url}${withSlash(path)}`;
}

export function personJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: AUTHOR_NAME,
    alternateName: AUTHOR_SHORT,
    jobTitle: 'Photographer',
    url: pageUrl('/about'),
    image: `${SITE_INFO.url}/img/photo-profile.jpg`,
  };
}

export function webSiteJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': `${SITE_INFO.url}/#website`,
    name: SITE_INFO.name,
    url: pageUrl('/'),
    description: SITE_INFO.description,
    inLanguage: 'en-US',
    author: { '@id': AUTHOR_ID },
    copyrightHolder: { '@id': AUTHOR_ID },
  };
}

/**
 * Une photo. `null` si elle n'a pas d'asset (rien à déclarer) ou si Sanity
 * n'est pas configuré. L'ancre `#photo-<slug>` de /archives est l'URL stable
 * d'une photo tant que /series/[slug] n'existe pas (spec §9 de /series).
 * `JSON.stringify` laisse tomber les clés `undefined` : pas de nettoyage ici.
 */
export function imageObjectJsonLd(photo: Photo): JsonLdObject | null {
  if (!photo.image?.asset?._ref) return null;
  const builder = urlFor(photo.image);
  if (!builder) return null;
  const anchor = `${pageUrl('/archives')}#photo-${photo.slug.current}`;
  const year = photo.year;
  return {
    '@type': 'ImageObject',
    '@id': anchor,
    url: anchor,
    name: photo.title,
    description: photo.image.alt ?? photo.caption,
    contentUrl: builder.width(1600).quality(80).auto('format').url(),
    thumbnailUrl: builder.width(400).quality(75).auto('format').url(),
    creator: { '@type': 'Person', '@id': AUTHOR_ID, name: AUTHOR_NAME },
    creditText: AUTHOR_NAME,
    copyrightHolder: { '@id': AUTHOR_ID },
    copyrightNotice: copyrightNotice(year),
    copyrightYear: year,
    license: LICENSE_URL,
    acquireLicensePage: ACQUIRE_LICENSE_URL,
    dateCreated: photo.dateTaken,
    contentLocation: photo.location
      ? { '@type': 'Place', name: photo.location }
      : undefined,
  };
}

export function imageGalleryJsonLd(opts: {
  name: string;
  path: string;
  /** `@id` explicite quand une page porte PLUSIEURS galeries (/series). */
  id?: string;
  description?: string;
  photos: Photo[];
}): JsonLdObject {
  const image = opts.photos
    .map(imageObjectJsonLd)
    .filter((o): o is JsonLdObject => o !== null);
  return {
    '@context': CONTEXT,
    '@type': 'ImageGallery',
    '@id': opts.id ?? `${pageUrl(opts.path)}#gallery`,
    name: opts.name,
    url: pageUrl(opts.path),
    description: opts.description,
    author: { '@id': AUTHOR_ID },
    copyrightHolder: { '@id': AUTHOR_ID },
    license: LICENSE_URL,
    numberOfItems: image.length,
    image,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: pageUrl(item.path),
    })),
  };
}
```

- [ ] **Step 4 : Écrire `components/seo/JsonLd.tsx`**

```tsx
import type { JsonLdObject } from '@/lib/seo/jsonld';

/**
 * Un bloc JSON-LD. `<` est échappé en `<` : le JSON est injecté tel quel
 * dans un <script>, et une chaîne CMS contenant `</script>` fermerait la balise.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
```

- [ ] **Step 5 : Écrire `scripts/check-jsonld.ts`**

```ts
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
```

- [ ] **Step 6 : Ajouter le script npm et lancer les assertions**

Dans `package.json`, après `"check-search"` :

```json
"check-jsonld": "node --env-file=.env.local --import tsx scripts/check-jsonld.ts",
```

Run : `npm run check-jsonld`
Expected : toutes les lignes en `✓`, sortie 0. (`.env.local` est requis : `urlFor` rend `null` sans `NEXT_PUBLIC_SANITY_PROJECT_ID`, et « ImageObject construit » échouerait.)

- [ ] **Step 7 : Monter les JSON-LD dans les quatre pages**

`app/(site)/page.tsx` — ajouter l'import et le bloc en tête du fragment :

```tsx
import { JsonLd } from '@/components/seo/JsonLd';
import { webSiteJsonLd } from '@/lib/seo/jsonld';
// …
  return (
    <>
      <JsonLd data={webSiteJsonLd()} />
      {/* SplashScreen — … (commentaire existant inchangé) */}
      <SplashScreen verticalMobile />
```

`app/(site)/about/page.tsx` :

```tsx
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, personJsonLd } from '@/lib/seo/jsonld';
// …
  return (
    <>
      <JsonLd
        data={[
          personJsonLd(),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'About', path: '/about' },
          ]),
        ]}
      />
      <PageShell title="ABOUT">
        {/* … inchangé … */}
      </PageShell>
    </>
  );
```

`app/(site)/archives/page.tsx` :

```tsx
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, imageGalleryJsonLd } from '@/lib/seo/jsonld';
// …
  const photos = await getAllPhotos();
  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Archives', path: '/archives' },
    ]),
    // TOUTES les photos visibles : c'est la page-catalogue, donc l'URL stable
    // de chaque ImageObject (ancre #photo-<slug>) vit ici.
    imageGalleryJsonLd({
      name: 'Archives — A. Matencio',
      path: '/archives',
      description:
        'Full catalogue: every photograph grouped by year, location, style, camera or lens.',
      photos,
    }),
  ];
  return (
    <>
      <JsonLd data={jsonLd} />
      <PageShell
        bleed
        {/* … inchangé … */}
      </PageShell>
    </>
  );
```

`app/(site)/series/page.tsx` — dans le retour principal seulement (pas dans le cas « No series yet ») :

```tsx
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, imageGalleryJsonLd } from '@/lib/seo/jsonld';
import { SITE_INFO } from '@/lib/seo/metadata';
// …
  const jsonLd = [
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Series', path: '/series' },
    ]),
    // Une galerie par série. L'URL n'ouvre aucune série (invariant 16 de
    // /series) : l'@id porte le slug, l'`url` reste la page.
    ...series.map((s) =>
      imageGalleryJsonLd({
        name: s.title,
        path: '/series',
        id: `${SITE_INFO.url}/series/#series-${s.slug}`,
        description: s.subtitle,
        photos: s.photos,
      })
    ),
  ];
  return (
    <>
      <JsonLd data={jsonLd} />
      <SeriesExperience series={series} />
    </>
  );
```

- [ ] **Step 8 : Vérifier dans le HTML servi**

```bash
npm run typecheck && npm run build && python3 - <<'EOF'
import re, json
for page in ['index', 'about/index', 'archives/index', 'series/index']:
    html = open(f'out/{page}.html', encoding='utf-8').read()
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    data = [json.loads(b) for b in blocks]
    flat = [d for b in data for d in (b if isinstance(b, list) else [b])]
    types = [d.get('@type') for d in flat]
    n = sum(len(d.get('image', [])) for d in flat if d.get('@type') == 'ImageGallery')
    print(page, types, 'images:', n)
    for d in flat:
        for img in d.get('image', []) if d.get('@type') == 'ImageGallery' else []:
            assert img['creditText'] and img['license'].endswith('/legal/') and img['acquireLicensePage'].endswith('/contact/'), img['name']
EOF
```

Expected : `index ['WebSite']`, `about/index ['Person', 'BreadcrumbList']`, `archives/index ['BreadcrumbList', 'ImageGallery'] images: 215` (le nombre de photos visibles du jour), `series/index ['BreadcrumbList', 'ImageGallery', 'ImageGallery', …]`, aucune `AssertionError`.

Puis coller le bloc de `out/archives/index.html` dans https://validator.schema.org/ : 0 erreur (des avertissements « champ recommandé » sont acceptables).

- [ ] **Step 9 : Commit**

```bash
git add lib/site/author.ts lib/seo/jsonld.ts components/seo/JsonLd.tsx scripts/check-jsonld.ts package.json 'app/(site)/page.tsx' 'app/(site)/about/page.tsx' 'app/(site)/archives/page.tsx' 'app/(site)/series/page.tsx'
git commit -m "feat(seo): données structurées — auteur, licence et galeries sur chaque page de photos"
```

---

### Task 2: Balises robots et TDM, robots.txt, tdmrep.json, sitemap image (R5)

**Files:**
- Modify: `lib/seo/metadata.ts:49`
- Modify: `app/robots.ts`
- Create: `public/.well-known/tdmrep.json`
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: `getAllPhotos`, `urlFor`.
- Produces: rien de consommé par une autre tâche.

- [ ] **Step 1 : Balises `<meta>` dans `buildMetadata`**

Remplacer la ligne `robots: { index: true, follow: true },` de `lib/seo/metadata.ts` par :

```ts
    // `max-image-preview: large` : Google a le droit de montrer la vignette en
    // grand dans ses résultats — c'est ce qu'un portfolio veut.
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    // Deux balises qui ne dépendent PAS de robots.txt — et c'est le point :
    // sous /photo-portfolio/, robots.txt n'est lu par personne (la racine du
    // domaine github.io répond 404). Ce sont donc les seules oppositions
    // effectives aujourd'hui. `noai`/`noimageai` (DeviantArt, 2022) ne sont
    // honorées que par quelques acteurs ; `tdm-reservation` est le protocole
    // européen (W3C TDMRep, directive DSM art. 4) — c'est celui qui pèse.
    other: {
      robots: 'noai, noimageai',
      'tdm-reservation': '1',
      'tdm-policy': `${SITE_URL}/legal/`,
    },
```

- [ ] **Step 2 : Réécrire `app/robots.ts`**

```ts
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/**
 * Robots d'ENTRAÎNEMENT refusés ; les robots de RECHERCHE (Googlebot,
 * Googlebot-Image, Bingbot…) restent autorisés : le site veut être trouvé, pas
 * ingéré. `Google-Extended` et `Applebot-Extended` ne touchent pas à
 * l'indexation, ils ne gouvernent que l'usage pour Gemini / Apple Intelligence.
 *
 * ⚠️ Ce fichier n'a d'effet QUE sur un domaine propre : servi sous
 * /photo-portfolio/robots.txt, aucun robot ne le lit (ils consultent la racine
 * du domaine). Il est écrit pour le jour du domaine, et rien n'est à changer ce
 * jour-là. D'ici là, ce sont les balises <meta> de buildMetadata qui agissent.
 */
const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'PerplexityBot',
  'Perplexity-User',
  'Amazonbot',
  'meta-externalagent',
  'meta-externalfetcher',
  'FacebookBot',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'omgili',
  'omgilibot',
  'YouBot',
  'DuckAssistBot',
  'Ai2Bot',
  'PanguBot',
  'Webzio-Extended',
  'MistralAI-User',
];

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://amatencio.photo';
  return {
    rules: [
      { userAgent: AI_TRAINING_CRAWLERS, disallow: '/' },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/studio', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Step 3 : Créer `public/.well-known/tdmrep.json`**

Sans `tdm-policy` : la clé est optionnelle dans le protocole, et une URL absolue en dur casserait au changement de domaine. La politique est déjà portée par la balise `<meta name="tdm-policy">` de chaque page.

```json
[
  {
    "location": "/",
    "tdm-reservation": 1
  }
]
```

- [ ] **Step 4 : Sitemap image dans `app/sitemap.ts`**

Remplacer le fichier entier :

```ts
import type { MetadataRoute } from 'next';
import { urlFor } from '@/lib/sanity/image';
import { getAllPhotos } from '@/lib/sanity/queries';
import { withSlash } from '@/lib/seo/metadata';

// Requis pour `output: 'export'` sur les routes Metadata (sitemap, robots).
export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://amatencio.photo';
  const now = new Date();
  const routes = [
    '/',
    '/about',
    '/about/digital-agency',
    '/series',
    '/archives',
    '/contact',
    '/socials',
    '/legal',
    '/privacy',
  ];

  // Sitemap IMAGE sur la page-catalogue : Google Images n'indexe une photo que
  // s'il la trouve, et une grille chargée en paresseux ne lui montre pas tout.
  // Même largeur que `contentUrl` du JSON-LD (1600) : une seule URL par photo
  // à indexer, pas deux.
  const photos = await getAllPhotos();
  const archiveImages = photos.flatMap((p) => {
    const b = p.image ? urlFor(p.image) : null;
    return b ? [b.width(1600).quality(80).auto('format').url()] : [];
  });

  // Slash final : le site est en `trailingSlash: true` — déclarer `/series`
  // enverrait Google sur une redirection au lieu de la page (cf. buildMetadata).
  return routes.map((path) => ({
    url: `${base}${withSlash(path)}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
    ...(path === '/archives' ? { images: archiveImages } : {}),
  }));
}
```

- [ ] **Step 5 : Vérifier dans l'export**

```bash
npm run typecheck && npm run build \
 && grep -o '<meta name="robots"[^>]*>' out/index.html \
 && grep -o '<meta name="tdm-[a-z]*"[^>]*>' out/archives/index.html \
 && cat out/robots.txt \
 && cat out/.well-known/tdmrep.json \
 && grep -c '<image:image>' out/sitemap.xml
```

Expected : deux balises `robots` (`index, follow, max-image-preview:large` et `noai, noimageai` — Google fusionne les balises multiples), `tdm-reservation` = `1` et `tdm-policy` sur `/legal/`, `robots.txt` avec un bloc `Disallow: /` par robot IA AVANT le bloc `*`, le JSON présent sous `out/.well-known/`, et un nombre d'`<image:image>` égal au nombre de photos visibles (215 au jour de l'audit).

- [ ] **Step 6 : Commit**

```bash
git add lib/seo/metadata.ts app/robots.ts public/.well-known/tdmrep.json app/sitemap.ts
git commit -m "feat(seo): opposition aux robots d'IA (robots.txt, TDMRep, meta) et sitemap image"
```

---

### Task 3: Mentions légales et confidentialité sous Sanity, avis de copyright nominatif (R4)

**Files:**
- Modify: `sanity/schemas/siteSettings.ts:216` (après `socialsBody`)
- Modify: `lib/sanity/queries.ts:97-101,150`
- Modify: `app/(site)/legal/page.tsx`, `app/(site)/privacy/page.tsx`
- Modify: `components/site/SiteFooter.tsx:88`

**Interfaces:**
- Consumes: `editorialBlockType`, `editorialBodyDescription` (déjà dans `siteSettings.ts`), `PortableBody`, `PageShell`, `ProtectedEmail`, constantes `EDITORIAL_*`.
- Produces: `SiteSettings.legalBody`, `SiteSettings.privacyBody`.

- [ ] **Step 1 : Deux champs dans `sanity/schemas/siteSettings.ts`**

Après le champ `socialsBody` (avant le commentaire sur `socials` supprimé) :

```ts
    defineField({
      name: 'legalBody',
      title: 'Page « Legal notice »',
      type: 'array',
      of: [editorialBlockType],
      description: editorialBodyDescription(
        'Le texte complet de la page /legal (mentions légales : éditeur, hébergeur, propriété intellectuelle et conditions de licence des photos). Tant que ce champ est vide, le site affiche un texte de repli où l’identité de l’éditeur est entre crochets — à remplir ici.'
      ),
    }),
    defineField({
      name: 'privacyBody',
      title: 'Page « Privacy »',
      type: 'array',
      of: [editorialBlockType],
      description: editorialBodyDescription(
        'Le texte complet de la page /privacy (données personnelles, droits RGPD, droit à l’image des personnes photographiées).'
      ),
    }),
```

- [ ] **Step 2 : Type et requête dans `lib/sanity/queries.ts`**

Dans `SiteSettings`, après `socialsBody?: unknown[];` :

```ts
  legalBody?: unknown[];
  privacyBody?: unknown[];
```

Dans `siteSettingsQuery`, remplacer la ligne de projection :

```ts
    aboutBody, contactBody, digitalAgencyBody, socialsBody, legalBody, privacyBody, motion,
```

- [ ] **Step 3 : Réécrire `app/(site)/legal/page.tsx`**

```tsx
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import {
  EDITORIAL_ANNEX,
  EDITORIAL_BODY,
  EDITORIAL_BODY_LINK,
  EDITORIAL_H2,
  EDITORIAL_H3,
  EDITORIAL_LEAD,
  EDITORIAL_LINK_DECORATION,
} from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';
import { AUTHOR_NAME } from '@/lib/site/author';

/**
 * Écart d'ouverture d'une section, en SUPPLÉMENT du `gap` de la colonne.
 *
 * Le REPLI ci-dessous empile ses blocs dans un flex à `gap` uniforme, là où le
 * Portable Text pose ses marges bloc par bloc (`RHYTHM`, PortableBody). Un gap
 * uniforme donne le MÊME écart au-dessus et en dessous d'un titre — or un titre
 * appartient à ce qui le suit. Ce supplément rétablit l'asymétrie : 24 (gap) +
 * 40 = 64 au-dessus d'un H2, 24 en dessous, soit `RHYTHM.h2Top` / `h2Bottom`.
 */
const SECTION_TOP = 40;

export const metadata = buildMetadata({
  title: 'Legal Notice',
  description:
    'Legal information, copyright and licensing terms for the photographs of A. Matencio.',
  path: '/legal',
});

export const revalidate = 300;

/**
 * Repli, affiché tant que `siteSettings.legalBody` est vide (CLAUDE.md §8.5 :
 * Sanity est la source de vérité, ceci n'est qu'un filet). L'identité de
 * l'éditeur reste entre crochets EXPRÈS : seul Alexandre la connaît, et il la
 * saisit dans le Studio (Réglages du site → Page « Legal notice »). Tout le
 * reste — hébergeur, propriété intellectuelle, licence, opposition TDM — est
 * exact et publiable tel quel.
 */
function LegalFallback() {
  return (
    <div className="flex flex-col gap-6">
      <p className={EDITORIAL_LEAD}>
        This site is published by {AUTHOR_NAME}, photographer. The information
        below is provided under French law (LCEN, art. 6 III) and the EU
        regulations applicable to publishers established in the European Union.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        PUBLISHER
      </h2>

      <div className="flex flex-col gap-2 pb-4 md:pb-8">
        <h3 className={EDITORIAL_H3}>Editor of record</h3>
        {/* Registre ANNEXE : une fiche de coordonnées n'est pas du texte
            courant, elle se consulte. Cf. `EDITORIAL_ANNEX`. */}
        <p className={`${EDITORIAL_ANNEX} whitespace-pre-line`}>
          {`+ ${AUTHOR_NAME}
+ [Legal status, SIRET if applicable]
+ [Address]
+ Publication director: ${AUTHOR_NAME}`}
        </p>
      </div>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        HOSTING
      </h2>

      <p className={EDITORIAL_BODY}>
        Pages are hosted by GitHub, Inc., 88 Colin P. Kelly Jr. Street, San
        Francisco, CA 94107, USA (GitHub Pages). Images are delivered by the
        content network of Sanity AS, Oslo, Norway.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        COPYRIGHT AND LICENSING
      </h2>

      <p className={EDITORIAL_BODY}>
        All photographs and texts published on this site are the exclusive
        property of {AUTHOR_NAME} and are protected by the French Intellectual
        Property Code (art. L.111-1 and following) and by international
        copyright treaties. All rights reserved.
      </p>

      <p className={EDITORIAL_BODY}>
        No photograph may be reproduced, downloaded, stored, modified,
        redistributed, published, used to train or evaluate machine-learning
        models, or otherwise exploited, in whole or in part, without the prior
        written permission of the author. Licences for editorial, exhibition and
        commercial use are granted on request:{' '}
        <ProtectedEmail className={EDITORIAL_LINK_DECORATION}>
          ask for a licence
        </ProtectedEmail>
        . Any unauthorised use will be invoiced at the rates in force and may
        give rise to legal proceedings.
      </p>

      <p className={EDITORIAL_BODY}>
        Text and data mining: the rightsholder expressly reserves the rights
        provided for in Article 4 of Directive (EU) 2019/790. This reservation
        is also expressed in machine-readable form on every page of this site.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        CONTACT
      </h2>

      <ProtectedEmail className={EDITORIAL_BODY_LINK}>
        Get in touch by email
      </ProtectedEmail>
    </div>
  );
}

export default async function LegalPage() {
  const settings = await getSiteSettings();
  return (
    <PageShell title="LEGAL NOTICE">
      <PortableBody
        value={settings?.legalBody}
        variant="editorial"
        fallback={<LegalFallback />}
      />
    </PageShell>
  );
}
```

- [ ] **Step 4 : Réécrire `app/(site)/privacy/page.tsx`**

```tsx
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteSettings } from '@/lib/sanity/queries';
import { PortableBody } from '@/components/site/PortableBody';
import { ProtectedEmail } from '@/components/site/ProtectedEmail';
import {
  EDITORIAL_BODY,
  EDITORIAL_H2,
  EDITORIAL_LEAD,
  EDITORIAL_LINK_DECORATION,
} from '@/lib/site/typography';
import { PageShell } from '@/components/site/PageShell';

/** Cf. `/legal` — même raison : rétablir l'asymétrie d'un titre dans une
 *  colonne à `gap` uniforme (24 + 40 = `RHYTHM.h2Top`). */
const SECTION_TOP = 40;

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description: 'How personal data is handled on amatencio.photo.',
  path: '/privacy',
});

export const revalidate = 300;

/** Repli, affiché tant que `siteSettings.privacyBody` est vide (CLAUDE.md §8.5). */
function PrivacyFallback() {
  return (
    <div className="flex flex-col gap-6">
      <p className={EDITORIAL_LEAD}>
        This site sets no cookies and runs no analytics. The only personal data
        it processes is what you choose to send by email when getting in touch.
      </p>

      <p className={EDITORIAL_BODY}>
        Pages are served by GitHub, Inc. (USA) and images by Sanity AS (Norway).
        Their servers may record technical logs (IP address, browser) for
        security purposes, under their own data-protection terms; this may
        involve a transfer outside the European Union covered by standard
        contractual clauses.
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        YOUR RIGHTS
      </h2>

      <p className={EDITORIAL_BODY}>
        Under articles 15 to 22 of the GDPR, you have rights to access,
        rectification, erasure, objection, restriction and portability of your
        data. To exercise them,{' '}
        {/* Lien INLINE dans un paragraphe : la décoration partagée, jamais une
            chaîne recopiée (§7.5). */}
        <ProtectedEmail className={EDITORIAL_LINK_DECORATION}>
          write to me directly
        </ProtectedEmail>
        . You may also lodge a complaint with the CNIL (cnil.fr).
      </p>

      <h2 className={EDITORIAL_H2} style={{ marginTop: SECTION_TOP }}>
        IMAGE RIGHTS
      </h2>

      <p className={`${EDITORIAL_BODY} pb-4 md:pb-8`}>
        If you believe you appear on a published photograph without your
        consent, contact me to request its removal. Maximum processing time:
        30 days.
      </p>
    </div>
  );
}

export default async function PrivacyPage() {
  const settings = await getSiteSettings();
  return (
    <PageShell title="PRIVACY">
      <PortableBody
        value={settings?.privacyBody}
        variant="editorial"
        fallback={<PrivacyFallback />}
      />
    </PageShell>
  );
}
```

- [ ] **Step 5 : Avis de copyright du pied de page**

Dans `components/site/SiteFooter.tsx`, remplacer la ligne `©2026 / All Right Reserved` par :

```tsx
              © {new Date().getFullYear()} / All rights reserved
```

Le nom est la ligne du dessus (« ALEXANDRE MATENCIO ») : les deux lignes forment ensemble l'avis « © année, titulaire ». L'année est celle du build — le site est reconstruit à chaque publication.

- [ ] **Step 6 : Vérifier**

```bash
npm run typecheck && npm run build \
 && grep -o 'GitHub, Inc.' out/legal/index.html | head -1 \
 && grep -c 'Vercel' out/legal/index.html \
 && grep -o '© 2026 / All rights reserved' out/index.html
```

Expected : `GitHub, Inc.`, puis `0` (plus aucune mention de Vercel), puis l'avis corrigé.

Puis lancer `npm run dev`, ouvrir `http://localhost:3010/studio/` → Réglages du site : les deux nouveaux champs « Page « Legal notice » » et « Page « Privacy » » apparaissent sous « Page « Socials » ». (Chrome ne joint pas localhost dans cet environnement : vérifier avec Playwright sur `/studio-probe`, cf. skill `sanity-studio` §11.23.)

- [ ] **Step 7 : Commit**

```bash
git add sanity/schemas/siteSettings.ts lib/sanity/queries.ts 'app/(site)/legal/page.tsx' 'app/(site)/privacy/page.tsx' components/site/SiteFooter.tsx
git commit -m "feat(legal): mentions légales et confidentialité pilotées par Sanity, hébergeur exact, clause de licence"
```

---

### Task 4: Pipeline d'import — signature des fichiers, verrou Studio, plus aucun contournement (R2, R6)

**Files:**
- Create: `scripts/image-rights.ts`
- Modify: `scripts/prepare-image.ts:277-336`
- Modify: `scripts/check-image-prep.ts` (nouveau bloc avant `fs.rmSync`)
- Modify: `scripts/upload-photos.ts:626` (ligne `const shrunk = …`)
- Modify: `scripts/set-hero.ts:75-80`
- Modify: `package.json` (scripts `upload-photos`, `set-hero`)
- Create: `sanity/validation/assetWithinCap.ts`
- Modify: `sanity/schemas/photo.ts:41-61`, `sanity/schemas/siteSettings.ts:53-70`
- Delete: `components/gallery/OriginalViewer.tsx`
- Modify: `components/site/PhotoGuard.tsx:21`, `next.config.ts:30-33`

**Interfaces:**
- Consumes: `AUTHOR_NAME`, `copyrightNotice` (`lib/site/author.ts`, tâche 1).
- Produces: `prepareForWeb(filepath, source, opts?: { year?: number })` — même retour qu'avant ; `exifRights(year?)`, `xmpRights(year?)` (`scripts/image-rights.ts`) — réutilisés en tâches 5 et 6 ; `assetWithinCap` (validation Sanity).

- [ ] **Step 1 : Écrire `scripts/image-rights.ts`**

```ts
import type { Exif } from 'sharp';
import { AUTHOR_NAME, copyrightNotice } from '../lib/site/author';

/**
 * Métadonnées de droits écrites dans CHAQUE fichier déposé chez Sanity.
 *
 * Franchise obligatoire : le CDN de Sanity les efface à la livraison (mesuré,
 * cf. prepare-image.ts en tête). Elles ne protègent donc pas le site. Elles
 * sont écrites quand même parce que (a) le fichier STOCKÉ les garde — si les
 * images changent d'hébergement un jour, le catalogue est déjà signé ; (b) le
 * même module signe `og-default.jpg`, servi par GitHub Pages sans
 * transformation, la seule image du site dont les métadonnées atteignent le
 * visiteur ; (c) ça ne coûte rien.
 *
 * Trois registres, parce que les lecteurs ne lisent pas les mêmes : EXIF
 * `Artist`/`Copyright` (le plus ancien, lu partout), XMP Dublin Core
 * (`dc:creator`, `dc:rights` — ce que Lightroom, Photoshop et Google lisent),
 * XMP Rights (`Marked`, `WebStatement`) et PLUS (`Licensor`) — ce que Google
 * Images utilise pour le badge « Licensable » quand le fichier arrive intact.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://alexandrematencio.github.io/photo-portfolio';

export const RIGHTS_URL = `${SITE_URL}/legal/`;
export const LICENSOR_URL = `${SITE_URL}/contact/`;

export function exifRights(year?: number): Exif {
  return {
    IFD0: {
      Artist: AUTHOR_NAME,
      Copyright: copyrightNotice(year),
    },
  };
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function xmpRights(year?: number): string {
  const author = xmlEscape(AUTHOR_NAME);
  const notice = xmlEscape(copyrightNotice(year));
  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about=""` +
    ` xmlns:dc="http://purl.org/dc/elements/1.1/"` +
    ` xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"` +
    ` xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"` +
    ` xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"` +
    ` photoshop:Credit="${author}"` +
    ` xmpRights:Marked="True"` +
    ` xmpRights:WebStatement="${xmlEscape(RIGHTS_URL)}">` +
    `<dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>` +
    `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${notice}</rdf:li></rdf:Alt></dc:rights>` +
    `<plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource">` +
    `<plus:LicensorName>${author}</plus:LicensorName>` +
    `<plus:LicensorURL>${xmlEscape(LICENSOR_URL)}</plus:LicensorURL>` +
    `</rdf:li></rdf:Seq></plus:Licensor>` +
    `</rdf:Description></rdf:RDF></x:xmpmeta>` +
    `<?xpacket end="w"?>`
  );
}
```

- [ ] **Step 2 : Signer dans `prepareForWeb`**

Dans `scripts/prepare-image.ts`, ajouter l'import en tête :

```ts
import { exifRights, xmpRights } from './image-rights';
```

Changer la signature (ligne 278) :

```ts
export async function prepareForWeb(
  filepath: string,
  source: Buffer,
  opts: { year?: number } = {}
): Promise<PreparedImage> {
```

Et compléter le docblock de la fonction (après le paragraphe sur `withIccProfile`) :

```ts
 *
 * `withExif` + `withXmp` : le fichier déposé porte l'auteur et l'avis de
 * copyright (cf. image-rights.ts pour ce que ça vaut — et ce que ça ne vaut
 * pas). `.rotate()` a déjà appliqué l'orientation aux pixels, l'EXIF réécrit
 * ici ne contient donc AUCUN drapeau d'orientation : rien ne peut coucher
 * l'image une seconde fois.
```

Remplacer les deux encodages (branche PNG ligne 320, boucle ligne 332) :

```ts
  if (format === 'png') {
    // Un PNG n'a pas de curseur de qualité : il tient son poids ou pas.
    out = await base()
      .png({ compressionLevel: 9 })
      .withIccProfile('srgb')
      .withExif(exifRights(opts.year))
      .withXmp(xmpRights(opts.year))
      .toBuffer();
  } else {
    // Échelle descendante : … (commentaire existant inchangé)
    out = Buffer.alloc(0);
    for (const q of QUALITY_LADDER) {
      const encoded =
        format === 'webp'
          ? base().webp({ quality: q })
          : base().jpeg({ quality: q, mozjpeg: true, progressive: true });
      out = await encoded
        .withIccProfile('srgb')
        .withExif(exifRights(opts.year))
        .withXmp(xmpRights(opts.year))
        .toBuffer();
      quality = q;
      if (out.length <= MAX_BYTES) break;
    }
  }
```

- [ ] **Step 3 : Assertions dans `scripts/check-image-prep.ts`**

Avant `fs.rmSync(DIR, …)`, ajouter :

```ts
  // Signature : chaque fichier déposé porte l'auteur, dans les trois registres.
  console.log('\n── Signature ──');
  for (const name of ['smooth.jpg', 'shot.webp', 'alpha.png']) {
    const signed = await prep(name);
    const meta = await sharp(signed.buffer).metadata();
    const exif = meta.exif?.toString('latin1') ?? '';
    const xmp = meta.xmp?.toString('utf8') ?? '';
    check(`  ${name} : EXIF Artist`, exif.includes('Alexandre Matencio'));
    check(`  ${name} : XMP dc:creator`, xmp.includes('<dc:creator>') && xmp.includes('Alexandre Matencio'));
    check(`  ${name} : XMP Marked + WebStatement`, xmp.includes('xmpRights:Marked="True"') && xmp.includes('/legal/'));
    check(`  ${name} : pas d’orientation réécrite`, !/Orientation/i.test(exif));
  }
  const dated = await prepareForWeb(file('smooth.jpg'), fs.readFileSync(file('smooth.jpg')), { year: 2019 });
  check('année transmise dans l’avis', (await sharp(dated.buffer).metadata()).exif?.toString('latin1').includes('© 2019') === true);
  check('signé ET sous le plafond de poids', dated.to.bytes <= MAX_BYTES, `${Math.round(dated.to.bytes / 1024)} Ko`);
```

Run : `npm run check-image-prep`
Expected : toutes les lignes en `✓`, y compris les anciennes (la signature pèse quelques centaines d'octets, le dégradé reste sous 400 Ko en q=82). Vérifié le 2026-09-11 avant l'écriture de ce plan : `sharp` 0.34.5 écrit bien EXIF ET XMP dans les trois conteneurs (JPEG, WebP, PNG), sans drapeau d'orientation — si une assertion échoue, c'est une divergence de transcription, pas une limite de l'outil.

- [ ] **Step 4 : Transmettre l'année et charger `.env.production` dans les scripts**

`scripts/upload-photos.ts`, ligne `const shrunk = await prepareForWeb(filepath, buffer);` devient :

```ts
    const shrunk = await prepareForWeb(filepath, buffer, { year: p.year });
```

`package.json` — les deux scripts qui déposent des assets chargent `.env.production` AVANT `.env.local` (l'URL du site pour `WebStatement`) :

```json
"upload-photos": "node --env-file=.env.production --env-file=.env.local --import tsx scripts/upload-photos.ts",
"set-hero": "node --env-file=.env.production --env-file=.env.local --import tsx scripts/set-hero.ts",
```

- [ ] **Step 5 : `set-hero.ts` passe par le pipeline**

Ajouter l'import :

```ts
import { prepareForWeb } from './prepare-image';
```

Remplacer le bloc upload (lignes 75-81) :

```ts
    console.log(`Upload de ${img.file} vers Sanity…`);
    const buffer = await fs.readFile(filePath);
    // JAMAIS un dépôt brut : le plafond de résolution et la signature ne
    // valent que si TOUS les chemins vers Sanity passent ici (CLAUDE.md §11.12).
    const shrunk = await prepareForWeb(filePath, buffer);
    const asset = await client.assets.upload('image', shrunk.buffer, {
      filename: `${path.basename(img.filename, path.extname(img.filename))}.${shrunk.ext}`,
      contentType: shrunk.contentType,
    });
    console.log(`✓ Asset uploadé : ${asset._id} (${shrunk.to.w}×${shrunk.to.h})`);
```

- [ ] **Step 6 : Verrou Studio — `sanity/validation/assetWithinCap.ts`**

```ts
import type { CustomValidator } from 'sanity';

/**
 * Plafond du grand côté d'un asset image. Aligné sur `MAX_EDGE` de
 * scripts/prepare-image.ts (2048) — deux nombres, un seul sens : le site ne
 * doit JAMAIS stocker une photo dont l'original serait récupérable en pleine
 * résolution en retirant `?w=` de l'URL (audit du 2026-09-11).
 *
 * Pourquoi une validation et pas un redimensionnement : le Studio dépose
 * l'asset AVANT que le formulaire voie quoi que ce soit, et Sanity n'offre
 * aucun hook serveur. On ne peut donc pas réduire ; on peut refuser de publier.
 * Le message dit quoi faire.
 */
export const MAX_ASSET_EDGE = 2048;

type ImageValue = { asset?: { _ref?: string } } | undefined;

export const assetWithinCap: CustomValidator<ImageValue> = async (value, context) => {
  const ref = value?.asset?._ref;
  if (!ref) return true;
  const client = context.getClient({ apiVersion: '2026-01-01' });
  const dims = await client.fetch<{ width: number; height: number } | null>(
    '*[_id == $id][0].metadata.dimensions{ width, height }',
    { id: ref }
  );
  if (!dims) return true;
  if (Math.max(dims.width, dims.height) <= MAX_ASSET_EDGE) return true;
  return (
    `Image trop grande : ${dims.width} × ${dims.height} px. Le site plafonne à ` +
    `${MAX_ASSET_EDGE} px sur le grand côté, sinon l’original reste récupérable ` +
    `en pleine résolution par n’importe qui. Exporte-la à 2048 px (Lightroom : ` +
    `Redimensionner → Bord long → 2048) et remplace l’image, ou importe-la par ` +
    `« npm run upload-photos », qui la réduit tout seul.`
  );
};
```

Dans `sanity/schemas/photo.ts`, le champ `image` reçoit une validation (après `fields: [...]`) :

```ts
      // ERREUR, pas avertissement : une photo hors plafond ne se publie pas.
      // C'est le verrou du glisser-déposer, seul chemin d'import qui ne passe
      // pas par prepareForWeb. Cf. sanity/validation/assetWithinCap.ts.
      validation: (Rule) => Rule.custom(assetWithinCap),
```

avec l'import `import { assetWithinCap } from '../validation/assetWithinCap';`.

Dans `sanity/schemas/siteSettings.ts`, `heroImageField` ajoute une entrée au tableau de validation, AVERTISSEMENT (le hero est un portrait de l'auteur, pas une œuvre à protéger, et l'image « reveal » est à 3122 px jusqu'à la tâche 6) :

```ts
      Rule.custom(assetWithinCap).warning(),
```

avec l'import `import { assetWithinCap } from '../validation/assetWithinCap';`.

- [ ] **Step 7 : Nettoyage**

```bash
git rm components/gallery/OriginalViewer.tsx
```

Dans `components/site/PhotoGuard.tsx`, ligne 21, retirer `OriginalViewer, ` de l'énumération (`PhotoBlock, PhotoLightbox, FolderStack, …`).

Dans `next.config.ts`, supprimer la ligne `{ protocol: 'https', hostname: 'images.unsplash.com' },` — plus aucun composant ne s'en sert.

- [ ] **Step 8 : Vérifier**

```bash
npm run typecheck && npm run check-image-prep && npm run build
```

Expected : typecheck vert, assertions toutes `✓`, build sans erreur. Puis `npm run dev` et, avec Playwright sur `/studio-probe`, ouvrir une photo dont l'asset dépasse 2048 px (par exemple « Buoys », 5903 px) : le champ Image porte une erreur rouge avec le message ci-dessus, et le bouton Publish est désactivé. (Après la tâche 6, plus aucune photo ne doit la déclencher.)

- [ ] **Step 9 : Commit**

```bash
git add scripts/image-rights.ts scripts/prepare-image.ts scripts/check-image-prep.ts scripts/upload-photos.ts scripts/set-hero.ts package.json sanity/validation/assetWithinCap.ts sanity/schemas/photo.ts sanity/schemas/siteSettings.ts components/site/PhotoGuard.tsx next.config.ts
git commit -m "feat(pipeline): signature EXIF/XMP des fichiers déposés, verrou Studio sur le plafond, hero via le pipeline"
```

---

### Task 5: Image de partage signée (`og-default.jpg`)

**Files:**
- Create: `scripts/make-og-image.ts`
- Create: `public/og-default.jpg` (généré)
- Modify: `package.json` (script `make-og-image`)

**Interfaces:**
- Consumes: `exifRights`, `xmpRights` (tâche 4), `@sanity/client`.
- Produces: `public/og-default.jpg`, 1200 × 630, que `lib/seo/metadata.ts:27` référence déjà.

- [ ] **Step 1 : Écrire `scripts/make-og-image.ts`**

```ts
/**
 * Génère public/og-default.jpg (1200 × 630) depuis la PREMIÈRE photo visible
 * de la curation de la home — l'image que les réseaux sociaux affichent quand
 * on partage n'importe quelle page du site. Elle 404 depuis la mise en ligne.
 *
 *   npm run make-og-image
 *
 * Servie par GitHub Pages sans transformation : c'est la SEULE image du site
 * dont la signature EXIF/XMP atteint réellement le visiteur (cf.
 * image-rights.ts). Recadrage : autour du hotspot posé dans le Studio quand il
 * existe, sinon au centre. Relancer quand la curation change de première photo.
 */
import { createClient } from '@sanity/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exifRights, xmpRights } from './image-rights';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';

if (!PROJECT_ID) {
  console.error('✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant (.env.local).');
  process.exit(1);
}

const OUT = path.resolve(process.cwd(), 'public/og-default.jpg');
const W = 1200;
const H = 630;

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: false,
  perspective: 'published',
});

type Pick = {
  title: string;
  year: number | null;
  url: string;
  hotspot: { x: number; y: number } | null;
};

async function main(): Promise<void> {
  const pick = await client.fetch<Pick | null>(
    `(*[_type == "siteSettings"][0].curation[]->)[hidden != true && defined(image.asset)][0]{
      title, year, "url": image.asset->url, "hotspot": image.hotspot{ x, y }
    }`
  );
  if (!pick) {
    console.error('✗ Aucune photo visible dans la curation.');
    process.exit(1);
  }

  // `?w=2048` : jamais l'original — même discipline que le site.
  const res = await fetch(`${pick.url}?w=2048&q=90`);
  if (!res.ok) throw new Error(`Téléchargement : HTTP ${res.status}`);
  const source = Buffer.from(await res.arrayBuffer());

  const { default: sharp } = await import('sharp');
  const meta = await sharp(source).metadata();
  const sw = meta.width ?? 0;
  const sh = meta.height ?? 0;
  const scale = Math.max(W / sw, H / sh);
  const rw = Math.ceil(sw * scale);
  const rh = Math.ceil(sh * scale);
  const hx = pick.hotspot?.x ?? 0.5;
  const hy = pick.hotspot?.y ?? 0.5;
  const left = Math.round(Math.min(Math.max(hx * rw - W / 2, 0), rw - W));
  const top = Math.round(Math.min(Math.max(hy * rh - H / 2, 0), rh - H));

  const out = await sharp(source)
    .resize(rw, rh)
    .extract({ left, top, width: W, height: H })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .withIccProfile('srgb')
    .withExif(exifRights(pick.year ?? undefined))
    .withXmp(xmpRights(pick.year ?? undefined))
    .toBuffer();

  await fs.writeFile(OUT, out);
  console.log(
    `✓ ${path.relative(process.cwd(), OUT)} — « ${pick.title} », ${W}×${H}, ${Math.round(out.length / 1024)} Ko, signée.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2 : Script npm et génération**

`package.json` :

```json
"make-og-image": "node --env-file=.env.production --env-file=.env.local --import tsx scripts/make-og-image.ts",
```

Run :

```bash
npm run make-og-image && node -e "require('sharp')('public/og-default.jpg').metadata().then(m=>console.log(m.width,m.height,'exif',!!m.exif,'xmp',!!m.xmp))"
```

Expected : `1200 630 exif true xmp true`. Ouvrir le fichier : un cadrage propre de la première photo de la curation (pas de bande, pas de déformation).

- [ ] **Step 3 : Vérifier l'export puis commit**

```bash
npm run build && ls -la out/og-default.jpg && grep -o 'og:image" content="[^"]*"' out/index.html
git add scripts/make-og-image.ts public/og-default.jpg package.json
git commit -m "feat(seo): image de partage générée depuis la curation, signée EXIF/XMP"
```

---

### Task 6: Réduire les assets stockés hors plafond et repointer les documents (R1)

**Files:**
- Create: `scripts/downsize-assets.ts`
- Modify: `package.json` (script `downsize-assets`)
- Modify: `lib/sanity/image.ts:8-21` (docblock)
- Écrit (gitignoré) : `resources/downsize-assets-<date>.json`

**Interfaces:**
- Consumes: `prepareForWeb` avec `opts.year` (tâche 4), `MAX_EDGE`.
- Produces: un dataset où plus aucun asset référencé ne dépasse 2048 px ; un journal old → new pour revenir en arrière.

- [ ] **Step 1 : Écrire `scripts/downsize-assets.ts`**

```ts
/**
 * Réduit au plafond (MAX_EDGE) les assets image STOCKÉS en pleine résolution,
 * dépose la version réduite et fait pointer dessus chaque document qui
 * référençait l'ancien asset — documents publiés ET brouillons.
 *
 *   npm run downsize-assets                  → DRY-RUN : liste, n'écrit rien
 *   npm run downsize-assets -- --yes         → applique
 *   npm run downsize-assets -- --yes --limit 2   → deux assets, pour éprouver
 *
 * Pourquoi : 121 assets (audit du 2026-09-11) sont stockés jusqu'à 6356 px ;
 * retirer `?w=` d'une URL du site les rend en entier. Plafonner les URLs côté
 * code ne ferme rien — seul l'asset stocké compte (lib/sanity/image.ts).
 *
 * Source de la réduction, dans l'ordre : le master local `portfolio/<nom>`
 * s'il existe (même nom que `originalFilename`), sinon le fichier servi par le
 * CDN à l'URL originale — déjà ré-encodé par Sanity, mais à 2048 px la seconde
 * génération est invisible. `prepareForWeb` fait le reste : plafond, poids,
 * sRGB, signature.
 *
 * RÉVERSIBLE : les anciens assets ne sont PAS supprimés. Ils deviennent
 * orphelins (plus aucune URL du site n'y mène) et le journal JSON écrit dans
 * resources/ garde la correspondance old → new. La purge est une décision à
 * part (spec R1), jamais prise ici.
 *
 * Idempotent : un asset déjà sous le plafond n'est pas sélectionné, une
 * relance ne refait donc que ce qui a échoué.
 */
import { createClient } from '@sanity/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_EDGE, prepareForWeb } from './prepare-image';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

const APPLY = process.argv.includes('--yes');
const limitAt = process.argv.indexOf('--limit');
const LIMIT = limitAt >= 0 ? Number(process.argv[limitAt + 1]) : Infinity;
const PORTFOLIO_DIR = path.resolve(process.cwd(), 'portfolio');

if (!PROJECT_ID) {
  console.error('✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant dans .env.local.');
  process.exit(1);
}
if (APPLY && !WRITE_TOKEN) {
  console.error('✗ SANITY_API_WRITE_TOKEN manquant dans .env.local.');
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  // `raw` : les brouillons référencent l'asset autant que les publiés — un
  // brouillon oublié republierait l'ancien asset au prochain Publish.
  perspective: 'raw',
});

type Target = {
  assetId: string;
  url: string;
  originalFilename: string | null;
  size: number;
  width: number;
  height: number;
  photoRefs: { _id: string; year: number | null }[];
  heroDefault: string[];
  heroReveal: string[];
};

type Ref = { docId: string; field: string; year: number | undefined };

type LogEntry = {
  oldAssetId: string;
  newAssetId: string;
  source: 'portfolio' | 'cdn';
  from: { w: number; h: number; bytes: number };
  to: { w: number; h: number; bytes: number };
  patched: Ref[];
};

const TARGETS_QUERY = `
*[_type == "sanity.imageAsset" && (metadata.dimensions.width > $max || metadata.dimensions.height > $max)]{
  "assetId": _id, url, originalFilename, size,
  "width": metadata.dimensions.width, "height": metadata.dimensions.height,
  "photoRefs": *[_type == "photo" && image.asset._ref == ^._id]{ _id, year },
  "heroDefault": *[_id in ["siteSettings", "drafts.siteSettings"] && hero.defaultImage.asset._ref == ^._id]._id,
  "heroReveal": *[_id in ["siteSettings", "drafts.siteSettings"] && hero.revealImage.asset._ref == ^._id]._id
} | order(size desc)`;

function refsOf(t: Target): Ref[] {
  return [
    ...t.photoRefs.map((p) => ({ docId: p._id, field: 'image.asset._ref', year: p.year ?? undefined })),
    ...t.heroDefault.map((id) => ({ docId: id, field: 'hero.defaultImage.asset._ref', year: undefined })),
    ...t.heroReveal.map((id) => ({ docId: id, field: 'hero.revealImage.asset._ref', year: undefined })),
  ];
}

async function localMaster(name: string | null): Promise<Buffer | null> {
  if (!name) return null;
  try {
    return await fs.readFile(path.join(PORTFOLIO_DIR, name));
  } catch {
    return null;
  }
}

const mo = (b: number) => `${(b / 1024 / 1024).toFixed(1)} Mo`;

async function main(): Promise<void> {
  const all = await client.fetch<Target[]>(TARGETS_QUERY, { max: MAX_EDGE });
  // Les orphelins ne mènent nulle part : rien à repointer, on ne les touche pas.
  const targets = all.filter((t) => refsOf(t).length > 0).slice(0, LIMIT);
  const orphans = all.length - all.filter((t) => refsOf(t).length > 0).length;

  console.log(
    `${all.length} asset(s) au-dessus de ${MAX_EDGE} px, dont ${orphans} orphelin(s) ignoré(s).\n` +
      `${targets.length} à réduire (${mo(targets.reduce((s, t) => s + t.size, 0))}).\n`
  );
  for (const t of targets) {
    const local = (await localMaster(t.originalFilename)) !== null;
    console.log(
      `  ${(t.originalFilename ?? t.assetId).padEnd(44)} ${`${t.width}×${t.height}`.padEnd(10)} ` +
        `${mo(t.size).padStart(8)}  ${local ? 'master local' : 'via CDN'}  → ${refsOf(t).length} doc(s)`
    );
  }
  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour appliquer.');
    return;
  }

  const log: LogEntry[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const logPath = path.resolve(process.cwd(), `resources/downsize-assets-${stamp}.json`);
  await fs.mkdir(path.dirname(logPath), { recursive: true });

  for (const [i, t] of targets.entries()) {
    const name = t.originalFilename ?? `${t.assetId}.jpg`;
    console.log(`\n[${i + 1}/${targets.length}] ${name}`);
    let source = await localMaster(t.originalFilename);
    let origin: LogEntry['source'] = 'portfolio';
    if (!source) {
      const res = await fetch(t.url);
      if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
      source = Buffer.from(await res.arrayBuffer());
      origin = 'cdn';
    }

    const refs = refsOf(t);
    const year = refs.find((r) => r.year !== undefined)?.year;
    const prepared = await prepareForWeb(name, source, { year });
    const asset = await client.assets.upload('image', prepared.buffer, {
      filename: `${path.basename(name, path.extname(name))}.${prepared.ext}`,
      contentType: prepared.contentType,
    });

    for (const ref of refs) {
      await client.patch(ref.docId).set({ [ref.field]: asset._id }).commit();
    }
    console.log(
      `  ${prepared.from.w}×${prepared.from.h} ${mo(prepared.from.bytes)} → ` +
        `${prepared.to.w}×${prepared.to.h} ${Math.round(prepared.to.bytes / 1024)} Ko ` +
        `(${origin}) · ${refs.length} doc(s) repointé(s) → ${asset._id}`
    );

    log.push({ oldAssetId: t.assetId, newAssetId: asset._id, source: origin, from: prepared.from, to: prepared.to, patched: refs });
    // Journal écrit à CHAQUE pas : un plantage au 80ᵉ asset ne perd pas les 79.
    await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  }

  console.log(`\n✓ ${log.length} asset(s) réduit(s). Journal : ${path.relative(process.cwd(), logPath)}`);
  console.log('Les anciens assets restent en base (orphelins). Leur purge est une décision à part.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2 : Script npm, puis dry-run**

`package.json` :

```json
"downsize-assets": "node --env-file=.env.production --env-file=.env.local --import tsx scripts/downsize-assets.ts",
```

Run : `npm run downsize-assets`
Expected : `156 asset(s) au-dessus de 2048 px, dont 35 orphelin(s) ignoré(s).` puis `121 à réduire` (chiffres du jour de l'audit — hero « reveal » comprise, donc 122 si son asset dépasse ; vérifier que la ligne du hero apparaît avec `hero.revealImage`), une ligne par asset, aucune écriture.

- [ ] **Step 3 : Éprouver sur deux assets**

```bash
npm run downsize-assets -- --yes --limit 2
```

Puis vérifier sur les deux documents repointés :

```bash
curl -s -G "https://yh5i5diw.api.sanity.io/v2024-01-01/data/query/production" \
  --data-urlencode 'query=*[_type=="photo"] | order(_updatedAt desc)[0..1]{title, "w": image.asset->metadata.dimensions.width, "h": image.asset->metadata.dimensions.height, "kb": image.asset->size / 1024}'
```

Expected : deux photos avec `w`/`h` ≤ 2048 et `kb` ≤ 400. Lancer `npm run dev`, ouvrir `/archives/` avec Playwright et constater que ces deux photos s'affichent (le hotspot a suivi : il est relatif).

- [ ] **Step 4 : Appliquer à tout**

```bash
npm run downsize-assets -- --yes
```

Durée : quelques minutes (121 téléchargements de 2 à 30 Mo). Puis :

```bash
curl -s -G "https://yh5i5diw.api.sanity.io/v2024-01-01/data/query/production" \
  --data-urlencode 'query={"referencedOverCap": count(*[_type=="sanity.imageAsset" && count(*[_type=="photo" && references(^._id)])>0 && (metadata.dimensions.width>2048 || metadata.dimensions.height>2048)]), "heroReveal": *[_id=="siteSettings"][0].hero.revealImage.asset->metadata.dimensions.width, "totalOrphans": count(*[_type=="sanity.imageAsset" && count(*[references(^._id)])==0])}'
```

Expected : `referencedOverCap: 0`, `heroReveal ≤ 2048`, `totalOrphans` ≈ 69 + 121 (les anciens assets sont encore là — c'est voulu).

Relancer `npm run downsize-assets` (dry-run) : `0 à réduire`.

- [ ] **Step 5 : Mettre le docblock de `lib/sanity/image.ts` à jour**

Remplacer les lignes 8-21 par :

```ts
/**
 * Largeur maximale servie pour une photo, tous usages confondus.
 *
 * Doit rester alignée sur `MAX_EDGE` de `scripts/prepare-image.ts` (2048) et
 * sur `MAX_ASSET_EDGE` de `sanity/validation/assetWithinCap.ts`. Depuis le
 * 2026-09-11 (scripts/downsize-assets.ts), AUCUN asset référencé par le site
 * ne dépasse ce plafond : retirer `?w=` d'une URL rend au plus 2048 px, et le
 * Studio refuse de publier une photo plus grande. Ce plafond d'URL est donc
 * redevenu ce qu'il doit être — un garde-fou, pas la protection.
 *
 * Toujours vrai : le paramètre `max-w=` du CDN Sanity ne plafonne rien, et le
 * CDN ré-encode tout (métadonnées comprises). Seule la taille de l'asset
 * stocké compte.
 */
```

- [ ] **Step 6 : Commit**

```bash
git add scripts/downsize-assets.ts package.json lib/sanity/image.ts
git commit -m "feat(pipeline): réduction des assets stockés hors plafond et repointage des documents"
```

(`resources/` est gitignoré : le journal JSON n'est pas versionné, et c'est voulu.)

- [ ] **Step 7 : Purge des assets orphelins** (décision Alexandre, 2026-09-11 : « purge des anciens fichiers » — il détient les masters)

Créer `scripts/purge-orphan-assets.ts` :

```ts
/**
 * Supprime DÉFINITIVEMENT les assets image que plus AUCUN document ne
 * référence — les originaux pleine résolution laissés par downsize-assets.ts,
 * plus les orphelins antérieurs (69 au 2026-09-11).
 *
 *   npm run purge-orphan-assets            → DRY-RUN : liste, n'écrit rien
 *   npm run purge-orphan-assets -- --yes   → supprime
 *
 * IRRÉVERSIBLE. Décidé par Alexandre le 2026-09-11, qui détient les masters
 * (Lightroom). Garde-fou : la requête cherche les références dans TOUS les
 * types de documents, publiés et brouillons (`perspective: 'raw'`), et Sanity
 * refuse de toute façon de supprimer un asset encore référencé — une erreur
 * ici signifie qu'un document le pointe encore, pas qu'il faut forcer.
 */
import { createClient } from '@sanity/client';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;
const APPLY = process.argv.includes('--yes');

if (!PROJECT_ID) {
  console.error('✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant dans .env.local.');
  process.exit(1);
}
if (APPLY && !WRITE_TOKEN) {
  console.error('✗ SANITY_API_WRITE_TOKEN manquant dans .env.local.');
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  perspective: 'raw',
});

type Orphan = { _id: string; originalFilename: string | null; size: number; width: number; height: number };

const ORPHANS_QUERY = `
*[_type == "sanity.imageAsset" && count(*[references(^._id)]) == 0]{
  _id, originalFilename, size, "width": metadata.dimensions.width, "height": metadata.dimensions.height
} | order(size desc)`;

const mo = (b: number) => `${(b / 1024 / 1024).toFixed(1)} Mo`;

async function main(): Promise<void> {
  const orphans = await client.fetch<Orphan[]>(ORPHANS_QUERY);
  const total = orphans.reduce((s, o) => s + o.size, 0);
  console.log(`${orphans.length} asset(s) orphelin(s), ${mo(total)}.\n`);
  for (const o of orphans) {
    console.log(`  ${(o.originalFilename ?? o._id).padEnd(44)} ${`${o.width}×${o.height}`.padEnd(10)} ${mo(o.size).padStart(8)}`);
  }
  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour SUPPRIMER (irréversible).');
    return;
  }
  let done = 0;
  for (const o of orphans) {
    await client.delete(o._id);
    done++;
    if (done % 20 === 0) console.log(`  … ${done}/${orphans.length}`);
  }
  console.log(`\n✓ ${done} asset(s) supprimé(s), ${mo(total)} libérés.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

`package.json` :

```json
"purge-orphan-assets": "node --env-file=.env.local --import tsx scripts/purge-orphan-assets.ts",
```

Run : `npm run purge-orphan-assets` (dry-run). Expected : ≈ 190 assets (69 + 121 + hero « reveal »), ≈ 1,4 Go, **aucun nom qui apparaisse aussi dans la sortie de `npm run downsize-assets`** (qui doit être vide). Puis `npm run purge-orphan-assets -- --yes`. Puis :

```bash
curl -s -G "https://yh5i5diw.api.sanity.io/v2024-01-01/data/query/production" \
  --data-urlencode 'query={"assets": count(*[_type=="sanity.imageAsset"]), "orphans": count(*[_type=="sanity.imageAsset" && count(*[references(^._id)])==0]), "overCap": count(*[_type=="sanity.imageAsset" && (metadata.dimensions.width>2048 || metadata.dimensions.height>2048)]), "mo": math::sum(*[_type=="sanity.imageAsset"].size)/1048576}'
```

Expected : `orphans: 0`, `overCap: 0`, `assets` ≈ 229 (227 photos + 2 hero), `mo` ≈ 100 ou moins.

```bash
git add scripts/purge-orphan-assets.ts package.json
git commit -m "feat(pipeline): purge des assets orphelins (originaux pleine résolution)"
```

---

### Task 7: Guide pour Alexandre, journal, leçon, interdictions (R7)

**Files:**
- Create: `docs/PROTECTION-IMAGES.md`
- Modify: `CLAUDE.md` (§5 et §11.12)
- Modify: `docs/JOURNAL-CLAUDE.md` (EN HAUT)
- Create: `resources/learning/protection-images.md` (gitignoré)
- Modify: mémoire `photo-protection-existing-assets.md`

**Interfaces:** aucune.

- [ ] **Step 1 : Écrire `docs/PROTECTION-IMAGES.md`** (versionné, comme `NOMENCLATURE-PHOTOS.md` : il s'adresse au photographe)

```markdown
# Protéger tes photos en ligne — ce que le site fait, ce qu'il te reste à faire

> Pour Alexandre. Mis en place le 2026-09-11. L'audit complet est dans
> `docs/superpowers/specs/2026-09-11-protection-images-audit.md`.

## Ce qu'il faut savoir en une minute

Une photo affichée dans un navigateur est une photo déjà livrée : rien n'empêche
une capture d'écran. Le site ne cherche donc pas à empêcher la copie. Il fait
trois choses : il ne sert JAMAIS plus de 2048 px (inexploitable en impression :
17 × 11 cm à 300 dpi), il déclare ton nom, ton copyright et ta page de contact
à Google sur chaque photo (crédit d'auteur et badge « Licensable » dans Google
Images), et il refuse les robots d'entraînement d'IA de façon lisible par les
machines. Le clic droit bloqué est un signal, pas une protection.

Les métadonnées que Lightroom écrit dans tes fichiers (ton nom, le copyright)
N'ARRIVENT PAS jusqu'au visiteur : l'hébergeur d'images ré-encode tout et les
efface, comme Instagram ou Facebook. Elles servent ailleurs — voir ci-dessous.

## Ce que le site fait tout seul

- Plafond 2048 px sur tout le catalogue, y compris les anciennes photos.
- Le Studio REFUSE de publier une photo plus grande (message rouge sous l'image).
  Exporte à 2048 px, ou passe par `npm run upload-photos` qui réduit tout seul.
- Chaque page de photos porte ton nom, « © année Alexandre Matencio », un lien
  vers `/legal` (conditions) et `/contact` (demande de licence), lisibles par
  Google.
- Chaque page dit aux robots d'IA de ne pas s'en servir (`noai`, TDMRep).
  `robots.txt` les refuse aussi — il ne prendra effet qu'avec un domaine propre.
- Chaque fichier déposé dans Sanity est signé (EXIF + XMP), même si le CDN
  l'efface à la livraison : le jour où l'hébergement change, tout est prêt.

## Ce que toi seul peux faire

### 1. Lightroom : ton nom dans TOUS les fichiers (une fois, 5 minutes)

C'est le problème que tu décrivais. La correction se fait sur le catalogue, pas
photo par photo.

1. Module Bibliothèque → panneau Métadonnées → menu « Paramètres prédéfinis » →
   « Modifier les paramètres prédéfinis… ».
2. Coche et remplis : **Créateur** (Alexandre Matencio), **Copyright**
   (© Alexandre Matencio. All rights reserved.), **Statut du copyright**
   (Protégé par copyright), **Conditions d'utilisation des droits** (No use
   without prior written permission — licences: see website), **URL d'informations
   sur le copyright** (l'adresse de la page /legal du site). Enregistre sous
   « AM — droits ».
3. Sélectionne TOUTES les photos du catalogue (Ctrl/Cmd+A en vue Grille), puis
   applique le preset dans le panneau Métadonnées. Lightroom demande si tu veux
   appliquer à toutes les photos sélectionnées : oui.
4. Import : dans la fenêtre d'import, section « Appliquer pendant l'importation »,
   choisis le preset « AM — droits ». Chaque nouvelle photo l'aura.
5. Export : vérifie que « Métadonnées → Inclure : Tout » (ou au minimum
   « Copyright et informations de contact uniquement ») est coché, et que
   « Supprimer les informations de localisation » est coché (pas de GPS en ligne).

Lightroom (cloud/mobile) n'a que les champs Copyright et Créateur : remplis les
deux dans les Infos de chaque album, et fais le reste dans Lightroom Classic.

Ces métadonnées comptent pour tout ce que tu envoies à des tiers (presse,
concours, galeries, clients) — pas pour le site, qui les remplace par ses
déclarations à Google.

### 2. Preuve d'antériorité (une fois par an, 15 €)

Le droit d'auteur est automatique. Ce qui compte en cas de litige, c'est
prouver que TU avais la photo AVANT l'autre. Tes fichiers RAW et ton catalogue
Lightroom sont cette preuve : ne les perds jamais, sauvegarde-les hors de chez
toi. Une fois par an, dépose une enveloppe e-Soleau à l'INPI
(inpi.fr → e-Soleau, 15 € pour 10 Mo) avec une planche-contact PDF des nouvelles
photos : date certaine, reconnue par les tribunaux.

### 3. Surveiller les réutilisations (gratuit)

Crée un compte Pixsy (pixsy.com, gratuit jusqu'à 500 images) ou Copytrack
(copytrack.com, Berlin) et importe tes photos : ils cherchent où elles
apparaissent et proposent de gérer la réclamation à ta place, payés sur ce
qu'ils récupèrent. Sinon, une fois par trimestre : Google Images → icône
appareil photo → glisse une photo, ou tineye.com.

### 4. Quand tu trouves une photo volée

1. Capture d'écran de la page avec l'URL et la date visibles ; note l'adresse.
2. Cherche qui héberge le site : whois.domaintools.com ou hostingchecker.com.
3. Écris d'abord à l'auteur du site : « This photograph is mine (lien vers ta
   page /archives). Remove it within 7 days or license it: [tarif]. » Beaucoup
   retirent ou paient.
4. Sans réponse : notification à l'hébergeur. En France, c'est l'article 6-I-5
   de la LCEN (formulaire « signalement de contenu illicite » de l'hébergeur,
   avec ton identité, l'URL, la description des faits et la base légale : CPI
   art. L.122-4). Aux États-Unis, c'est une notice DMCA (chaque hébergeur a un
   formulaire, et Google a le sien pour retirer la page de ses résultats :
   google.com/webmasters/tools/dmca-notice). Les deux obligent au retrait.
5. Pour un usage commercial, Pixsy/Copytrack ou un avocat en propriété
   intellectuelle : le tarif de licence rétroactif se facture au double ou au
   triple du tarif normal.

## Décisions prises et à venir

- **Anciens fichiers pleine résolution** : purgés le 2026-09-11 sur ta décision
  (tu as les masters dans Lightroom). Sanity ne garde plus que les versions
  2048 px. Si une photo devait un jour être republiée plus grande, elle repart
  de ton master, jamais de Sanity.
- **Filigrane visible** : non, sur ta décision — il s'efface en un clic avec un
  outil d'IA, il abîme chaque photo, et il contredit « l'image d'abord ».
- **Domaine propre** : `robots.txt` et `/.well-known/tdmrep.json` ne sont lus
  qu'à la racine d'un domaine. Sous `github.io/photo-portfolio/`, ils sont
  inertes. Le jour du domaine, ils marchent sans rien changer.
```

- [ ] **Step 2 : Interdictions dans `CLAUDE.md`**

Dans §5 (bloc « SEO »), après la ligne « **Pas de contenu uniquement dans un canvas ou en WebGL** … », ajouter :

```markdown
- **Toute page qui rend des photos monte un `ImageGallery` JSON-LD** via `lib/seo/jsonld.ts` (`creator`, `creditText`, `copyrightNotice`, `license`, `acquireLicensePage` sur chaque `ImageObject`) — c'est la seule provenance lisible par les machines que le CDN Sanity laisse passer (il efface EXIF/IPTC/XMP). Le nom de l'auteur vit dans `lib/site/author.ts`, nulle part ailleurs.
```

Dans §11.12, ajouter en fin de liste :

```markdown
- ❌ **Déposer un asset image dans Sanity sans passer par `prepareForWeb`** (`client.assets.upload` avec un buffer brut) — le plafond de 2048 px et la signature EXIF/XMP ne valent que si TOUS les chemins y passent. Payé le 2026-09-11 : 121 assets stockés jusqu'à 6356 px, récupérables en retirant `?w=`. Le glisser-déposer du Studio, qu'on ne peut pas router, est verrouillé par `assetWithinCap` (erreur de publication) ; ne jamais le rétrograder en avertissement.
```

- [ ] **Step 3 : Journal, EN HAUT de `docs/JOURNAL-CLAUDE.md`** (sous la ligne `---` qui suit l'en-tête)

```markdown
**2026-09-11 (6)** : **protection des photographies** (demande Alexandre : « protéger mes photos… je n'ai pas pu mettre ma signature en métadonnées »). Audit mesuré : 296 assets / 1,70 Go, **121 assets référencés stockés jusqu'à 6356 px** (retirer `?w=` les rendait en entier), **0 métadonnée servie** (le CDN Sanity ré-encode tout, EXIF/XMP/IPTC/ICC à zéro même à l'URL originale — la signature Lightroom n'aurait rien changé), aucune donnée structurée, `robots.txt` inerte (sous `/photo-portfolio/`, les robots lisent la racine github.io, qui répond 404), `/legal` en brouillon avec Vercel déclaré hébergeur. Fait : JSON-LD `ImageGallery`/`ImageObject` avec `creator`/`creditText`/`copyrightNotice`/`license`/`acquireLicensePage` sur `/`, `/about`, `/archives`, `/series` ; balises `noai`/`tdm-reservation` dans `buildMetadata` (les seules effectives aujourd'hui) + `robots.txt` anti-IA + `tdmrep.json` + sitemap image (prêts pour le domaine) ; `/legal` et `/privacy` sous Sanity (`legalBody`, `privacyBody`) avec GitHub comme hébergeur et une clause de licence ; `prepareForWeb` signe EXIF+XMP ; verrou Studio `assetWithinCap` (erreur) ; `set-hero` via le pipeline ; `OriginalViewer` supprimé ; `og-default.jpg` généré et signé (seule image servie intacte) ; `downsize-assets` a repointé 121 photos + hero sur des assets ≤ 2048 px (anciens laissés orphelins, journal dans `resources/`). Pas de filigrane visible (avis tranché, spec §1). Anciens assets purgés (décision Alexandre, masters dans Lightroom). Restent à Alexandre : preset Lightroom, e-Soleau, Pixsy, domaine (`docs/PROTECTION-IMAGES.md`). Leçon générale : sur un CDN qui ré-encode, la provenance vit dans la PAGE (JSON-LD), pas dans le FICHIER.
```

- [ ] **Step 4 : Leçon dans `resources/learning/protection-images.md`** (gitignoré ; sans code, selon `resources/learning/README.md`)

```markdown
# Protection des photographies d'un portfolio servi par un CDN qui ré-encode

Date : 2026-09-11. Projet : AMATENCIO PHOTO. Audit :
docs/superpowers/specs/2026-09-11-protection-images-audit.md.

## Ce qu'on croyait / ce qui est vrai

- On croyait qu'écrire le copyright dans les fichiers protégeait le site. Faux
  ici : le CDN Sanity ré-encode tout et vide EXIF, XMP, IPTC et ICC, même à
  l'URL originale (vérifié sur 5 fichiers, taille servie ≠ taille stockée).
  Vrai en général pour Instagram, Facebook, X. La provenance lisible par les
  machines vit donc dans la PAGE (JSON-LD ImageObject : creator, creditText,
  copyrightNotice, license, acquireLicensePage), et Google Images la lit à la
  place de l'IPTC. Les métadonnées de fichier gardent leur valeur pour les
  masters et les envois à des tiers.
- On croyait que plafonner les URLs (`?w=2048`) protégeait. Faux : l'id d'asset
  est dans la page et l'URL nue rend l'asset stocké. Seule la taille STOCKÉE
  compte. Corollaire : tout chemin d'upload doit réduire (script) ou refuser
  (validation Studio sur `metadata.dimensions`).
- On croyait que `robots.txt` agissait. Faux sous un basePath GitHub Pages :
  les robots lisent la racine du domaine. Seules les balises <meta> agissent.

## Ce qui vaut pour un autre projet

- Les 5 champs Google pour le crédit + badge Licensable, et le pattern
  « builders purs + composant <JsonLd> + un ImageGallery par page de photos ».
- La validation Sanity asynchrone qui lit les dimensions de l'asset et bloque
  la publication : le seul verrou possible sur le glisser-déposer du Studio.
- Le script de réduction idempotent, dry-run par défaut, avec journal old → new
  écrit à chaque pas et anciens assets laissés orphelins (réversible).
- Le pied de page « © année / All rights reserved » sans titulaire est un avis
  faible : nommer le titulaire.
- Le filigrane visible se retire en un clic par IA générative en 2026 :
  recommander contre sur un portfolio d'auteur.
```

Puis copier les trois briques réutilisables dans `~/Documents/FREELANCE/RESOURCES/existing-components/image-protection/` (`jsonld.ts`, `assetWithinCap.ts`, `downsize-assets.ts`, un `README.md` de 20 lignes qui renvoie à cette leçon) et ajouter une ligne dans la table §C de `RESOURCES/CAPITAL.md`. Si l'accès à `RESOURCES/` est refusé dans la session, le dire dans le compte rendu final : c'est le protocole de capitalisation, pas une option.

- [ ] **Step 5 : Mémoire de session**

Réécrire `~/.claude/projects/-Users-baronmuster-Documents-FREELANCE-AMATENCIO-PHOTO/memory/photo-protection-existing-assets.md` : les 121 assets sont réduits et repointés le 2026-09-11 (journal dans `resources/downsize-assets-2026-09-11.json`) ; les anciens assets sont purgés ; ce qui reste ouvert est le **domaine propre** (rend `robots.txt` et `tdmrep.json` effectifs). Mettre la ligne de `MEMORY.md` à jour en conséquence.

- [ ] **Step 6 : Commit**

```bash
git add docs/PROTECTION-IMAGES.md CLAUDE.md docs/JOURNAL-CLAUDE.md
git commit -m "docs(protection): guide pour le photographe, interdictions, journal"
```

---

### Task 8: Vérification finale et remise

**Files:** aucun.

- [ ] **Step 1 : Tout relancer**

```bash
npm run typecheck && npm run check-image-prep && npm run check-jsonld && npm run build
```

Expected : tout vert, build sans erreur ni avertissement nouveau.

- [ ] **Step 2 : Contrôle de l'export, en une passe**

```bash
grep -c 'application/ld+json' out/archives/index.html out/series/index.html out/about/index.html out/index.html \
 && grep -o 'tdm-reservation" content="1"' out/contact/index.html \
 && ls out/.well-known/tdmrep.json out/og-default.jpg \
 && grep -c 'Disallow: /$' out/robots.txt \
 && grep -c 'image:loc' out/sitemap.xml \
 && grep -c 'Vercel' out/legal/index.html
```

Expected : `1` par page pour le JSON-LD, la balise TDM présente, les deux fichiers listés, autant de `Disallow: /` que de robots IA, un `image:loc` par photo visible, `0` Vercel.

- [ ] **Step 3 : Compte rendu à Alexandre, puis attente du feu vert**

Le compte rendu dit, dans cet ordre : ce qui est en ligne dès le prochain déploiement (et que rien n'est déployé), ce que le Studio refuse désormais, les trois chiffres (assets réduits, photos repointées, orphelins restants), les cinq actions qui n'appartiennent qu'à lui (`docs/PROTECTION-IMAGES.md`), et la question de la purge. **Le déploiement (`npm run deploy` ou le workflow bfast) n'est lancé que sur sa réponse**, parce que `/legal` change de contenu public et que la fusion dans `main` est sa décision (CLAUDE.md §8.3).

Après son feu vert : `git checkout main && git merge --no-ff feat/image-protection && git push origin main`, puis déploiement, puis :

```bash
curl -s https://alexandrematencio.github.io/photo-portfolio/og-default.jpg -o /tmp/og.jpg \
 && node -e "require('sharp')('/tmp/og.jpg').metadata().then(m=>console.log('exif',!!m.exif,'xmp',!!m.xmp))"
```

Expected : `exif true xmp true` — la preuve que GitHub Pages sert le fichier intact, contrairement au CDN.

---

## Auto-revue

**Couverture de la spec** : R1 → tâche 6 ; R2 → tâche 4 (validation, set-hero, OriginalViewer) ; R3 → tâche 1 ; R4 → tâche 3 ; R5 → tâche 2 ; R6 → tâches 4 et 5 ; R7 → tâche 7 (guide). Spec §4 (ce qu'on ne fait pas) : aucun filigrane, aucune dépendance, aucun `noimageindex`, plafond inchangé — respecté. Spec §5 : la purge, hors plan à l'écriture, a été ajoutée en tâche 6 étape 7 sur décision d'Alexandre.

**Cohérence des noms** : `prepareForWeb(filepath, source, opts?)` — même signature en 4, 5 (non utilisée : `make-og-image` recadre lui-même, c'est voulu, une image de partage n'est pas une photo du catalogue), 6. `exifRights`/`xmpRights` définis en 4, consommés en 5. `AUTHOR_NAME`/`copyrightNotice` définis en 1, consommés en 3 et 4. `assetWithinCap` défini et consommé en 4. `imageGalleryJsonLd({ name, path, id?, description?, photos })` — même forme en 1 (archives, series) et dans `check-jsonld`.

**Placeholders** : les seuls crochets restants sont dans le repli de `/legal` (`[Legal status, SIRET…]`, `[Address]`), et ils sont VOULUS : seul Alexandre connaît ces valeurs, et il les saisit dans le Studio — le repli le dit.
