import { groq } from 'next-sanity';
import { sanityClient } from './client';

export type PhotoStyle = {
  _id: string;
  title: string;
  slug: string;
};

export type PhotoGear = {
  _id: string;
  title: string;
  slug: string;
};

export type Photo = {
  _id: string;
  title: string;
  slug: { current: string };
  image?: {
    asset: { _ref: string };
    alt?: string;
    hotspot?: { x: number; y: number };
    dimensions?: { width: number; height: number; aspectRatio: number };
  };
  caption?: string;
  /** 1 à 3 styles, déréférencés. La photo apparaît dans chaque groupe de style. */
  styles?: PhotoStyle[];
  year: number;
  location: string;
  dateTaken?: string;
  camera?: PhotoGear | null;
  lens?: PhotoGear | null;
  parallaxSpeed: number;
  /**
   * Séries auxquelles la photo appartient — MULTIPLE depuis le 2026-08-21.
   * Source de vérité de l'appartenance (l'ordre, lui, vit sur la série :
   * `series.photoOrder`). Aucun composant du site ne lit ce champ : les pages
   * passent par `references()`, qui traite indifféremment une référence unique
   * et un tableau. C'est ce qui a permis de migrer sans casser le site en ligne.
   */
  series?: { _ref: string }[] | null;
  /**
   * Séries d'appartenance déréférencées pour l'AFFICHAGE (bloc texte de la
   * home, où le nom de série est un lien vers `/series#<slug>`). `series`
   * reste la source de vérité relationnelle ; on ne dérive ici qu'un libellé
   * et son ancre. `series[]->` sur une photo legacy dont `series` est une
   * référence unique (non migrée) rend `null` sans casser la requête — d'où
   * l'optionnalité.
   */
  seriesLinks?: { title: string; slug: string }[] | null;
};

export type Series = {
  _id: string;
  title: string;
  slug: { current: string };
  subtitle?: string;
  year?: number;
  order: number;
};

/** Série avec ses photos déréférencées — consommée par /series. */
export type SeriesWithPhotos = Series & {
  coverRef: string | null;
  photos: Photo[];
  /**
   * Ordre d'affichage voulu par l'éditeur (`series.photoOrder`). CLÉ DE TRI,
   * pas liste d'appartenance : celle-ci reste `photo.series`, seule et unique.
   * Peut être absent, incomplet ou périmé — `prepareSeries` croise les deux.
   */
  photoOrderRefs: string[] | null;
};

export type MotionSettings = {
  scaleMin: number;
  skewMax: number;
  rotXMax: number;
  velocityDivisorScale: number;
  velocityDivisorSkew: number;
  velocityDivisorRotX: number;
};

export type HeroImage = {
  asset: { _ref: string };
  alt?: string;
  hotspot?: { x: number; y: number };
  crop?: { top: number; bottom: number; left: number; right: number };
  dimensions?: { width: number; height: number; aspectRatio: number };
};

export type SiteSettings = {
  hero?: {
    defaultImage?: HeroImage;
    revealImage?: HeroImage;
  };
  aboutBody?: unknown[];
  contactBody?: unknown[];
  digitalAgencyBody?: unknown[];
  socialsBody?: unknown[];
  motion?: MotionSettings;
};

const photoProjection = groq`
  _id, title, slug, caption, year, location, dateTaken, parallaxSpeed, series,
  "seriesLinks": series[]->{ title, "slug": slug.current },
  "styles": styles[]->{ _id, title, "slug": slug.current },
  "camera": camera->{ _id, title, "slug": slug.current },
  "lens": lens->{ _id, title, "slug": slug.current },
  image {
    ...,
    "dimensions": asset->metadata.dimensions
  }
`;

const seriesProjection = groq`
  _id, title, slug, subtitle, year, order
`;

// La home lit l'array ordonné siteSettings.curation : les photos sortent
// déjà dans l'ordre de curation (drag & drop dans le Studio).
const homepagePhotosQuery = groq`
  *[_type == "siteSettings"][0].curation[]->{ ${photoProjection} }
`;

const allPhotosQuery = groq`
  *[_type == "photo"] | order(year desc, title asc) { ${photoProjection} }
`;

const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0] {
    aboutBody, contactBody, digitalAgencyBody, socialsBody, motion,
    hero {
      defaultImage { ..., "dimensions": asset->metadata.dimensions },
      revealImage { ..., "dimensions": asset->metadata.dimensions }
    }
  }
`;

export async function getHomepagePhotos(): Promise<Photo[]> {
  if (!sanityClient) return [];
  const photos = await sanityClient.fetch<(Photo | null)[] | null>(
    homepagePhotosQuery,
    {},
    { next: { revalidate: 60 } }
  );
  // null si curation absente ; entrées null si référence cassée.
  return (photos ?? []).filter((p): p is Photo => Boolean(p));
}

export async function getAllPhotos(): Promise<Photo[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<Photo[]>(allPhotosQuery, {}, {
    next: { revalidate: 60 },
  });
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!sanityClient) return null;
  return sanityClient.fetch<SiteSettings | null>(siteSettingsQuery, {}, {
    next: { revalidate: 300 },
  });
}

const allSeriesQuery = groq`
  *[_type == "series"] | order(order asc, year desc) { ${seriesProjection} }
`;

const photosBySeriesQuery = groq`
  *[_type == "photo" && references(*[_type == "series" && slug.current == $slug][0]._id)]
    | order(order asc) { ${photoProjection} }
`;

const photosWithoutSeriesQuery = groq`
  *[_type == "photo" && (!defined(series) || count(series) == 0)] | order(_updatedAt desc) { ${photoProjection} }
`;

export async function getAllSeries(): Promise<Series[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<Series[]>(allSeriesQuery, {}, {
    next: { revalidate: 60 },
  });
}

export async function getPhotosBySeries(slug: string): Promise<Photo[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<Photo[]>(photosBySeriesQuery, { slug }, {
    next: { revalidate: 60 },
  });
}

// Toutes les séries avec leurs photos — la page /series filtre elle-même les
// séries vides, résout la cover (coverPhoto → repli 1ʳᵉ photo) et applique
// les deux ordres éditoriaux, via lib/site/series.ts.
//
// `items` sort dans l'ordre de repli (`order` asc, titre asc), et `photos`
// dans celui du CATALOGUE (année desc) : ce sont les ordres qu'obtiennent une
// série absente de `seriesOrder` et une photo absente de `photoOrder`. Le tri
// éditorial est appliqué à la lecture, PAS ici — GROQ ne sait pas trier selon
// la position dans un tableau de références.
const seriesWithPhotosQuery = groq`
{
  "seriesOrderRefs": *[_type == "siteSettings"][0].seriesOrder[]._ref,
  "items": *[_type == "series"] | order(order asc, title asc) {
    ${seriesProjection},
    "coverRef": coverPhoto._ref,
    "photoOrderRefs": photoOrder[]._ref,
    "photos": *[_type == "photo" && references(^._id)] | order(year desc, title asc) { ${photoProjection} }
  }
}
`;

export type SeriesWithPhotosResult = {
  /** Ordre des piles sur /series (`siteSettings.seriesOrder`) — clé de tri. */
  seriesOrderRefs: string[] | null;
  items: SeriesWithPhotos[];
};

export async function getSeriesWithPhotos(): Promise<SeriesWithPhotosResult> {
  if (!sanityClient) return { seriesOrderRefs: null, items: [] };
  return sanityClient.fetch<SeriesWithPhotosResult>(seriesWithPhotosQuery, {}, {
    next: { revalidate: 60 },
  });
}

export async function getPhotosWithoutSeries(): Promise<Photo[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<Photo[]>(photosWithoutSeriesQuery, {}, {
    next: { revalidate: 60 },
  });
}
