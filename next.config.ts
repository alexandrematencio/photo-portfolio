import type { NextConfig } from 'next';

// Deploy via gh-pages package (local, pas GitHub Actions). Voir yml-deploy-guide.md.
// - `output: 'export'` → produit /out (Next.js statique)
// - `basePath` = "/photo-portfolio" en prod, vide en dev (pour que `next dev` reste à la racine)
// - `assetPrefix` doit matcher basePath sinon les <link>/<script>/<img> 404
// - `trailingSlash: true` car GH Pages ne réécrit pas /carte → /carte/index.html
// - `images.unoptimized: true` car pas de runtime serveur
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '/photo-portfolio' : '';

const nextConfig: NextConfig = {
  output: 'export',
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
