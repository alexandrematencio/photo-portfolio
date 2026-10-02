/**
 * Courbe « caoutchouc » — un corps élastique tiré par une poignée.
 *
 * Aucune courbe de Bézier ne dit à la fois l'inertie au départ, l'élan en
 * route et le freinage qui dépasse puis revient : ce sont trois effets d'UN
 * même système. On le simule donc une fois, plutôt que d'empiler des eases :
 *
 *   - une POIGNÉE va de 0 à 1 en douceur (smootherstep) sur la fraction `lead`
 *     de la durée — c'est le geste voulu ;
 *   - le CORPS la suit au bout d'un ressort amorti (`stiffness`, `damping`).
 *     Il part en retard (inertie), rattrape (élan), arrive encore lancé quand
 *     la poignée s'arrête, la dépasse et revient (freinage).
 *
 * L'écart poignée − corps est la DÉFORMATION : positif quand le corps traîne
 * (il s'étire dans le sens du trajet), négatif quand il dépasse (il se tasse).
 * `strain` le rend normalisé sur [-1, 1] ; à l'appelant de choisir l'amplitude.
 *
 * Le résultat est une table, pas une simulation en direct : la durée est
 * exacte, deux lectures au même instant donnent le même nombre, et la courbe
 * atterrit sur 1 quoi qu'il arrive.
 *
 * Aucune dépendance (ni GSAP, ni React, ni DOM hors `requestAnimationFrame`) :
 * la brique se recopie telle quelle dans un autre projet.
 */

export type RubberBody = {
  /** Fraction de la durée que met la poignée à faire tout le trajet. Le reste
      appartient au corps : dépassement et retour. */
  lead: number;
  /** Raideur du ressort, en 1/τ² (τ = durée normalisée). Plus haut = corps
      léger, qui colle à la poignée. */
  stiffness: number;
  /** Amortissement, en 1/τ. Plus bas = dépassement plus ample, plus de rebond. */
  damping: number;
  /**
   * Départ de la poignée. `soft` (défaut) : accélération nulle à l'instant
   * zéro, le corps met ~100 ms à bouger de façon visible — juste pour ce qui
   * SUIT un autre mouvement. `prompt` : la poignée accélère tout de suite ;
   * à réserver à ce qui RÉPOND à un clic, où 100 ms d'immobilité se lisent
   * comme un retard et non comme de l'inertie.
   */
  onset?: 'soft' | 'prompt';
};

export type RubberCurve = {
  /** Position du corps à la progression `p` (0 → 1, peut dépasser 1). */
  at: (p: number) => number;
  /** Déformation normalisée à `p` : > 0 étiré (en retard), < 0 tassé. */
  strain: (p: number) => number;
};

const STEPS = 480;
const SUBSTEPS = 4;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** 6u⁵ − 15u⁴ + 10u³ : vitesse ET accélération nulles aux deux bouts. */
function smootherstep(u: number): number {
  const c = clamp01(u);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

export function smoothstep(from: number, to: number, value: number): number {
  const c = clamp01((value - from) / (to - from));
  return c * c * (3 - 2 * c);
}

function sample(table: Float32Array, p: number): number {
  const f = clamp01(p) * STEPS;
  const i = Math.min(STEPS - 1, Math.floor(f));
  return table[i] + (table[i + 1] - table[i]) * (f - i);
}

export function rubberCurve({
  lead,
  stiffness,
  damping,
  onset = 'soft',
}: RubberBody): RubberCurve {
  const handle = (u: number) =>
    onset === 'prompt' ? smoothstep(0, 1, u) : smootherstep(u);
  const pos = new Float32Array(STEPS + 1);
  const gap = new Float32Array(STEPS + 1);
  const dt = 1 / (STEPS * SUBSTEPS);
  let x = 0;
  let v = 0;
  let peak = 1e-6;

  for (let i = 1; i <= STEPS; i++) {
    for (let s = 1; s <= SUBSTEPS; s++) {
      const tau = ((i - 1) * SUBSTEPS + s) * dt;
      // Euler semi-implicite : vitesse d'abord, position ensuite — stable aux
      // raideurs utilisées ici, là où l'Euler explicite diverge.
      v += (stiffness * (handle(tau / lead) - x) - damping * v) * dt;
      x += v * dt;
    }
    pos[i] = x;
    gap[i] = handle(i / STEPS / lead) - x;
    peak = Math.max(peak, Math.abs(gap[i]));
  }

  // Atterrissage EXACT : le résidu d'oscillation en fin de table est réparti
  // sur la queue (cubique, donc invisible au début), et la déformation est
  // ramenée à zéro sur les derniers 8 %.
  const residual = 1 - pos[STEPS];
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS;
    pos[i] += residual * p * p * p;
    gap[i] = (gap[i] / peak) * (1 - smoothstep(0.92, 1, p));
  }

  return {
    at: (p) => sample(pos, p),
    strain: (p) => sample(gap, p),
  };
}

/**
 * Horloge minimale : appelle `frame(p)` de 0 à 1 sur `seconds`, puis `done`.
 * Rend la fonction qui l'arrête (sans appeler `done`).
 *
 * `frame(0)` part de façon SYNCHRONE : l'état de départ est posé avant le
 * premier paint, c'est ce qui permet à un élément de naître exactement là où
 * un autre vient de disparaître. Une timeline GSAP chargée en `import()` ne le
 * peut pas — le module arrive une frame trop tard.
 */
export function animate(
  seconds: number,
  frame: (p: number) => void,
  done?: () => void
): () => void {
  let raf = 0;
  let stopped = false;
  const start = performance.now();
  frame(0);
  const tick = (now: number) => {
    if (stopped) return;
    const p = clamp01((now - start) / (seconds * 1000));
    frame(p);
    if (p < 1) raf = requestAnimationFrame(tick);
    else done?.();
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
