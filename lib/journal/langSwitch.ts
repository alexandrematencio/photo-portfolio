import type { Lang } from './i18n';

/**
 * LE CHANGEMENT DE LANGUE GARDE SA PLACE (2026-11-16, demande Alexandre).
 *
 * Chaque langue a son propre layout racine (`<html lang>`) : changer de langue
 * recharge la page, et tout l'état du lecteur part avec elle. Au clic sur un
 * drapeau (`LanguageSwitch`), la page qu'on quitte annonce le départ ; ceux
 * qui ont quelque chose à garder y déposent leur part — la position dans le
 * texte (`passage`), l'état de la Concept Map (`map`, `tuning`) — dans
 * `sessionStorage`. La page d'arrivée, si c'est bien la langue annoncée et si
 * l'annonce est fraîche, la relit et s'y remet.
 *
 * Seulement `sessionStorage` : l'onglet, jamais un autre onglet ni une autre
 * visite. L'annonce périme vite (`FRESH_MS`) : un rechargement tardif, ou une
 * ouverture directe de la page, ne ressuscite pas un état ancien.
 */

export const LANG_SWITCH_EVENT = 'journal:lang-switch';
const KEY = 'journal:lang-switch';
const FRESH_MS = 20_000;

type Stored = { to: Lang; t: number } & Record<string, unknown>;

function read(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(value: Stored): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Stockage refusé : la page d'arrivée s'ouvre comme avant, rien de plus.
  }
}

/** Au clic sur un drapeau : annonce la langue visée, puis laisse chacun déposer sa part. */
export function announceSwitch(to: Lang): void {
  write({ to, t: Date.now() });
  window.dispatchEvent(new CustomEvent(LANG_SWITCH_EVENT, { detail: { to } }));
}

/** Dépose sa part dans l'annonce en cours (à appeler depuis l'écouteur de `LANG_SWITCH_EVENT`). */
export function patchSwitch(part: Record<string, unknown>): void {
  const now = read();
  if (now) write({ ...now, ...part });
}

/** À l'arrivée : ce qu'on a déposé pour cette langue, si c'est récent ; sinon `null`. */
export function takeSwitch(lang: Lang): Record<string, unknown> | null {
  const now = read();
  if (!now || now.to !== lang || Date.now() - now.t > FRESH_MS) return null;
  return now;
}
