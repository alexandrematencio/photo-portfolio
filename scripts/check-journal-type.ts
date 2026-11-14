/**
 * Garde-fou typo du journal : plus aucune chasse fixe dans ses menus.
 *
 * Le menu de l'accueil (séries/, thématiques/…) était en `font-mono`, la
 * pile monospace par défaut de Tailwind (Menlo, Courier : des empattements
 * de machine à écrire), seule fonte du site hors de sa base sans. Alexandre,
 * le 2026-11-14 : même base qu'ailleurs, et « faut que ça reste comme ça ».
 *
 * Seule exception : les touches du faux clavier de l'aide de la Concept Map
 * (MapControls.tsx), un dessin de touche, pas du texte de menu.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const ALLOWED = new Set(['components/journal/concept-map/MapControls.tsx']);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css)$/.test(name)) yield p;
  }
}

const offenders: string[] = [];
for (const file of walk(join(ROOT, 'components/journal'))) {
  const rel = relative(ROOT, file);
  if (ALLOWED.has(rel)) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (/\bfont-mono\b|font-family:\s*monospace/.test(line)) offenders.push(`${rel}:${i + 1}`);
    });
}

if (offenders.length) {
  console.log(`✗ chasse fixe dans le journal (base sans : font-sans ou --font-index) :\n  ${offenders.join('\n  ')}`);
  process.exit(1);
}
console.log('✓ journal : aucune chasse fixe hors du faux clavier');
