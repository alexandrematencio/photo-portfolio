/**
 * HACHAGES CSP DES SCRIPTS EN LIGNE (audit 2.4, reste : `'unsafe-inline'`).
 *
 * L'export est statique : pas de serveur, donc pas de nonce (il en faut un
 * neuf par réponse). Reste les hachages. Chaque page porte ses propres
 * scripts en ligne (surtout les `self.__next_f.push(...)` de Next), qui
 * changent d'une page à l'autre et d'un build à l'autre : on les hache APRÈS
 * le build, page par page, et on écrit la liste dans la page elle-même.
 *
 * Deux modes (`CSP_MODE`, défaut ci-dessous) :
 *  - `inert`   : `<meta name="csp-script-hashes">`, sans aucun effet sur le
 *    navigateur. Sert à vérifier en ligne, Publish après Publish, que chaque
 *    page servie porte bien la liste de SES scripts (`csp-verify.ts`).
 *  - `enforce` : `<meta http-equiv="Content-Security-Policy">` limité à
 *    `script-src`. Il S'AJOUTE à l'en-tête de Caddy (qui garde
 *    `'unsafe-inline'`) : deux politiques se cumulent, un script doit passer
 *    les deux, donc la plus stricte gagne. Revenir en arrière = repasser en
 *    `inert` et publier, sans toucher au VPS.
 *
 * Une `<meta>` CSP ne protège que ce qui la SUIT : elle est posée juste après
 * `<meta charSet>`, avant tout script. Pas plus haut : le charset doit rester
 * dans les 1 024 premiers octets.
 *
 * Non hachés : les scripts à `src` (couverts par `'self'`) et les blocs de
 * données (`application/json`, `application/ld+json`), que le navigateur
 * n'exécute pas et que la CSP ne regarde pas.
 *
 * Le Studio (`studio/`) n'est PAS touché : il est servi par
 * studio.amatencio.com sous sa propre CSP (audit 2.3), derrière un mot de
 * passe, et ne se teste pas en local (connexion Sanity impossible hors de
 * ses origines CORS). Il garde sa politique actuelle.
 *
 * Usage : `node --import tsx scripts/csp-hashes.ts <dossier>` (enchaîné par `npm run build`).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CspMode = 'inert' | 'enforce';

// `enforce` depuis le 2026-11-07, après trois Publish inertes à 22/22 pages
// conformes (`csp:verify`) et un test local en Chrome : 29/29 pages sans
// refus et hydratées, une page témoin altérée bien refusée.
export const DEFAULT_MODE: CspMode = 'enforce';

const SCRIPT_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const DATA_TYPE_RE = /\stype\s*=\s*["']?application\/(ld\+)?json/i;
const OURS_RE = /<meta (?:name="csp-script-hashes"|http-equiv="Content-Security-Policy") content="[^"]*"\/>/g;
const CHARSET_RE = /<meta charSet="utf-8"\/>/i;

/** Les scripts en ligne EXÉCUTABLES de `html`, dans l'ordre. */
export function inlineScripts(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    const attrs = m[1] ?? '';
    if (/\ssrc\s*=/i.test(attrs) || DATA_TYPE_RE.test(attrs)) continue;
    out.push(m[2]);
  }
  return out;
}

/** Source CSP `'sha256-…'` d'un script : son texte brut, tel qu'écrit. */
export function hashSource(text: string): string {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

/** Les hachages d'une page, dédoublonnés, dans l'ordre d'apparition. */
export function pageHashes(html: string): string[] {
  return [...new Set(inlineScripts(html.replace(OURS_RE, '')).map(hashSource))];
}

export function metaTag(hashes: string[], mode: CspMode): string {
  const list = hashes.join(' ');
  return mode === 'enforce'
    ? `<meta http-equiv="Content-Security-Policy" content="script-src 'self' ${list}"/>`
    : `<meta name="csp-script-hashes" content="${list}"/>`;
}

/** `html` avec SA balise (remplace une éventuelle balise d'un passage précédent). */
export function applyToHtml(html: string, mode: CspMode): { html: string; hashes: string[] } {
  const clean = html.replace(OURS_RE, '');
  const hashes = pageHashes(clean);
  if (hashes.length === 0) return { html: clean, hashes };
  const m = CHARSET_RE.exec(clean);
  if (!m) throw new Error('pas de <meta charSet="utf-8"/> : page non générée par Next ?');
  const at = m.index + m[0].length;
  return { html: clean.slice(0, at) + metaTag(hashes, mode) + clean.slice(at), hashes };
}

/** Dossiers laissés tels quels (cf. en-tête : le Studio). */
const SKIP_DIRS = new Set(['studio']);

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) out.push(...htmlFiles(p));
    } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage : node --import tsx scripts/csp-hashes.ts <dossier>');
    process.exit(1);
  }
  const raw = process.env.CSP_MODE || DEFAULT_MODE;
  if (raw !== 'inert' && raw !== 'enforce') {
    console.error(`CSP_MODE inconnu : ${raw}`);
    process.exit(1);
  }
  const mode: CspMode = raw;
  let pages = 0;
  let total = 0;
  for (const f of htmlFiles(dir)) {
    const before = readFileSync(f, 'utf8');
    const { html, hashes } = applyToHtml(before, mode);
    if (html !== before) writeFileSync(f, html);
    pages += 1;
    total += hashes.length;
  }
  console.log(`▸ CSP (${mode}) : ${pages} pages, ${total} hachages de scripts en ligne`);
}
