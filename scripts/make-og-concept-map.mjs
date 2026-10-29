/**
 * Régénère public/og-concept-map.png (1200 × 630) : une capture du dessin de
 * la Concept Map, titre en haut à gauche. À relancer quand la carte change
 * beaucoup (nouvel article), le serveur du blog en marche :
 *
 *   SITE_TARGET=blog npx next dev -p 3021
 *   node scripts/make-og-concept-map.mjs
 *
 * `CHROME=<chemin>` pour un autre navigateur que celui de Playwright. Les
 * drapeaux swiftshader donnent un WebGL au navigateur sans écran.
 */
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3021/concept-map/';
const b = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await (await b.newContext({ locale: 'fr-FR', viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.addStyleTag({
  content: `
  body * { visibility: hidden; }
  .concept-stage, .concept-stage *, #og-title, #og-sub { visibility: visible !important; }
  .concept-stage { position: fixed !important; inset: 0 0 0 300px !important; height: auto !important; border: 0 !important; z-index: 9999; }
  .concept-stage > p { display: none !important; }
  #og-title { position: fixed; left: 48px; top: 40px; z-index: 10000; font: 700 64px/0.9 "Helvetica Neue", Helvetica, Arial, sans-serif; letter-spacing: -0.04em; text-transform: uppercase; color: #0a0a0a; }
  #og-sub { position: fixed; left: 50px; bottom: 40px; z-index: 10000; font: 700 15px/1 "Helvetica Neue", Helvetica, Arial, sans-serif; text-transform: uppercase; color: #6e6960; }
`,
});
await p.evaluate(() => {
  const t = document.createElement('div');
  t.id = 'og-title';
  t.innerHTML = 'Concept<br>Map';
  const s = document.createElement('div');
  s.id = 'og-sub';
  s.textContent = 'Journal · Alexandre Matencio';
  document.body.append(t, s);
  window.dispatchEvent(new Event('resize'));
});
await p.waitForTimeout(2000);
await p.screenshot({ path: 'public/og-concept-map.png' });
await b.close();
console.log('public/og-concept-map.png écrite');
