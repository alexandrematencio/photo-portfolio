/**
 * Capture visuelle d'une page en cours de développement.
 *
 * Outil de VÉRIFICATION, pas de test automatisé : il sert à regarder ce que
 * le navigateur affiche réellement, là où le typecheck ne dit rien. Trois
 * bugs de ce projet (bouton de création inopérant, lignes de liste vides,
 * panneau ouvert au mauvais endroit) passaient un typecheck vert et se
 * voyaient au premier clic.
 *
 * Usage :
 *   node scripts/dev-shot.mjs <url> [options]
 *
 *   --out <fichier>       Chemin de la capture (défaut : shot.png)
 *   --viewport <LxH>      Taille de fenêtre (défaut : 1440x900)
 *   --mobile              Raccourci pour 390x844 + émulation tactile
 *   --wait <ms>           Attente après chargement (défaut : 800)
 *   --click <sélecteur>   Clique avant la capture (répétable, dans l'ordre)
 *   --scroll <px>         Défile la fenêtre de <px> avant la capture
 *   --hover <sélecteur>   Survole un élément avant la capture
 *   --full                Capture la page entière et non le seul viewport
 *   --seq <n:intervalle>  Capture n images espacées de <intervalle> ms
 *                         (pour observer une animation image par image)
 *
 * Exemples :
 *   node scripts/dev-shot.mjs http://localhost:3010/series --out /tmp/a.png
 *   node scripts/dev-shot.mjs http://localhost:3010/series --click ".open-btn" --seq 8:100
 *
 * Les erreurs de console et les requêtes échouées sont TOUJOURS rapportées
 * sur la sortie standard — c'est souvent là que se cache le vrai problème.
 */

import { chromium, devices } from 'playwright';
import path from 'node:path';

const argv = process.argv.slice(2);
const url = argv.find((a) => a.startsWith('http'));

if (!url) {
  console.error('✗ Fournis une URL. Ex : node scripts/dev-shot.mjs http://localhost:3010/');
  process.exit(1);
}

function flag(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')
    ? argv[i + 1]
    : fallback;
}
function has(name) {
  return argv.includes(`--${name}`);
}
/** Récupère toutes les occurrences d'un flag répétable, dans l'ordre. */
function allFlags(name) {
  const out = [];
  argv.forEach((a, i) => {
    if (a === `--${name}` && argv[i + 1]) out.push(argv[i + 1]);
  });
  return out;
}

const outPath = path.resolve(flag('out', 'shot.png'));
const waitMs = Number.parseInt(flag('wait', '800'), 10);
const isMobile = has('mobile');
const [vw, vh] = (flag('viewport', isMobile ? '390x844' : '1440x900'))
  .split('x')
  .map((n) => Number.parseInt(n, 10));

const seqRaw = flag('seq');
const [seqCount, seqEvery] = seqRaw
  ? seqRaw.split(':').map((n) => Number.parseInt(n, 10))
  : [0, 0];

const browser = await chromium.launch();
const context = await browser.newContext({
  ...(isMobile ? devices['iPhone 13'] : {}),
  viewport: { width: vw, height: vh },
  // --reduced : émule prefers-reduced-motion pour vérifier les chemins sans
  // animation (obligatoires, CLAUDE.md §3.2/§4).
  reducedMotion: has('reduced') ? 'reduce' : 'no-preference',
});
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) =>
  failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
);

try {
  const response = await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  console.log(`HTTP ${response?.status()} — ${url}`);
  await page.waitForTimeout(waitMs);

  // Actions exécutées DANS L'ORDRE des flags (--click a --pause 800 --click b
  // rejoue la vraie chronologie d'un utilisateur — indispensable quand une
  // animation ignore les clics pendant qu'elle joue).
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = argv[i + 1];
    if (a === '--click' && val) {
      const count = await page.locator(val).count();
      if (count === 0) {
        console.log(`⚠ sélecteur introuvable : ${val}`);
      } else {
        await page.locator(val).first().click();
        console.log(`✓ clic sur ${val}`);
      }
      i++;
    } else if (a === '--pause' && val) {
      await page.waitForTimeout(Number.parseInt(val, 10));
      console.log(`✓ pause ${val}ms`);
      i++;
    } else if (a === '--hover' && val) {
      const count = await page.locator(val).count();
      if (count === 0) console.log(`⚠ sélecteur introuvable : ${val}`);
      else {
        await page.locator(val).first().hover();
        console.log(`✓ hover sur ${val}`);
      }
      i++;
    } else if (a === '--scroll' && val) {
      // mouse.wheel plutôt que window.scrollBy : déclenche les vrais handlers
      // (ScrollTrigger, conteneurs internes), quel que soit l'élément qui
      // porte réellement le scroll (window ou FramedScroll).
      await page.mouse.move(vw / 2, vh / 2);
      await page.mouse.wheel(0, Number.parseInt(val, 10));
      await page.waitForTimeout(600);
      console.log(`✓ scroll ${val}px`);
      i++;
    }
  }

  const shotOpts = { fullPage: has('full') };

  if (seqCount > 0) {
    // Séquence : une capture toutes les <seqEvery> ms, pour observer une
    // animation image par image plutôt qu'à l'arrivée.
    const ext = path.extname(outPath) || '.png';
    const stem = outPath.slice(0, outPath.length - ext.length);
    for (let i = 0; i < seqCount; i++) {
      const p = `${stem}-${String(i).padStart(2, '0')}${ext}`;
      await page.screenshot({ ...shotOpts, path: p });
      console.log(`  → ${p}  (t=${i * seqEvery}ms)`);
      if (i < seqCount - 1) await page.waitForTimeout(seqEvery);
    }
  } else {
    await page.screenshot({ ...shotOpts, path: outPath });
    console.log(`→ ${outPath}`);
  }
} finally {
  if (consoleErrors.length > 0) {
    console.log(`\n${consoleErrors.length} message(s) de console :`);
    consoleErrors.slice(0, 20).forEach((e) => console.log(`  ${e}`));
  } else {
    console.log('\n✓ Console propre.');
  }
  if (failedRequests.length > 0) {
    console.log(`\n${failedRequests.length} requête(s) échouée(s) :`);
    failedRequests.slice(0, 10).forEach((r) => console.log(`  ${r}`));
  }
  await browser.close();
}
