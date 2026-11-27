/**
 * Vérification de la géométrie des anneaux de /work (components/work/carousel-geometry.ts)
 * et de `collectionPlaces` (lib/site/series.ts). Fausses photos, aucun appel réseau.
 */
import {
  FIRST_SCENE_MIN,
  RING,
  RING_FIT,
  RING_REST_HEIGHT,
  aspectOf,
  cellTransform,
  ringFit,
  ringLayout,
} from '../components/work/carousel-geometry';
import { collectionPlaces } from '../lib/site/series';
import type { Photo } from '../lib/sanity/queries';

let failed = 0;
let total = 0;
function ok(name: string, cond: boolean, detail = '') {
  total++;
  if (!cond) { failed++; console.log(`✗ ${name} ${detail}`); } else console.log(`✓ ${name}`);
}
const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

const photo = (id: string, ratio?: number, extra: Partial<Photo> = {}): Photo =>
  ({
    _id: id,
    title: id,
    slug: { current: id },
    year: 2024,
    location: '',
    parallaxSpeed: 0,
    image: ratio === undefined
      ? undefined
      : { asset: { _ref: id }, dimensions: { width: 1000 * ratio, height: 1000, aspectRatio: ratio } },
    ...extra,
  }) as unknown as Photo;

const RAT = [0.67, 1.5, 0.8, 1.0, 0.7, 1.33, 0.75, 1.2];
const eight = RAT.map((r, i) => photo(`p${i}`, r));

// 1. Huit ratios variés : l'anneau se referme.
{
  const l = ringLayout(eight);
  const a = l.cards.map((c) => c.angle);
  ok('1 : 8 cartes', l.cards.length === 8);
  ok('1 : premier angle 0', a[0] === 0);
  ok('1 : angles strictement croissants', a.every((v, i) => i === 0 || v > a[i - 1]));
  ok('1 : dernier angle < 360', a[7] < 360);
  // pas(i) = largeur + gap + slack ; l'écart dernier → premier = pas(7)/2 + pas(0)/2
  const circ = 2 * Math.PI * l.radius;
  const used = l.cards.reduce((s, c) => s + c.width + RING.gap, 0);
  const slack = (circ - used) / 8;
  const step = (i: number) => l.cards[i].width + RING.gap + slack;
  const closing = ((step(7) / 2 + step(0) / 2) / l.radius) * (180 / Math.PI);
  ok('1 : anneau refermé', near(360 - a[7], closing, 0.01), `(${360 - a[7]} vs ${closing})`);
  ok('1 : rayon 640 (repère du plan)', near(l.radius, 640, 1), `(${l.radius})`);
}
// 2. 39 photos : les 8 premières.
{
  const many = Array.from({ length: 39 }, (_, i) => photo(`m${i}`, 0.8));
  const l = ringLayout(many);
  ok('2 : 8 cartes', l.cards.length === 8);
  ok('2 : mêmes _id, même ordre', l.cards.every((c, i) => c.photo._id === `m${i}`));
}
// 3. 4 photos étroites : rayon borné.
{
  const l = ringLayout(Array.from({ length: 4 }, (_, i) => photo(`n${i}`, 0.6)));
  const w = Math.round(RING.cardHeight * 0.6);
  const wanted = (4 * (w + RING.gap)) / (2 * Math.PI * RING.fill);
  ok('3 : rayon calculé 282', near(wanted, 282, 1), `(${wanted})`);
  ok('3 : borné à minRadius', l.radius === RING.minRadius, `(${l.radius})`);
  ok('3 : angles 0/90/180/270', l.cards.every((c, i) => near(c.angle, i * 90, 1e-6)), JSON.stringify(l.cards.map((c) => c.angle)));
  const l08 = ringLayout(Array.from({ length: 4 }, (_, i) => photo(`q${i}`, 0.8)));
  ok('3 : repère 4 × 0,8 → 361', near(l08.radius, 361, 1), `(${l08.radius})`);
}
// 4. Photo sans dimensions.
{
  const l = ringLayout([photo('x')]);
  ok('4 : repli 272', l.cards[0].width === Math.round(340 * 0.8), `(${l.cards[0].width})`);
  ok('4 : aspectOf repli', aspectOf(photo('x')) === 0.8);
}
// 5. Panorama.
{
  const l = ringLayout([photo('pano', 3)]);
  ok('5 : largeur plafonnée à 544', l.cards[0].width === 544, `(${l.cards[0].width})`);
  ok('5 : hauteur réduite, ratio 3 gardé', l.cards[0].height === 181 && near(544 / 181, 3, 0.02), `(${l.cards[0].height})`);
}
// 5 bis. Aucun étirement : la carte a le ratio de la photo, quel qu'il soit.
{
  const ratios = [0.3, 0.5, 0.667, 0.8, 1, 1.333, 1.5, 2, 3, 5];
  const l = ringLayout(ratios.map((r, i) => photo(`s${i}`, r)));
  ok(
    '5bis : ratio de carte = ratio de photo (écart < 1 %)',
    l.cards.every((c, i) => near(c.width / c.height, ratios[i], ratios[i] * 0.01 + 0.005)),
    JSON.stringify(l.cards.map((c) => [c.width, c.height])),
  );
}
// 6. z.
{
  const l = ringLayout(eight);
  ok('6 : z = -(rayon + 50)', l.z === -(l.radius + 50));
}
// 6 bis. Huit panoramas.
{
  const l = ringLayout(Array.from({ length: 8 }, (_, i) => photo(`w${i}`, 3)));
  const a = l.cards.map((c) => c.angle);
  ok('6bis : rayon > maxRadius', l.radius > RING.maxRadius, `(${l.radius})`);
  const deg = (px: number) => (px / l.radius) * (180 / Math.PI);
  let gapsOk = true;
  for (let i = 1; i < 8; i++) {
    const min = deg((l.cards[i - 1].width + l.cards[i].width) / 2 + RING.gap);
    if (a[i] - a[i - 1] < min - 1e-9) gapsOk = false;
  }
  ok('6bis : écarts ≥ largeurs/2 + gap', gapsOk);
  const closing = 360 - a[7];
  const minClose = deg((l.cards[7].width + l.cards[0].width) / 2 + RING.gap);
  ok('6bis : anneau refermé', closing >= minClose - 1e-9 && a[7] < 360);
}
// cellTransform
ok('cellTransform stable', cellTransform(45, 500) ===
  'rotateY(calc(45.000deg + var(--spin, 0deg))) translateZ(calc(500.0px + var(--spread, 0px) + var(--spin-spread, 0px)))');
// 7. collectionPlaces
{
  const p = (year: number, location: string) => photo(`c${year}${location}`, 0.8, { year, location });
  ok('7 : année seule', collectionPlaces([p(2024, ''), p(2024, '')]) === '2024');
  ok('7 : plage', collectionPlaces([p(2020, ''), p(2026, '')]) === '2020–2026');
  ok('7 : 2 villes', collectionPlaces([p(2024, 'Paris, France'), p(2024, 'Djerba, Tunisie')]) === '2024 · Paris, Djerba');
  ok('7 : 4 villes', collectionPlaces(['A', 'B', 'C', 'D'].map((c) => p(2024, `${c}, X`))) === '2024 · A, B +2');
  ok('7 : aucune donnée', collectionPlaces([photo('z', 0.8, { year: NaN as unknown as number, location: '' })]) === '');
}

// 8. ringFit : l'anneau tient dans sa scène et dans la largeur de l'écran
{
  ok('8 : hauteur de repos ≈ 322', near(RING_REST_HEIGHT, 322, 1), `(${RING_REST_HEIGHT})`);
  ok('8 : grand écran → 1', ringFit(900, 1440) === 1);
  const short = ringFit(290, 1440); // portable bas : 290 px sous WORK
  ok('8 : portable bas, anneau + marges ≤ scène', RING_REST_HEIGHT * short + 2 * RING_FIT.pad <= 290 + 0.5, `(${short})`);
  ok('8 : iPhone 390 → ≈ 0,7 par la largeur', near(ringFit(844, 390), 0.696, 0.001), `(${ringFit(844, 390)})`);
  ok('8 : plancher', ringFit(50, 1440) === RING_FIT.min && ringFit(900, 100) === RING_FIT.min);
  ok('8 : FIRST_SCENE_MIN = anneau au plancher + marges', FIRST_SCENE_MIN >= RING_REST_HEIGHT * RING_FIT.min + 2 * RING_FIT.pad);
}

console.log(`${total - failed}/${total} cas OK.`);
if (failed > 0) process.exit(1);
