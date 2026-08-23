/**
 * VOYANT D'ÉTAT — disque plein de 7 px en `--color-link`, allumé quand l'élément
 * est actif. Atome partagé de la grammaire d'état du site (brand book §4.3).
 *
 * Consommé par les pastilles de filtre de `/archives` (`FlatGallery`) et par la
 * colonne des noms de série de la vue ouverte desktop (`OpenSeriesView`). Toute
 * nouvelle marque d'état « allumé / éteint » passe par ici — pas par une copie.
 *
 * **Toujours RENDU, jamais monté/démonté** : c'est l'opacité qui bascule. Un
 * rendu conditionnel ferait varier la largeur du contrôle à chaque changement
 * d'état, donc toute la rangée ou toute la colonne avec lui.
 *
 * **Pourquoi un point et pas un libellé en orange** : `--color-link` sur le
 * papier vaut 3,59:1. C'est au-dessus du seuil des éléments GRAPHIQUES (3:1),
 * en dessous de celui du petit TEXTE (4,5:1). Le point porte donc le signal et
 * le libellé reste noir. Il change aussi la FORME du contrôle et pas seulement
 * sa couleur — l'état reste perceptible sans distinguer l'orange (WCAG 2.2
 * §1.4.1).
 *
 * `aria-hidden` : l'état est déjà porté par `aria-pressed` / `aria-current` sur
 * le contrôle qui contient le point. L'annoncer deux fois serait du bruit.
 */

/** Diamètre du voyant. Exporté pour que le contrepoids ci-dessous en dérive :
    une seule valeur, jamais deux nombres à garder d'accord. */
export const STATE_DOT_SIZE = 7;

export function StateDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: STATE_DOT_SIZE,
        height: STATE_DOT_SIZE,
        borderRadius: '50%',
        backgroundColor: 'var(--color-link)',
        opacity: on ? 1 : 0,
        flex: 'none',
      }}
      className="transition-opacity motion-reduce:transition-none"
    />
  );
}

/**
 * CONTREPOIDS DU VOYANT — boîte vide de la largeur exacte du point, à poser en
 * DERNIER enfant d'un contrôle BORNÉ (bordure ou fond) dont le voyant ouvre la
 * ligne. L'écart de 6 px est déjà rendu des deux côtés par le `gap` du flex :
 * poser cette boîte suffit à rendre les blancs symétriques.
 *
 * **Le problème qu'il règle** (bug réel, capture d'Alexandre du 2026-08-23) :
 * dans `padding | point | gap | libellé | padding`, le point et son écart
 * réservent 13 px à GAUCHE que rien ne compense à droite. Mesuré sur la
 * pastille « Djerba, Tunisia (54) » : 22 px du bord gauche au premier glyphe,
 * 9 px du dernier glyphe au bord droit. Effet visible : le libellé seul tombe
 * au centre optique de la pastille et le compteur, lui, déborde vers la
 * bordure — la pastille a l'air taillée pour le libellé, le compteur ajouté
 * après coup. Le point étant invisible à l'état éteint, l'œil ne voit que le
 * trou à gauche et l'écrasement à droite, sans la cause.
 *
 * **Pourquoi une boîte et pas un `paddingRight: 21`** : 21 est un nombre magique
 * qui dérive en silence le jour où le voyant change de taille. Ici la largeur
 * vient de `STATE_DOT_SIZE`, et le 6 px de l'écart vient du `gap` du contrôle.
 *
 * ⚠️ **Réservé aux contrôles BORNÉS.** Une liste alignée à gauche sans bordure
 * (colonne des noms de série d'`OpenSeriesView`) n'en veut PAS : le point y est
 * une gouttière commune à tous les items, il n'y a pas de bord droit contre
 * lequel le blanc puisse paraître asymétrique, et le contrepoids ne ferait
 * qu'élargir la colonne pour rien.
 */
export function StateDotBalance() {
  return (
    <span aria-hidden style={{ width: STATE_DOT_SIZE, flex: 'none' }} />
  );
}
