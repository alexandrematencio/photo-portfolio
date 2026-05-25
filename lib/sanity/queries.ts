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
  hireBody?: unknown[];
  socials?: { platform: string; url: string }[];
  motion?: MotionSettings;
};

const photoProjection = groq`
  _id, title, slug, caption, category, year, location, dateTaken, onHomepage, order, parallaxSpeed,
  image {
    ...,
    "dimensions": asset->metadata.dimensions
  }
`;

const homepagePhotosQuery = groq`
  *[_type == "photo" && onHomepage == true] | order(order asc) { ${photoProjection} }
`;

const allPhotosQuery = groq`
  *[_type == "photo"] | order(year desc, order asc) { ${photoProjection} }
`;

const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0] {
    aboutBody, contactBody, hireBody, socials, motion,
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
