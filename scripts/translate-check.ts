/**
 * JEV RELIT UNE TRADUCTION, UNITÉ PAR UNITÉ, CONTRE LE FRANÇAIS.
 *
 *   npm run translate:check -- <id de l'article>              → EN et RU
 *   npm run translate:check -- <id> --lang ru
 *   npm run translate:check -- <id> --calibrate               → plante des fautes, mesure ce que Jev attrape
 *
 * Les unités sont celles de `translate-post` (`extractUnits`) : mêmes
 * identifiants en français et dans la traduction, donc on les apparie sans
 * deviner. Pour chacune, trois questions : un passage omis, un passage
 * ajouté, un sens déplacé. Une unité est signalée dès que l'une passe 0,7 ;
 * entre 0,4 et 0,7, elle est « à relire ».
 *
 * La traduction lue est le BROUILLON s'il existe (celui qu'Alexandre va
 * publier), sinon la version publiée. N'écrit rien.
 */
import { createClient } from '@sanity/client';
import { extractUnits, type SourcePost, type Unit } from '../lib/journal/translate/units';
import { TRANSLATION_LANGS, type TranslationLang } from '../lib/journal/translate/job';
import { ask, jevConfigured, noulOf, spendLine, type Question } from './jev/client';

const FLAG = 0.7;
const DOUBT = 0.4;
const CONCURRENCY = 6;
const LANGUAGE = { en: 'English', ru: 'Russian' } as const;

const QUESTIONS: Record<string, Question> = {
  omission: {
    type: 'noul',
    instructions: 'Does `translation` leave out something that `french` says?',
    criteria: { true: 'A fact, clause, example or nuance of the French is missing', false: 'Everything the French says is in the translation, even if rephrased' },
  },
  addition: {
    type: 'noul',
    instructions: 'Does `translation` add something that `french` does not say?',
    criteria: { true: 'A fact, claim, example or sentence appears that the French does not contain', false: 'Nothing is added beyond normal rephrasing' },
  },
  shift: {
    type: 'noul',
    instructions: 'Does `translation` change the meaning of something that `french` says?',
    criteria: {
      true: 'A claim is reversed, weakened, strengthened or attributed differently',
      false: 'Same claims with the same strength; only wording differs',
    },
  },
};

export type UnitCheck = { id: string; french: string; translation: string; omission: number; addition: number; shift: number };

/** Juge chaque unité traduite contre son original. Les unités trop courtes (noms, chiffres) sont sautées. */
export async function checkTranslation(fr: Unit[], tr: Unit[], lang: TranslationLang) {
  const trBy = new Map(tr.map((u) => [u.id, u.text]));
  const pairs = fr.filter((u) => u.text.length >= 25 && trBy.has(u.id));
  const out: UnitCheck[] = [];
  for (let i = 0; i < pairs.length; i += CONCURRENCY) {
    const batch = pairs.slice(i, i + CONCURRENCY);
    out.push(
      ...(await Promise.all(
        batch.map(async (u) => {
          const translation = trBy.get(u.id)!;
          const a = await ask({ language: LANGUAGE[lang], french: u.text, translation }, QUESTIONS, 'translate:check');
          return { id: u.id, french: u.text, translation, omission: noulOf(a.omission), addition: noulOf(a.addition), shift: noulOf(a.shift) };
        }),
      )),
    );
  }
  const worst = (c: UnitCheck) => Math.max(c.omission, c.addition, c.shift);
  return {
    checked: out,
    flagged: out.filter((c) => worst(c) >= FLAG),
    doubtful: out.filter((c) => worst(c) >= DOUBT && worst(c) < FLAG),
    missing: fr.filter((u) => u.text.trim() && !trBy.has(u.id)).map((u) => u.id),
  };
}

export function printCheck(lang: TranslationLang, r: Awaited<ReturnType<typeof checkTranslation>>) {
  const why = (c: UnitCheck) =>
    (['omission', 'addition', 'shift'] as const)
      .filter((k) => c[k] >= DOUBT)
      .map((k) => `${{ omission: 'omis', addition: 'ajouté', shift: 'sens déplacé' }[k]} ${c[k].toFixed(2)}`)
      .join(', ');
  console.log(`  ${lang} : ${r.checked.length} unités relues — ${r.flagged.length} signalée(s), ${r.doubtful.length} à relire`);
  for (const c of [...r.flagged, ...r.doubtful]) {
    console.log(`    ${r.flagged.includes(c) ? '⚠' : '?'} ${c.id} (${why(c)})`);
    console.log(`      FR : ${c.french.slice(0, 220)}`);
    console.log(`      ${lang.toUpperCase()} : ${c.translation.slice(0, 220)}`);
  }
  if (r.missing.length) console.log(`    ⚠ absentes de la traduction : ${r.missing.join(', ')}`);
}

// ---------- calibrage ----------

const splitSentences = (s: string) => s.split(/(?<=[.!?…])\s+/u);

/** Plante des fautes connues dans une copie : une phrase retirée, une phrase d'ailleurs ajoutée. */
function plant(tr: Unit[]) {
  const long = tr.filter((u) => u.id.startsWith('body.') && splitSentences(u.text).length >= 3);
  const faults = new Map<string, 'omission' | 'addition'>();
  const copy = tr.map((u) => ({ ...u }));
  const at = new Map(copy.map((u) => [u.id, u]));
  long.forEach((u, i) => {
    if (i % 5 === 0) {
      const s = splitSentences(u.text);
      s.splice(Math.floor(s.length / 2), 1);
      at.get(u.id)!.text = s.join(' ');
      faults.set(u.id, 'omission');
    } else if (i % 5 === 2) {
      const donor = long[(i + Math.floor(long.length / 2)) % long.length];
      at.get(u.id)!.text = `${u.text} ${splitSentences(donor.text)[0]}`;
      faults.set(u.id, 'addition');
    }
  });
  return { copy, faults };
}

// ---------- ligne de commande ----------

async function main() {
  const args = process.argv.slice(2);
  const postId = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang')?.replace(/^drafts\./, '');
  const langs = (args.includes('--lang') ? args[args.indexOf('--lang') + 1].split(',') : [...TRANSLATION_LANGS]) as TranslationLang[];
  if (!postId) throw new Error('Usage : npm run translate:check -- <id de l’article> [--lang en,ru] [--calibrate]');
  if (!jevConfigured()) throw new Error('TYPESAFE_API_KEY manquant (.env.local) : Jev non configuré');

  const sanity = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'yh5i5diw',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
    apiVersion: '2026-01-01',
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
    perspective: 'raw',
  });
  const fr = await sanity.getDocument<SourcePost & { title?: string }>(postId);
  if (!fr) throw new Error(`Article publié introuvable : ${postId}`);
  console.log(`translate:check — ${fr.title} (${postId})${args.includes('--calibrate') ? ' · calibrage' : ''}`);

  for (const lang of langs) {
    const docs = await sanity.fetch<SourcePost[]>(`*[_type == "post" && language == $lang && translationOf._ref == $postId]`, { lang, postId });
    const tr = docs.find((d) => d._id.startsWith('drafts.')) ?? docs[0];
    if (!tr) {
      console.log(`  ${lang} : aucune traduction`);
      continue;
    }
    const frUnits = extractUnits(fr);
    const trUnits = extractUnits(tr);

    if (args.includes('--calibrate')) {
      const { copy, faults } = plant(trUnits);
      const r = await checkTranslation(frUnits, copy, lang);
      const caught = [...faults.keys()].filter((id) => r.flagged.some((c) => c.id === id));
      const clean = r.checked.filter((c) => !faults.has(c.id));
      const falseAlarms = clean.filter((c) => r.flagged.includes(c));
      console.log(`  ${lang} : ${caught.length}/${faults.size} fautes plantées attrapées ; ${falseAlarms.length}/${clean.length} fausses alertes`);
      for (const [id, kind] of faults) {
        const c = r.checked.find((x) => x.id === id);
        console.log(`    ${caught.includes(id) ? '✓' : '✗'} ${id} — ${kind}, p ${c ? c[kind].toFixed(2) : '?'}`);
      }
      for (const c of falseAlarms) console.log(`    ! ${c.id} signalée sans faute plantée (omis ${c.omission.toFixed(2)}, ajouté ${c.addition.toFixed(2)}, sens ${c.shift.toFixed(2)})`);
      continue;
    }
    printCheck(lang, await checkTranslation(frUnits, trUnits, lang));
  }
  console.log(spendLine());
}

if (process.argv[1]?.endsWith('translate-check.ts'))
  main().catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
