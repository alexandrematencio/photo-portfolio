/**
 * JEV TRIE LA DÉRIVE DE LA CONCEPT MAP (appelé par `map:check`).
 *
 * Une citation introuvable veut dire l'une de trois choses, et seul le sens du
 * texte permet de trancher :
 *
 *   reprise    l'idée est toujours là, en d'autres mots → nouvelle citation
 *              proposée (une phrase exacte de l'article, p ≥ 0,8) ;
 *   à vérifier une phrase s'en approche (0,5 ≤ p < 0,8) → proposée, à relire ;
 *   retirée    plus rien ne la porte → thèse à revoir, ou `public: false`.
 *
 * Jev juge chaque phrase de l'article contre l'ancienne citation. La
 * proposition va dans `citation_proposee` (+ `citation_proposee_p`) de la
 * note, que `map:build` ne lit pas : Alexandre la recopie dans `citation`.
 */
import { blockText, normalizeQuote, type MapBlock } from '../../lib/journal/mapAnchors';
import type { CheckedNode } from '../../lib/journal/conceptMap';
import { ask, noulOf, type Question } from './client';
import { readVault, setProperties, str } from './vault';

const SURE = 0.8;
const MAYBE = 0.5;

export type Triage = { label: string; slug: string; verdict: 'reprise' | 'à vérifier' | 'retirée' | 'corrigée dans le vault'; sentence?: string; p?: number; note?: string };

/** Les phrases d'un article, dans l'ordre (paragraphes et intertitres exclus). */
export function sentences(body: MapBlock[] | undefined) {
  return (body ?? [])
    .filter((b) => b._type === 'block' && (b.style ?? 'normal') === 'normal')
    .flatMap((b) => blockText(b).split(/(?<=[.!?…»])\s+(?=[«"“A-ZÀ-ÖØ-Ý0-9])/u))
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export async function triageDrift(drifted: CheckedNode[], bodyOf: Map<string, MapBlock[] | undefined>, write: boolean) {
  const notes = readVault();
  const noteOf = (n: CheckedNode) =>
    n.kind === 'mechanism'
      ? notes.find((x) => x.meta.type === 'mécanisme' && x.file === n.nodeId.slice(2))
      : notes.find((x) => (x.meta.type === 'thèse' || x.meta.type === 'these') && `t:${str(x.meta.article_slug)}:${Number(x.meta.ordre)}` === n.nodeId);

  const out: Triage[] = [];
  for (const n of drifted) {
    const slug = n.kind === 'mechanism' ? n.quoteArticle ?? '' : n.article?.replace(/^a:/, '') ?? '';
    const body = bodyOf.get(slug);
    const note = noteOf(n);
    const all = sentences(body);

    // Déjà corrigé dans le vault, pas encore exporté : rien à demander à Jev.
    const vaultQuote = normalizeQuote(str(note?.meta.citation));
    if (vaultQuote && vaultQuote !== normalizeQuote(n.quote ?? '') && all.some((s) => normalizeQuote(s).includes(vaultQuote))) {
      out.push({ label: n.label, slug, verdict: 'corrigée dans le vault', note: note?.file });
      continue;
    }

    const questions: Record<string, Question> = Object.fromEntries(
      all.map((s, i) => [
        `s${i}`,
        {
          type: 'noul',
          instructions: `Does this sentence from the current article make the same point as the old quote? « ${s} »`,
          criteria: {
            true: 'Same claim, reworded, shortened or expanded',
            false: 'A different claim, even on the same topic or with shared words',
          },
        },
      ]),
    );
    const answers = await ask({ old_quote: n.quote ?? '', what_it_supports: n.label }, questions, 'map:check');
    const best = all.map((s, i) => ({ s, p: noulOf(answers[`s${i}`]) })).sort((a, b) => b.p - a.p)[0];

    const verdict = !best || best.p < MAYBE ? 'retirée' : best.p >= SURE ? 'reprise' : 'à vérifier';
    const t: Triage = { label: n.label, slug, verdict, note: note?.file };
    if (verdict !== 'retirée') Object.assign(t, { sentence: best.s, p: best.p });
    out.push(t);

    if (write && note && verdict !== 'retirée')
      setProperties(note.path, { citation_proposee: best.s, citation_proposee_p: Math.round(best.p * 100) / 100 });
  }
  return out;
}
