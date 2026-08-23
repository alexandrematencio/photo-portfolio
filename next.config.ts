import type { NextConfig } from 'next';

// Deploy via GitHub Actions (`.github/workflows/deploy.yml`) depuis le 2026-08-22 ;
// `npm run deploy` (gh-pages, local) reste branché en secours. Voir yml-deploy-guide.md.
// - `output: 'export'` → produit /out (Next.js statique) — UNIQUEMENT en prod.
//   En dev, on garde le runtime dynamique : sinon le catch-all `/studio/[[...tool]]`
//   du Sanity Studio explose en 500 dès qu'on navigue dans la SPA (Next dev enforce
//   `generateStaticParams` exhaustif quand output:'export' est actif).
// - `basePath` vient de `NEXT_PUBLIC_BASE_PATH` (`.env.production` / `.env.development`),
//   PAS d'un littéral : `lib/utils/asset.ts` a besoin de la même valeur pour préfixer les
//   assets de `/public/`, et deux littéraux à garder d'accord, c'est un jour de migration
//   où l'un des deux est oublié. Vider la variable = site à la racine (domaine propre).
// - `assetPrefix` doit matcher basePath sinon les <link>/<script>/<img> 404
// - `trailingSlash: true` car GH Pages ne réécrit pas /carte → /carte/index.html
// - `images.unoptimized: true` car pas de runtime serveur
const isProd = process.env.NODE_ENV === 'production';
// Source unique du basePath, partagée avec `lib/utils/asset.ts`.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
