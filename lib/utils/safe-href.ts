/**
 * Filtre des adresses de lien venues du CMS (audit 1.5).
 *
 * La validation du Studio ne protège que le Studio : un document écrit par
 * l'API (script, token d'écriture, traduction) arrive au rendu sans elle. Et
 * React ne bloque que `javascript:` — pas `data:`, `vbscript:`, ni un schéma
 * inconnu. Tout `href` issu de Sanity passe donc par ici avant d'être rendu.
 *
 * Le schéma est lu par le parseur d'URL du navigateur (WHATWG), pas par une
 * regex : `java\tscript:` ou un espace en tête sont normalisés exactement
 * comme le ferait le navigateur au clic.
 */

const ALLOWED = new Set(['http:', 'https:', 'mailto:', 'tel:']);
// Base factice : une adresse relative (`/about/`, `#note-ia`) y prend `https:`.
const BASE = 'https://relative.invalid';

/** L'adresse si son schéma est permis, sinon `null` (le texte reste, sans lien). */
export function safeHref(raw: string | null | undefined): string | null {
  const href = (raw ?? '').trim();
  if (!href) return null;
  try {
    return ALLOWED.has(new URL(href, BASE).protocol) ? href : null;
  } catch {
    return null;
  }
}
