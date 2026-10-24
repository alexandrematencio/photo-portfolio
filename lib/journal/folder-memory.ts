/**
 * Mémoire des dossiers de filtres du journal (séries / thématiques).
 *
 * Au premier passage, chaque dossier est en APERÇU : il laisse voir qu'il
 * contient des choix (« voir les 4 séries ») sans pousser l'index d'un écran
 * vers le bas. Dès qu'on l'ouvre, l'aperçu ne revient plus : le dossier est
 * ouvert ou fermé, et ce choix est retenu (2026-10-24, demande d'Alexandre).
 *
 * Même régime que le splash de la home (`lib/site/splash-session.ts`) :
 * localStorage, pas un cookie, et une fenêtre FIXE de 12 h — le lendemain,
 * l'aperçu revient. Storage bloqué → l'aperçu, jamais une page coincée.
 */
export type FolderState = 'peek' | 'open' | 'closed';
export type FolderName = 'series' | 'themes';
export type FolderMemory = Record<FolderName, FolderState>;

export const FOLDERS_KEY = 'journalFolders';
const TTL_MS = 12 * 60 * 60 * 1000;

export const FIRST_VISIT: FolderMemory = { series: 'peek', themes: 'peek' };

const valid = (v: unknown): v is FolderState => v === 'peek' || v === 'open' || v === 'closed';

export function readFolders(): FolderMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? 'null');
    if (!raw || !(Date.now() - raw.at < TTL_MS)) return FIRST_VISIT;
    return { series: valid(raw.series) ? raw.series : 'peek', themes: valid(raw.themes) ? raw.themes : 'peek' };
  } catch {
    return FIRST_VISIT;
  }
}

export function writeFolders(next: FolderMemory): void {
  try {
    // Fenêtre fixe : l'instant du premier choix est gardé, pas prolongé.
    const prev = JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? 'null');
    const at = prev && Date.now() - prev.at < TTL_MS ? prev.at : Date.now();
    localStorage.setItem(FOLDERS_KEY, JSON.stringify({ ...next, at }));
  } catch {
    // storage bloqué — l'aperçu reviendra au prochain chargement
  }
}
