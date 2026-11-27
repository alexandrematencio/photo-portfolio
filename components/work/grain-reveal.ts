/**
 * Reveal granulaire des vignettes d'un album (/work). Le principe vient du splash V11 d'AAXLO :
 * un front de grains traverse l'image de gauche à droite, légèrement en biais. Ici il se fait
 * sans canvas par image : un SEUL masque CSS, tiré une fois, glisse sur chaque vignette.
 *
 * Le masque fait trois largeurs de vignette (`mask-size: 300% auto`) :
 *   [ opaque | front de grains | transparent ]
 * En le faisant glisser de `100%` à `0%` (`--grain-x`), on voit passer le front de gauche à droite.
 * Le front est un tramage aléatoire, et chaque grain porte un peu d'alpha intermédiaire :
 * mis à l'échelle par le navigateur, il donne un grain doux, photographique, pas des pixels secs.
 * Seul `mask-position` bouge, pas de layout. Le masque est retiré en fin d'animation.
 */

/** Cellules du masque. Ratio 3:2 → la hauteur du masque vaut 2 largeurs de vignette (assez pour un portrait). */
const COLS = 300;
const ROWS = 200;
/** Biais du front : de combien il recule entre le haut et le bas de la texture (en largeurs de vignette). */
const SKEW = 0.45;
/** Épaisseur du front (en largeurs de vignette). Plus mince = grain plus net, plus large = plus fondu. */
const BAND = 0.55;

let cached: string | null = null;

/** Rend l'URL du masque (`url(data:…)`), tirée une fois par chargement de page. */
export function grainMask(): string {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = COLS;
  c.height = ROWS;
  const ctx = c.getContext('2d');
  if (!ctx) return 'none';
  const img = ctx.createImageData(COLS, ROWS);
  for (let y = 0; y < ROWS; y++) {
    const v = y / (ROWS - 1);
    for (let x = 0; x < COLS; x++) {
      const u = (x / (COLS - 1)) * 3; // 0 → 3 vignettes
      // 0 avant le front, 1 après. Front borné à [1, 2] : la 1re vignette est pleine, la 3e vide.
      const s = Math.min(1, Math.max(0, (u - 1 - SKEW * v) / BAND));
      // Tramage : le grain est visible si son tirage dépasse le seuil ; un petit fondu autour du seuil.
      const a = Math.min(1, Math.max(0, (Math.random() - s) * 5 + 0.5));
      const i = (y * COLS + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = s === 0 ? 255 : s === 1 ? 0 : Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  cached = `url(${c.toDataURL('image/png')})`;
  return cached;
}

/** Regroupe des éléments par rangée (même `offsetTop`), triés de gauche à droite. */
export function rowsOf(items: HTMLElement[]): HTMLElement[][] {
  const byTop = new Map<number, HTMLElement[]>();
  for (const el of items) {
    const top = Math.round(el.offsetTop);
    byTop.set(top, [...(byTop.get(top) ?? []), el]);
  }
  return [...byTop.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.sort((a, b) => a.offsetLeft - b.offsetLeft));
}
