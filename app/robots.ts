import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/**
 * Robots d'ENTRAÎNEMENT refusés ; les robots de RECHERCHE restent autorisés —
 * Googlebot, Bingbot, mais aussi ceux des assistants qui CITENT et renvoient
 * vers le site (OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User,
 * DuckAssistBot, MistralAI-User, rouverts le 2026-10-04 sur décision
 * d'Alexandre) : le site veut être trouvé, pas ingéré. `Google-Extended` et
 * `Applebot-Extended` ne touchent pas à l'indexation, ils ne gouvernent que
 * l'usage pour Gemini / Apple Intelligence.
 *
 * Servi à la racine de amatencio.com depuis le 2026-10-01 : c'est la seule
 * adresse où les robots le lisent. Les balises <meta> de buildMetadata
 * doublent ces règles pour les copies et les miroirs.
 */
const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
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
  'Ai2Bot',
  'PanguBot',
  'Webzio-Extended',
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
