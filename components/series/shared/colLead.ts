/**
 * Regard d'avance de la colonne de vignettes (/series, desktop).
 *
 * La vignette active ne « tombe » pas jusqu'au bord bas de la colonne : elle
 * s'arrête sur une LIGNE DE POSE placée `COL_LEAD` vignettes plus haut, et
 * c'est la colonne qui roule sous elle à partir de là. Deux lignes en fait,
 * une par sens de parcours — descente : à `COL_LEAD` rangs du bas ; remontée :
 * à `COL_LEAD` rangs du haut.
 *
 * La réserve ainsi gardée sert un seul but, d'UX : la colonne se prolonge
 * d'un VIDE de la même hauteur à CHAQUE bout, si bien qu'en bout de série le
 * défilement continue et le vide vient prendre la place des photos qui
 * manquent. L'utilisateur voit la série se vider avant d'en sortir — sans ce
 * vide, la dernière (ou la première) vignette reste collée au bord et le
 * passage à la série voisine tombe sans prévenir. Les deux bouts comptent :
 * ↓ sur la dernière photo passe à la série suivante, ↑ sur la première
 * revient à la précédente.
 *
 * La réserve est mesurée, pas devinée : les vignettes portent le ratio de
 * LEUR photo (invariant §3.7-2), une série de verticales a donc des rangs
 * deux fois plus hauts qu'une série d'horizontales. D'où le pas moyen mesuré
 * sur la colonne réelle — et son PLAFOND : sur des verticales, trois rangs
 * dépasseraient la hauteur visible et la ligne de pose remonterait sous le
 * bord haut, l'active n'aurait plus de course du tout.
 */
export const COL_LEAD = 3;

/**
 * Part maximale de la colonne que la réserve peut occuper. La moitié : sur
 * une série d'horizontales, trois rangs y tiennent tout juste (le compte
 * demandé est donc rendu exactement) ; sur des verticales, le plafond prend
 * la main et la réserve retombe à une vignette et demie — moins de regard
 * d'avance, mais le vide de fin de série reste bien lisible.
 */
const COL_LEAD_MAX_RATIO = 0.5;

/**
 * Hauteur de la réserve sous la ligne de pose, en px, mesurée sur la colonne
 * telle qu'elle est affichée. Source UNIQUE : la hauteur de la queue vide et
 * la ligne de pose en sortent toutes les deux, elles ne peuvent pas diverger.
 */
export function colLeadReserve(col: HTMLElement): number {
  const items = col.querySelectorAll<HTMLElement>('[data-col-item]');
  if (items.length < 2) return 0;
  const first = items[0]!.getBoundingClientRect();
  const last = items[items.length - 1]!.getBoundingClientRect();
  const height = col.clientHeight;
  // Série qui tient DÉJÀ dans la colonne : ni ligne de pose, ni vide. Il n'y
  // a rien à annoncer quand tout est visible, et deux vides prendraient une
  // course de défilement là où il n'en faut aucune.
  if (last.bottom - first.top <= height) return 0;
  // Pas moyen d'un rang (vignette + gouttière), déduit des positions réelles.
  const pitch = (last.top - first.top) / (items.length - 1);
  if (!(pitch > 0)) return 0;
  return Math.min(COL_LEAD * pitch, height * COL_LEAD_MAX_RATIO);
}
