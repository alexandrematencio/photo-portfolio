/**
 * JEV — le modèle de décision typée de TypeSafe (https://docs.typesafe.ai).
 *
 * Jev ne rédige pas : il répond à des questions typées (`noul` oui/non,
 * `choice`, `score`) sur un `state`. Ici, il trie ce que Claude ou Alexandre
 * valident ensuite ; rien de ce qu'il répond n'est publié tel quel.
 *
 * - Clé : `TYPESAFE_API_KEY` (.env.local). Fournisseur direct uniquement :
 *   jevtypesafeai.com est un revendeur tiers, il verrait la clé et les textes.
 * - Prix : 0,042 $ par million de jetons en entrée, sortie gratuite (oct. 2026).
 * - Plafond mensuel : `JEV_MONTHLY_CAP_USD` (2 $ par défaut). Chaque appel est
 *   journalisé dans `_jev/spend.jsonl`, hors dépôt, pour que le plafond vaille
 *   pour tous les worktrees à la fois.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const JEV_MODEL = 'jev-1.14.0';
const ENDPOINT = process.env.TYPESAFE_ENDPOINT ?? 'https://api.typesafe.ai/v1/systemone';
const USD_PER_TOKEN = 0.042 / 1e6;
const CAP = Number(process.env.JEV_MONTHLY_CAP_USD ?? 2);

/** Hors des dépôts : partagé par am-blog, am-photo et les autres worktrees. */
export const JEV_DIR = process.env.JEV_DIR ?? path.join(homedir(), 'Documents/ALEX-PERSO/BLOG/_jev');
const SPEND_LOG = path.join(JEV_DIR, 'spend.jsonl');

export type Noul = { type: 'noul'; instructions: string; criteria?: { true: string; false: string } };
export type Choice = { type: 'choice'; instructions: string; criteria: Record<string, string | null> };
export type Score = { type: 'score'; instructions: string; criteria: string[] };
export type Question = Noul | Choice | Score;

export type Answer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> };

export const jevConfigured = () => Boolean(process.env.TYPESAFE_API_KEY);

/** Dépense du mois en cours, d'après le journal. */
export function spentThisMonth(now = new Date()) {
  if (!existsSync(SPEND_LOG)) return 0;
  const month = now.toISOString().slice(0, 7);
  return readFileSync(SPEND_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { at: string; cost_usd: number })
    .filter((e) => e.at.startsWith(month))
    .reduce((s, e) => s + e.cost_usd, 0);
}

/** Estimation grossière (≈ 3,5 caractères par jeton) : sert au plafond et au découpage, jamais à la facture. */
export const estimateTokens = (v: unknown) => Math.ceil(JSON.stringify(v).length / 3.5);

/** Budgets de Jev 1.14 : 64k pour state + toutes les questions, 32k pour state + la plus longue. Marge de 15 %. */
const REQUEST_BUDGET = 54_000;
const QUESTION_BUDGET = 27_000;

async function call(state: unknown, questions: Record<string, Question>, script: string) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error('TYPESAFE_API_KEY manquant (.env.local)');
  const estimate = estimateTokens({ state, questions }) * USD_PER_TOKEN;
  const spent = spentThisMonth();
  if (spent + estimate > CAP)
    throw new Error(`Plafond Jev atteint : ${spent.toFixed(4)} $ dépensés ce mois, plafond ${CAP} $ (JEV_MONTHLY_CAP_USD)`);

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    // Un appel raté est une erreur, jamais un « non ».
    if (!res.ok) throw new Error(`Jev ${res.status} : ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { model: string; answers: Record<string, Answer>; usage: { input_tokens: number } };
    const cost = body.usage.input_tokens * USD_PER_TOKEN;
    mkdirSync(JEV_DIR, { recursive: true });
    appendFileSync(
      SPEND_LOG,
      JSON.stringify({ at: new Date().toISOString(), script, model: body.model, input_tokens: body.usage.input_tokens, cost_usd: cost }) + '\n',
    );
    return body.answers;
  }
}

/**
 * Pose toutes les questions sur un même state, en autant de requêtes que les
 * budgets l'exigent (les questions sont indépendantes : les découper ne change
 * pas les réponses).
 */
export async function ask(state: unknown, questions: Record<string, Question>, script: string) {
  const base = estimateTokens(state);
  const batches: Record<string, Question>[] = [{}];
  let size = base;
  for (const [id, q] of Object.entries(questions)) {
    const t = estimateTokens(q);
    if (base + t > QUESTION_BUDGET) throw new Error(`Question « ${id} » trop longue pour Jev avec ce state (~${base + t} jetons)`);
    if (size + t > REQUEST_BUDGET && Object.keys(batches.at(-1)!).length) {
      batches.push({});
      size = base;
    }
    batches.at(-1)![id] = q;
    size += t;
  }
  const answers: Record<string, Answer> = {};
  for (const b of batches) Object.assign(answers, await call(state, b, script));
  return answers;
}

export const noulOf = (a: Answer | undefined) => (a?.type === 'noul' ? a.noul : NaN);

/** Ligne de bilan à afficher en fin de script. */
export const spendLine = () => `Jev : ${spentThisMonth().toFixed(4)} $ dépensés ce mois (plafond ${CAP} $)`;
