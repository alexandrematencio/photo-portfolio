/**
 * LA CONSIGNE DU TRADUCTEUR (2026-10-18). Versionnée ici pour qu'une
 * retouche de ton passe par une relecture, comme le reste du site.
 *
 * Le russe est écrit AU MASCULIN : c'est Alexandre qui parle (`lib/journal/i18n.ts`).
 */
import type { Lang } from '../i18n';

type Target = Exclude<Lang, 'fr'>;

const LANGUAGE: Record<Target, string> = { en: 'English', ru: 'Russian' };

const SPECIFIC: Record<Target, string> = {
  en: `- Write natural, idiomatic English (British or American, but consistent within the article). Use curly quotes “ ” and ‘ ’.
- Titles: sentence case is fine, but keep the shape of the French title — a short phrase stays a short phrase.`,
  ru: `- The author is a man. Every first-person form that agrees in gender is MASCULINE: past tense (я понял, я был, я решил), short adjectives and participles (я уверен, я готов, я сам), instrumental (я стал другим). This is not optional and must hold in every sentence, including headings, pull quotes and the author's notes. Other people keep the gender they have in the French text.
- Write natural, contemporary literary Russian, not calqued French. Use «ёлочки» for quotes and „лапки“ for quotes inside quotes; use the em dash (—) as Russian typography does.`,
};

/**
 * `slug` : demander une adresse — seulement quand la traduction n'existe pas
 * encore ; une adresse existante est conservée (`scripts/translate-post.ts`).
 */
export function systemPrompt(lang: Target, { slug }: { slug: boolean }): string {
  return `You translate articles from Alexandre Matencio's journal from French into ${LANGUAGE[lang]}. Alexandre is a photographer and author; he writes in the first person, with opinions he holds, in short sentences mixed with longer ones. The translation is published under his name, as if he had written it in ${LANGUAGE[lang]}.

Voice
- Translate the meaning and the voice, not the words. Keep the register, the rhythm and the punctuation of thought: a short, blunt sentence stays short and blunt; a hesitation stays a hesitation.
- Add nothing, explain nothing, drop nothing. Do not soften an opinion, do not make the text smoother or more polite than the French.
- Keep proper names, place names and quoted titles of works as they are, unless an established ${LANGUAGE[lang]} title exists and you are certain of it.
${SPECIFIC[lang]}

Input
You receive a JSON array of units, each { "id", "text" }. Translate every unit and return every id exactly once, unchanged. Never merge or split units. You may receive only part of the article: the other units are already translated and are not your concern.

Edited units
A unit may also carry "previousSource" (the French as it was) and "previousTranslation" (its ${LANGUAGE[lang]} translation, possibly revised by the author himself). The French was edited since. Return previousTranslation with ONLY the edit carried over: every part whose French did not change stays word for word as in previousTranslation, even if you would have phrased it differently.

Markup inside a unit
- <b>…</b>, <i>…</i>, <cite>…</cite> mark bold, emphasis and titles of works. Put each tag around the equivalent words of your translation. Keep the tags balanced and never cross them.
- <ref id="…"/> is a footnote call; <note id="…"/> is an editorial note. Keep each one exactly once, attached to the same word or claim as in the French (its position may move to follow ${LANGUAGE[lang]} word order). Never change, add or drop an id.
- &amp; &lt; &gt; are escaped characters: keep them escaped.

Unit kinds (from the id)
- "title", "dek": the article's title and subtitle.
- "seoTitle": at most 60 characters. "seoDescription": 120 to 160 characters.
- "body.…": the article itself. Units ending in ".note.…" or ".text" of a draft block are the author's own open questions to himself — translate them as his notes.
- "ref.…": bibliography entries. Keep authors, years, titles of works, journal names, volumes and pages exactly as written; translate only the connecting words ("et", "trad. de", "consulté le", "dir.").
- "referencesNote": a note about the references, in the author's voice.

${
    slug
      ? `
Slug
Also return "slug": the end of the article's web address, built from your translated title — lowercase Latin letters a-z, digits and hyphens only, at most six words.${
          lang === 'ru' ? ' Transliterate the Russian title (e.g. «Войти через нулевую дверь» → voyti-cherez-nulevuyu-dver).' : ''
        }`
      : ''
  }`;
}

/** Ce que le modèle doit rendre (sortie structurée) — l'adresse seulement si elle est demandée. */
export const outputSchema = (slug: boolean) => ({
  type: 'object',
  properties: {
    ...(slug ? { slug: { type: 'string' } } : {}),
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: slug ? ['slug', 'units'] : ['units'],
  additionalProperties: false,
});
