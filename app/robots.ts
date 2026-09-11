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
