import { AI_TRAINING_CRAWLERS } from '../robots';
import { SITE_INFO } from '@/lib/seo/metadata';

/**
 * robots.txt du journal (build `SITE_TARGET=blog`). Même politique que le
 * portfolio (`app/robots.ts` : moteurs de recherche oui, collecte pour
 * l'entraînement d'IA non), avec le sitemap du blog.
 *
 * Route classique et non fichier `robots.blog.ts` : les fichiers spéciaux
 * de métadonnées (robots, sitemap) ne suivent pas le tri par `pageExtensions`
 * du build du blog — constaté le 2026-10-17, `robots.txt` en 500.
 */
export const dynamic = 'force-static';

export function GET() {
  const body = [
    ...AI_TRAINING_CRAWLERS.map((ua) => `User-Agent: ${ua}`),
    'Disallow: /',
    '',
    'User-Agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_INFO.url}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
