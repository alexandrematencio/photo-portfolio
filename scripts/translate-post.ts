/**
 * TRADUCTION D'UN ARTICLE DU JOURNAL en anglais et en russe, par Claude
 * (2026-10-18). Écrit des BROUILLONS (`drafts.<id>-en`, `drafts.<id>-ru`) :
 * Alexandre les relit et les publie dans le Studio (décision du 2026-10-18).
 *
 *   npm run translate-post -- <id de l'article>           → écrit les deux brouillons
 *   npm run translate-post -- <id> --lang ru              → une seule langue
 *   npm run translate-post -- <id> --dry-run              → affiche, n'écrit rien
 *   npm run translate-post -- --job translationJob.<id>   → ce que lance le VPS
 *
 * Le mode `--job` est celui du bouton du Studio (`lib/journal/translate/job.ts`) :
 * il ne prend la demande que si elle est encore `requested` (une livraison
 * doublée du webhook ne traduit pas deux fois) et y écrit l'avancement.
 *
 * Toujours régénérées (décision du 2026-10-18) : le brouillon est réécrit à
 * chaque demande. La version PUBLIÉE de la traduction, elle, n'est jamais
 * touchée — elle reste en ligne jusqu'à ce qu'Alexandre publie le brouillon.
 * L'ADRESSE d'une traduction existante est conservée : un lien partagé ne
 * casse pas parce que le français a été corrigé.
 *
 * Variables : NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
 * SANITY_API_WRITE_TOKEN, ANTHROPIC_API_KEY.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { z } from 'zod';
import { OUTPUT_SCHEMA, systemPrompt } from '../lib/journal/translate/prompt';
import {
  isFrenchPost,
  TRANSLATION_LANGS,
  type TranslationJob,
  type TranslationLang,
} from '../lib/journal/translate/job';
import { applyUnits, extractUnits, type SourcePost, type TranslatedFields } from '../lib/journal/translate/units';

const MODEL = 'claude-opus-5-5';
/** Une réponse invalide (unité manquante, appel de note perdu) est redemandée une fois. */
const ATTEMPTS = 2;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const JOB_ID = flag('--job');
const DRY_RUN = args.includes('--dry-run');
const LANGS = (flag('--lang')?.split(',') ?? [...TRANSLATION_LANGS]) as TranslationLang[];
const POST_ARG = args.find((a, i) => !a.startsWith('--') && !['--job', '--lang'].includes(args[i - 1]));

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const TOKEN = process.env.SANITY_API_WRITE_TOKEN;
if (!PROJECT_ID) throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID manquant');
if (!TOKEN) throw new Error('SANITY_API_WRITE_TOKEN manquant');
if (!JOB_ID && !POST_ARG) throw new Error('Usage : translate-post <id de l’article> | --job <id de la demande>');
if (LANGS.some((l) => !TRANSLATION_LANGS.includes(l))) throw new Error(`--lang : ${TRANSLATION_LANGS.join(', ')}`);

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2026-01-01',
  token: TOKEN,
  useCdn: false,
  perspective: 'raw',
});
const anthropic = new Anthropic();

const Output = z.object({ slug: z.string(), units: z.array(z.object({ id: z.string(), text: z.string() })) });

async function translate(post: SourcePost, lang: TranslationLang): Promise<{ fields: TranslatedFields; slug: string }> {
  const units = extractUnits(post);
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const stream = anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: systemPrompt(lang),
      messages: [{ role: 'user', content: JSON.stringify(units, null, 1) }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new Error(`${lang} : le modèle a refusé (${message.stop_details?.category ?? 'sans catégorie'})`);
    if (message.stop_reason === 'max_tokens') throw new Error(`${lang} : réponse tronquée (max_tokens)`);
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    console.log(`  ${lang} : ${message.usage.input_tokens} → ${message.usage.output_tokens} jetons (essai ${attempt})`);
    try {
      const out = Output.parse(JSON.parse(text));
      return { fields: applyUnits(post, out.units), slug: out.slug };
    } catch (e) {
      lastError = e;
      console.warn(`  ${lang} : réponse refusée — ${(e as Error).message}`);
    }
  }
  throw new Error(`${lang} : ${(lastError as Error).message}`);
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Id publié de la traduction et adresse : celles qui existent déjà, sinon `<id>-<langue>` et l'adresse proposée, dé-doublonnée. */
async function target(postId: string, lang: TranslationLang, proposed: string) {
  const existing = await sanity.fetch<{ _id: string; slug?: string }[]>(
    `*[_type == "post" && language == $lang && translationOf._ref == $postId]{_id, "slug": slug.current}`,
    { lang, postId },
  );
  const publishedId = existing.find((d) => !d._id.startsWith('drafts.'))?._id ?? existing[0]?._id.replace(/^drafts\./, '') ?? `${postId}-${lang}`;
  const kept = existing.find((d) => d._id.replace(/^drafts\./, '') === publishedId && d.slug)?.slug;
  if (kept) return { publishedId, slug: kept };

  const base = slugify(proposed) || publishedId;
  const taken = new Set(
    await sanity.fetch<string[]>(`*[_type == "post" && language == $lang && !(_id in [$id, "drafts." + $id])].slug.current`, { lang, id: publishedId }),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return { publishedId, slug };
}

async function run(postId: string, onLang?: (lang: TranslationLang, result: { draftId?: string; slug?: string; error?: string }) => Promise<void>) {
  const post = await sanity.getDocument<SourcePost & { language?: string; _type: string }>(postId);
  if (!post || post._type !== 'post') throw new Error(`Article publié introuvable : ${postId}`);
  if (!isFrenchPost(post)) throw new Error(`${postId} n'est pas un article français`);
  console.log(`▸ ${post.title} (${postId}) → ${LANGS.join(', ')}`);

  const outcomes = await Promise.allSettled(
    LANGS.map(async (lang) => {
      try {
        const { fields, slug: proposed } = await translate(post, lang);
        const { publishedId, slug } = await target(postId, lang, proposed);
        const draftId = `drafts.${publishedId}`;
        const doc = {
          _id: draftId,
          _type: 'post',
          language: lang,
          translationOf: { _type: 'reference', _ref: postId },
          slug: { _type: 'slug', current: slug },
          ...fields,
        };
        if (DRY_RUN) console.log(JSON.stringify(doc, null, 2));
        else await sanity.createOrReplace(doc);
        console.log(`  ✓ ${lang} : ${DRY_RUN ? '(non écrit) ' : ''}${draftId} — /${lang}/${slug}/`);
        await onLang?.(lang, { draftId, slug });
      } catch (e) {
        console.error(`  ✗ ${(e as Error).message}`);
        await onLang?.(lang, { error: (e as Error).message });
        throw e;
      }
    }),
  );
  const failed = outcomes.filter((o) => o.status === 'rejected');
  if (failed.length) throw new Error(failed.map((o) => ((o as PromiseRejectedResult).reason as Error).message).join(' · '));
}

async function runJob(jobId: string) {
  const job = await sanity.getDocument<TranslationJob>(jobId);
  if (!job) throw new Error(`Demande introuvable : ${jobId}`);
  if (job.status !== 'requested') {
    console.log(`Demande ${jobId} déjà prise (${job.status}) — rien à faire.`);
    return;
  }
  // Prise atomique : si une autre livraison du webhook l'a prise entre-temps, la révision a changé.
  await sanity
    .patch(jobId)
    .ifRevisionId(job._rev!)
    .set({ status: 'running', startedAt: new Date().toISOString(), results: {} })
    .unset(['error', 'finishedAt'])
    .commit();
  try {
    await run(job.post, (lang, result) => sanity.patch(jobId).set({ [`results.${lang}`]: result }).commit().then(() => undefined));
    await sanity.patch(jobId).set({ status: 'done', finishedAt: new Date().toISOString() }).commit();
  } catch (e) {
    await sanity.patch(jobId).set({ status: 'error', error: (e as Error).message, finishedAt: new Date().toISOString() }).commit();
    throw e;
  }
}

(JOB_ID ? runJob(JOB_ID) : run(POST_ARG!.replace(/^drafts\./, ''))).catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
