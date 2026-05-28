import { groq } from 'next-sanity';
import { sanityClient } from './client';

export type PhotoCategory =
  | 'landscape'
  | 'architecture'
  | 'portrait'
  | 'streetphotography';

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
  category: PhotoCategory;
  year: number;
  location: string;
  dateTaken?: string;
  onHomepage: boolean;
  order: number;
  parallaxSpeed: number;
  series?: { _ref: string } | null;
};

export type Series = {
  _id: string;
  title: string;
  slug: { current: string };
  subtitle?: string;
  year?: number;
  order: number;
};

export type MotionSettings = {
  scaleMin: number;
  skewMax: number;
  rotXMax: number;
  velocityDivisorScale: number;
  velocityDivisorSkew: number;
  velocityDivisorRotX: number;
};

export type SiteSettings = {
  profileImage?: {
    asset: { _ref: string };
    alt?: string;
    hotspot?: { x: number; y: number };
    dimensions?: { width: number; height: number; aspectRatio: number };
  };
  aboutBody?: unknown[];
  contactBody?: unknown[];
  digitalAgencyBody?: unknown[];
  socialsBody?: unknown[];
  socials?: { platform: string; url: string }[];
  motion?: MotionSettings;
};

const photoProjection = groq`
  _id, title, slug, caption, category, year, location, dateTaken, onHomepage, order, parallaxSpeed, series,
  image {
    ...,
    "dimensions": asset->metadata.dimensions
  }
`;

const seriesProjection = groq`
  _id, title, slug, subtitle, year, order
`;

const homepagePhotosQuery = groq`
  *[_type == "photo" && onHomepage == true] | order(order asc) { ${photoProjection} }
`;

const allPhotosQuery = groq`
  *[_type == "photo"] | order(year desc, order asc) { ${photoProjection} }
`;

const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0] {
    aboutBody, contactBody, digitalAgencyBody, socialsBody, socials, motion,
    profileImage {
      ...,
      "dimensions": asset->metadata.dimensions
    }
  }
`;

export async function getHomepagePhotos(): Promise<Photo[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<Photo[]>(homepagePhotosQuery, {}, {
    next: { revalidate: 60 },
  });
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
  *[_type == "photo" && !defined(series)] | order(_updatedAt desc) { ${photoProjection} }
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

export async function getPhotosWithoutSeries(): Promise<Photo[]> {
  if (!sanityClient) return [];
  return sanityClient.fetch<Photo[]>(photosWithoutSeriesQuery, {}, {
    next: { revalidate: 60 },
  });
}
