/**
 * Vérification de `csp-hashes.ts` : ce qui est haché, ce qui ne l'est pas, où
 * la balise se pose, et qu'un second passage ne l'empile pas.
 */
import { createHash } from 'node:crypto';
import { applyToHtml, hashSource, inlineScripts } from './csp-hashes';

let failed = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) {
    failed++;
    console.log(`✗ ${what}`);
  }
};

const page =
  '<!DOCTYPE html><html><head><meta charSet="utf-8"/><title>t</title>' +
  '<script src="/_next/a.js" async=""></script>' +
  '<script>self.__next_f.push([1,"x"])</script>' +
  '<script type="application/ld+json">{"@context":"https://schema.org"}</script>' +
  '<script type="application/json" id="d">{}</script>' +
  '<script type="module">import "/m.js"</script>' +
  '<script>self.__next_f.push([1,"x"])</script>' +
  '</head><body></body></html>';

const scripts = inlineScripts(page);
ok(scripts.length === 3, `3 scripts exécutables attendus, ${scripts.length} trouvés`);
ok(!scripts.some((s) => s.includes('schema.org') || s === '{}'), 'blocs de données exclus');

const expected = `'sha256-${createHash('sha256').update('self.__next_f.push([1,"x"])').digest('base64')}'`;
ok(hashSource('self.__next_f.push([1,"x"])') === expected, 'hachage au format CSP');

const inert = applyToHtml(page, 'inert');
ok(inert.hashes.length === 2, `doublons fusionnés : ${inert.hashes.length}`);
ok(inert.html.includes('<meta charSet="utf-8"/><meta name="csp-script-hashes" content="'), 'balise inerte juste après le charset');

const enforce = applyToHtml(inert.html, 'enforce');
ok(!enforce.html.includes('csp-script-hashes'), 'la balise inerte est remplacée, pas empilée');
ok((enforce.html.match(/http-equiv="Content-Security-Policy"/g) ?? []).length === 1, 'une seule balise CSP');
ok(enforce.html.includes(`content="script-src 'self' ${expected}`), "script-src 'self' + hachages");
ok(applyToHtml(enforce.html, 'enforce').html === enforce.html, 'idempotent');

const none = '<html><head><meta charSet="utf-8"/></head><body></body></html>';
ok(applyToHtml(none, 'enforce').html === none, 'page sans script en ligne : intacte');

console.log(failed ? `${failed} échec(s)` : 'csp-hashes : tous les cas OK.');
if (failed > 0) process.exit(1);
