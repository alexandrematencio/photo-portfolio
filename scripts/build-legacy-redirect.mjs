#!/usr/bin/env node
/**
 * Coquille de redirection pour l'ancien domaine (alexandrematencio.github.io/
 * photo-portfolio/), servi par la branche `gh-pages`.
 *
 * GitHub Pages ne sait pas faire de 301. La seule façon de transférer le
 * classement est donc une page par ancienne route, avec une canonical vers la
 * nouvelle adresse + un refresh immédiat (Google traite `refresh 0` comme une
 * redirection permanente). Une 404 générique ne transférerait rien : elle dirait
 * « page disparue ».
 *
 * Usage : node scripts/build-legacy-redirect.mjs <dossier-de-sortie>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TARGET = 'https://amatencio.com';
const OUT = process.argv[2];
if (!OUT) {
  console.error('Usage: build-legacy-redirect.mjs <outDir>');
  process.exit(1);
}

// Anciennes routes → nouvelles. `/digital-agency` a déménagé le 2026-08-20.
const ROUTES = {
  '': '/',
  about: '/about/',
  'about/digital-agency': '/about/digital-agency/',
  'digital-agency': '/about/digital-agency/',
  series: '/series/',
  archives: '/archives/',
  contact: '/contact/',
  socials: '/socials/',
  legal: '/legal/',
  privacy: '/privacy/',
};

const page = (dest) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alexandre Matencio — moved to amatencio.com</title>
<link rel="canonical" href="${dest}">
<meta http-equiv="refresh" content="0; url=${dest}">
<meta name="robots" content="follow">
<script>location.replace(${JSON.stringify(dest)} + location.search + location.hash);</script>
</head>
<body>
<p>This site has moved to <a href="${dest}">${dest}</a>.</p>
</body>
</html>
`;

for (const [dir, route] of Object.entries(ROUTES)) {
  const folder = join(OUT, dir);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.html'), page(TARGET + route));
}

// Toute autre adresse : la même page de chemin, reconstruite côté client
// (/photo-portfolio/x/y/ → amatencio.com/x/y/), repli sur la racine.
writeFileSync(
  join(OUT, '404.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Alexandre Matencio — moved to amatencio.com</title>
<meta name="robots" content="noindex, follow">
<script>
var p = location.pathname.replace(/^\\/photo-portfolio/, '') || '/';
location.replace(${JSON.stringify(TARGET)} + p + location.search + location.hash);
</script>
</head>
<body>
<p>This site has moved to <a href="${TARGET}/">amatencio.com</a>.</p>
</body>
</html>
`,
);
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`Coquille écrite dans ${OUT} (${Object.keys(ROUTES).length} routes + 404)`);
