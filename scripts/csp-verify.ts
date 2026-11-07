/**
 * Vérifie EN LIGNE que chaque page servie porte la liste de hachages de ses
 * propres scripts en ligne (cf. `csp-hashes.ts`). Lecture seule : de simples
 * GET publics, pages prises dans le sitemap. C'est le test que le mode
 * `inert` doit passer, Publish après Publish, avant de passer en `enforce` :
 * une page dont un script manque à la liste serait, en `enforce`, une page
 * sans JavaScript.
 *
 * Usage : `npm run csp:verify -- https://photo.amatencio.com`
 */
import { pageHashes } from './csp-hashes';

const LIST_RE = /<meta (?:name="csp-script-hashes" content="([^"]*)"|http-equiv="Content-Security-Policy" content="script-src 'self' ([^"]*)")\/>/;

// Pas d'`await` au niveau du module : le dépôt est en CommonJS (tsx le refuse).
async function main(): Promise<number> {
  const base = (process.argv[2] || '').replace(/\/$/, '');
  if (!base) {
    console.error('usage : npm run csp:verify -- <url du site>');
    return 1;
  }

  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) {
    console.error('sitemap vide ou illisible');
    return 1;
  }

  let bad = 0;
  for (const url of urls) {
    const res = await fetch(url);
    const html = await res.text();
    const m = LIST_RE.exec(html);
    const listed = new Set((m?.[1] ?? m?.[2] ?? '').split(' ').filter(Boolean));
    const missing = pageHashes(html).filter((h) => !listed.has(h));
    // Sans script en ligne, l'étape ne pose pas de liste : rien à vérifier.
    if (missing.length) {
      bad += 1;
      console.log(`✗ ${url} — ${!m ? 'aucune liste' : `${missing.length} script(s) hors liste`}`);
    }
  }
  console.log(`${urls.length - bad}/${urls.length} pages conformes`);
  return bad ? 1 : 0;
}

main().then((code) => process.exit(code));
