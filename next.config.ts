import type { NextConfig } from 'next';

// `output: 'export'` produit un dossier `out/` statique 100% client → déployable sur GitHub Pages.
// `next dev` n'est pas affecté (export n'agit que pendant `next build`).
// `images.unoptimized` est requis avec export (pas d'API d'optimisation côté serveur).
// `basePath` : préfixe d'URL quand le site est servi sous /<repo>/ (cas GH Pages).
//   En local : NEXT_PUBLIC_BASE_PATH est vide → site servi à la racine.
//   En CI : le workflow set NEXT_PUBLIC_BASE_PATH=/<repo>.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true, // GH Pages préfère les slashs finaux pour les dossiers
  basePath,
  // Le basePath est aussi appliqué aux assets : les imports d'image local fonctionnent
  images: {
    unoptimized: true, // mandatory en export statique
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
