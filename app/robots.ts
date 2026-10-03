import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/**
 * Robots d'ENTRAÎNEMENT refusés ; les robots de RECHERCHE (Googlebot,
 * Googlebot-Image, Bingbot…) restent autorisés : le site veut être trouvé, pas
 * ingéré. `Google-Extended` et `Applebot-Extended` ne touchent pas à
 * l'indexation, ils ne gouvernent que l'usage pour Gemini / Apple Intelligence.
 *
 * Servi à la racine de amatencio.com depuis le 2026-10-01 : c'est la seule
 * adresse où les robots le lisent. Les balises <meta> de buildMetadata
 * doublent ces règles pour les copies et les miroirs.
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
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://amatencio.com';
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
