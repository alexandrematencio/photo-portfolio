/**
 * Garde-fous de la traduction par Claude (audit 2.8, 2026-11-07).
 *
 * 1. PLAFOND D'APPELS. Le bouton du Studio déclenche un appel payant sur le
 *    VPS. Un compte Studio volé, ou une boucle de webhook, pourrait en
 *    enchaîner des centaines. En mode `--job` (le seul qui se déclenche à
 *    distance), chaque appel au modèle est inscrit dans un registre local du
 *    compte `translator` ; au-delà de MAX_CALLS_PER_DAY sur 24 h glissantes,
 *    le script refuse d'appeler et la demande passe en erreur dans le Studio.
 *    Le plafond de dépense de la console Anthropic reste le filet de dernier
 *    recours ; celui-ci coupe bien avant.
 *
 * 2. RÉPONSE DU MODÈLE. `parseMarkup` refuse déjà les balises, liens et appels
 *    de note inventés, et l'adresse d'un lien ne passe jamais par le modèle.
 *    On ajoute ce qui ne se voit pas dans le balisage : une unité démesurée
 *    par rapport au français (texte injecté, réponse qui part en boucle) et
 *    les caractères de contrôle. Une réponse refusée est redemandée une fois.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const MAX_CALLS_PER_DAY = 40;
const DAY_MS = 24 * 3600_000;

const ledgerPath = () => path.join(process.env.HOME ?? '.', '.translate-ledger');

function recentCalls(now: number): number {
  let lines: string[];
  try {
    lines = readFileSync(ledgerPath(), 'utf8').split('\n');
  } catch {
    return 0;
  }
  return lines.filter((l) => {
    const t = Date.parse(l.split(' ')[0]);
    return Number.isFinite(t) && now - t < DAY_MS;
  }).length;
}

/** À appeler AVANT chaque appel au modèle en mode `--job`. Lève une erreur au-delà du plafond. */
export function reserveCall(label: string): void {
  const now = Date.now();
  const n = recentCalls(now);
  if (n >= MAX_CALLS_PER_DAY) {
    throw new Error(
      `plafond atteint : ${n} appels au modèle en 24 h (max ${MAX_CALLS_PER_DAY}). Rien n'est envoyé. Registre : ${ledgerPath()}`,
    );
  }
  appendFileSync(ledgerPath(), `${new Date(now).toISOString()} ${label}\n`, { mode: 0o600 });
}

// Tabulation et sauts de ligne admis ; le reste des contrôles C0/C1, non.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

/**
 * Une unité traduite plausible face à son français. Le russe s'allonge
 * (~1,3×), l'anglais raccourcit ; 3× + 200 caractères laisse une marge large
 * aux phrases très courtes et aux références.
 */
export function checkUnits(source: { id: string; text: string }[], translated: { id: string; text: string }[]): void {
  const src = new Map(source.map((u) => [u.id, u.text]));
  const seen = new Set<string>();
  for (const u of translated) {
    if (seen.has(u.id)) throw new Error(`unité « ${u.id} » rendue deux fois`);
    seen.add(u.id);
    const fr = src.get(u.id);
    if (fr === undefined) continue; // filtrée ensuite par l'appelant
    if (CONTROL.test(u.text)) throw new Error(`caractère de contrôle dans « ${u.id} »`);
    const max = fr.length * 3 + 200;
    if (u.text.length > max) throw new Error(`« ${u.id} » démesurée : ${u.text.length} caractères pour ${fr.length} en français`);
  }
}
