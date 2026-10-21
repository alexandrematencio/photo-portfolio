/**
 * TRADUCTION D'UN ARTICLE DU JOURNAL en anglais et en russe, par Claude
 * (2026-10-18). Écrit des BROUILLONS (`drafts.<id>-en`, `drafts.<id>-ru`) :
 * Alexandre les relit et les publie dans le Studio (décision du 2026-10-18).
 *
 *   npm run translate-post -- <id de l'article>           → écrit les deux brouillons
 *   npm run translate-post -- <id> --lang ru              → une seule langue
 *   npm run translate-post -- <id> --dry-run              → affiche, n'écrit rien
 *   npm run translate-post -- <id> --full                 → tout retraduire, sans rien reprendre
 *   npm run translate-post -- <id> --adopt                → marque les traductions existantes à jour, sans appel
 *   npm run translate-post -- --job translationJob.<id>   → ce que lance le VPS
 *
 * Le mode `--job` est celui du bouton du Studio (`lib/journal/translate/job.ts`) :
 * il ne traduit que les langues de la demande (`langs`), et ne la prend
 * que si elle est encore `requested` (une livraison
 * doublée du webhook ne traduit pas deux fois) et y écrit l'avancement.
 *
 * INCRÉMENTAL (`lib/journal/translate/incremental.ts`) : seules les unités
 * dont le français a changé depuis la dernière traduction partent au modèle,
 * avec leur ancienne version ; le reste est repris tel quel, retouches
 * comprises. Rien de changé → aucun appel, aucun brouillon écrit.
 *
 * Le brouillon est réécrit ; la version PUBLIÉE de la traduction n'est jamais
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
import { outputSchema, systemPrompt } from '../lib/journal/translate/prompt';
import { canonical, planUnits, readSnapshot, snapshotOf, type UnitPlan } from '../lib/journal/translate/incremental';
import {
  isFrenchPost,
  jobLangs,
  TRANSLATION_LANGS,
  type TranslationJob,
  type TranslationLang,
  type TranslationResult,
} from '../lib/journal/translate/job';
import { applyUnits, localizeImages, type SourcePost, type TranslatedFields } from '../lib/journal/translate/units';

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
const FULL = args.includes('--full');
const ADOPT = args.includes('--adopt');
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

const Output = z.object({
  slug: z.string().optional(),
  units: z.array(z.object({ id: z.string(), text: z.string() })),
});

type PostDoc = SourcePost & {
  _type: string;
  language?: string;
  slug?: { current?: string };
  translationOf?: { _ref: string };
  translationSource?: string;
};

/**
 * Ce que le modèle doit traduire, et rien d'autre : les unités modifiées ou
 * neuves (`planUnits`). Sans unité à traduire, aucun appel.
 */
async function translate(
  post: SourcePost,
  lang: TranslationLang,
  plan: UnitPlan,
  needSlug: boolean,
): Promise<{ fields: TranslatedFields; slug?: string }> {
  if (!plan.pending.length) return { fields: applyUnits(post, [...plan.reused].map(([id, text]) => ({ id, text }))) };
  const wanted = new Set(plan.pending.map((u) => u.id));
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const stream = anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema: outputSchema(needSlug) } },
      system: systemPrompt(lang, { slug: needSlug }),
      messages: [{ role: 'user', content: JSON.stringify(plan.pending, null, 1) }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new Error(`${lang} : le modèle a refusé (${message.stop_details?.category ?? 'sans catégorie'})`);
    if (message.stop_reason === 'max_tokens') throw new Error(`${lang} : réponse tronquée (max_tokens)`);
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    console.log(`  ${lang} : ${message.usage.input_tokens} → ${message.usage.output_tokens} jetons (essai ${attempt})`);
    try {
      const out = Output.parse(JSON.parse(text));
      // Une unité reprise ne peut pas être écrasée par le modèle, même s'il la renvoie.
      const fresh = out.units.filter((u) => wanted.has(u.id));
      const units = [...[...plan.reused].map(([id, t]) => ({ id, text: t })), ...fresh];
      return { fields: applyUnits(post, units), slug: out.slug };
    } catch (e) {
      lastError = e;
      console.warn(`  ${lang} : réponse refusée — ${(e as Error).message}`);
    }
  }
  throw new Error(`${lang} : ${(lastError as Error).message}`);
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/**
 * La traduction existante : son id publié (celui qui existe, sinon
 * `<id>-<langue>`) et la version à reprendre — le BROUILLON s'il existe (il
 * porte les dernières retouches d'Alexandre), sinon la version publiée.
 */
async function existingTranslation(postId: string, lang: TranslationLang) {
  const docs = await sanity.fetch<PostDoc[]>(`*[_type == "post" && language == $lang && translationOf._ref == $postId]`, {
    lang,
    postId,
  });
  const publishedId =
    docs.find((d) => !d._id.startsWith('drafts.'))?._id ?? docs[0]?._id.replace(/^drafts\./, '') ?? `${postId}-${lang}`;
  const doc = docs.find((d) => d._id === `drafts.${publishedId}`) ?? docs.find((d) => d._id === publishedId) ?? null;
  return { publishedId, doc, all: docs.filter((d) => d._id.replace(/^drafts\./, '') === publishedId) };
}

/** Adresse d'une traduction NEUVE : celle que propose le modèle, dé-doublonnée. */
async function freshSlug(lang: TranslationLang, publishedId: string, proposed: string | undefined) {
  const base = slugify(proposed ?? '') || publishedId;
  const taken = new Set(
    await sanity.fetch<string[]>(`*[_type == "post" && language == $lang && !(_id in [$id, "drafts." + $id])].slug.current`, { lang, id: publishedId }),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function sourcePost(postId: string) {
  const post = await sanity.getDocument<PostDoc>(postId);
  if (!post || post._type !== 'post') throw new Error(`Article publié introuvable : ${postId}`);
  if (!isFrenchPost(post)) throw new Error(`${postId} n'est pas un article français`);
  return post;
}

async function run(postId: string, langs: TranslationLang[], onLang?: (lang: TranslationLang, result: TranslationResult) => Promise<void>) {
  const post = await sourcePost(postId);
  console.log(`▸ ${post.title} (${postId}) → ${langs.join(', ')}${FULL ? ' — tout retraduire' : ''}`);
  const source = JSON.stringify(snapshotOf(post));

  const outcomes = await Promise.allSettled(
    langs.map(async (lang) => {
      try {
        const { publishedId, doc: existing } = await existingTranslation(postId, lang);
        const plan = planUnits(post, existing, readSnapshot(existing?.translationSource), FULL);
        const keptSlug = existing?.slug?.current;
        console.log(`  ${lang} : ${plan.pending.length} unité(s) à traduire, ${plan.reused.size} reprise(s)`);

        const { fields, slug: proposed } = await translate(post, lang, plan, !keptSlug);
        const slug = keptSlug ?? (await freshSlug(lang, publishedId, proposed));
        const draftId = `drafts.${publishedId}`;
        const doc = {
          _id: draftId,
          _type: 'post',
          language: lang,
          translationOf: { _type: 'reference', _ref: postId },
          slug: { _type: 'slug', current: slug },
          ...fields,
          body: localizeImages(fields.body, lang),
          translationSource: source,
        };
        const counts = { translated: plan.pending.length, reused: plan.reused.size };

        // Rien n'a changé (ni texte ni structure) : pas de brouillon inutile.
        const { _id: _ignored, ...content } = doc;
        const same =
          existing && canonical(content) === canonical(Object.fromEntries(Object.keys(content).map((k) => [k, existing[k as keyof PostDoc]])));
        if (same) {
          console.log(`  = ${lang} : déjà à jour — ${existing._id}`);
          await onLang?.(lang, { draftId: existing._id, slug, unchanged: true, ...counts });
          return;
        }

        if (DRY_RUN) console.log(JSON.stringify(doc, null, 2));
        else await sanity.createOrReplace(doc);
        console.log(`  ✓ ${lang} : ${DRY_RUN ? '(non écrit) ' : ''}${draftId} — /${lang}/${slug}/`);
        await onLang?.(lang, { draftId, slug, ...counts });
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

/**
 * `--adopt` : déclare les traductions existantes À JOUR du français publié,
 * sans appel au modèle. Pour les traductions écrites avant la traduction
 * incrémentale (pas de `translationSource`), qui seraient sinon retraduites
 * en entier à la prochaine demande. À ne lancer que si le français n'a pas
 * changé depuis leur génération : une phrase modifiée entre-temps ne serait
 * jamais retraduite.
 */
async function adopt(postId: string) {
  const post = await sourcePost(postId);
  const source = JSON.stringify(snapshotOf(post));
  for (const lang of LANGS) {
    const { all } = await existingTranslation(postId, lang);
    if (!all.length) {
      console.log(`  – ${lang} : aucune traduction`);
      continue;
    }
    const tx = sanity.transaction();
    for (const d of all) tx.patch(d._id, (p) => p.set({ translationSource: source }));
    if (!DRY_RUN) await tx.commit();
    console.log(`  ✓ ${lang} : ${all.map((d) => d._id).join(', ')} ${DRY_RUN ? '(non écrit)' : 'marquées à jour'}`);
  }
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
    // Seulement les langues demandées : une demande « EN » ne touche pas au brouillon russe.
    await run(job.post, jobLangs(job), (lang, result) => sanity.patch(jobId).set({ [`results.${lang}`]: result }).commit().then(() => undefined));
    await sanity.patch(jobId).set({ status: 'done', finishedAt: new Date().toISOString() }).commit();
  } catch (e) {
    await sanity.patch(jobId).set({ status: 'error', error: (e as Error).message, finishedAt: new Date().toISOString() }).commit();
    throw e;
  }
}

const POST_ID = POST_ARG?.replace(/^drafts\./, '');
(JOB_ID ? runJob(JOB_ID) : ADOPT ? adopt(POST_ID!) : run(POST_ID!, LANGS)).catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
