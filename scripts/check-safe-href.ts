/**
 * Vérification de `safeHref` (`lib/utils/safe-href.ts`, audit 1.5) : les
 * schémas permis passent, tout le reste est refusé, y compris les variantes
 * que le navigateur normalise (casse, tabulation, espaces, entités).
 */
import { safeHref } from '../lib/utils/safe-href';

const PASS = [
  'https://instagram.com/x', 'http://example.com', 'mailto:a@b.c', 'tel:+33100000000',
  '/about/', '#note-ia', '?q=1', '../x', '  https://t.me/x  ', '//cdn.example.com/x',
];
const BLOCK = [
  'javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)',
  'java\nscript:alert(1)', '\u0001javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)', 'file:///etc/passwd', 'blob:https://x/y', 'ftp://x', '', '   ',
];

let failed = 0;
for (const h of PASS) if (safeHref(h) === null) { failed++; console.log(`✗ refusé à tort : ${JSON.stringify(h)}`); }
for (const h of BLOCK) if (safeHref(h) !== null) { failed++; console.log(`✗ laissé passer : ${JSON.stringify(h)}`); }
console.log(`${PASS.length + BLOCK.length - failed}/${PASS.length + BLOCK.length} cas OK.`);
if (failed > 0) process.exit(1);
