import type { NextConfig } from 'next';

// Deploy via gh-pages package (local, pas GitHub Actions). Voir yml-deploy-guide.md.
// - `output: 'export'` → produit /out (Next.js statique) — UNIQUEMENT en prod.
//   En dev, on garde le runtime dynamique : sinon le catch-all `/studio/[[...tool]]`
//   du Sanity Studio explose en 500 dès qu'on navigue dans la SPA (Next dev enforce
//   `generateStaticParams` exhaustif quand output:'export' est actif).
// - `basePath` = "/photo-portfolio" en prod, vide en dev (pour que `next dev` reste à la racine)
// - `assetPrefix` doit matcher basePath sinon les <link>/<script>/<img> 404
// - `trailingSlash: true` car GH Pages ne réécrit pas /carte → /carte/index.html
// - `images.unoptimized: true` car pas de runtime serveur
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '/photo-portfolio' : '';

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'export' as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
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
