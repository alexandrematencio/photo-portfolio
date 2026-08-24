/**
 * LE MOT « SERIES » EN LETTRAGE — un SVG qui remplit TOUTE la largeur de sa
 * boîte, quelle qu'elle soit. Composant unique : la page /series l'affiche en
 * grand sur sa branche desktop et sur sa branche mobile, aux deux échelles
 * d'une même recette. Ne pas le recopier ailleurs — c'est la mesure qui
 * changerait en silence d'un endroit à l'autre.
 *
 * **Recette héritée de « Selected Works »** (`ScrollPhysicsGallery`) : le
 * `viewBox` donne le ratio — donc la hauteur — et `textLength` FORCE la chasse
 * du texte à la largeur du viewBox. Le remplissage est garanti par
 * CONSTRUCTION, pas calculé, et ne dépend d'aucune métrique de fonte. C'est
 * indispensable ici : `--font-display` est une pile SYSTÈME (Helvetica Neue sur
 * macOS, Arial sur Windows, Roboto sur Android), dont les chasses diffèrent —
 * une constante calibrée sur l'une déborderait sur l'autre, et un débord de
 * titre, c'est du scroll horizontal.
 *
 * `lengthAdjust="spacing"`, jamais `spacingAndGlyphs` : c'est l'interlettrage
 * qui absorbe l'écart, les glyphes ne sont jamais déformés.
 *
 * **Les cotes**, calibrées sur Helvetica Bold pour que la correction soit nulle
 * sur macOS : « SERIES » y pèse 3,668 em à chasse naturelle. D'où
 * `FONT_SIZE = 1000 / 3,668 = 272,63` pour 1000 de large. La hauteur de boîte
 * est la hauteur de CAPITALE (0,714 em = 195) : le mot n'a ni jambage ni
 * accent, la boîte épouse donc exactement les glyphes — ce qui fait que
 * l'écart mesuré sous le titre est l'écart vu.
 *
 * ⚠️ Recalibré le 2026-08-24 : la recette retranchait jusque-là 0,02 em
 * d'interlettrage par caractère (3,548 em, `FONT_SIZE = 281,8`, cap 201).
 * Le site n'a plus AUCUN interlettrage de titre — demande Alexandre, née de
 * ce lettrage justement, dont l'espacement se voyait sur la branche mobile.
 * Les trois nombres vont ensemble : toucher l'un sans les autres, c'est un
 * mot qui ne remplit plus sa boîte ou une boîte qui ne colle plus aux
 * glyphes.
 *
 * Le texte lisible (SEO, lecteurs d'écran) reste du TEXTE, porté par le `<h1>`
 * appelant en `sr-only` ; ce SVG n'en est que le rendu, d'où son `aria-hidden`.
 * L'habillage (`.series-title`) vit dans `globals.css` : `display: block`,
 * `width: 100%`, `overflow: visible`.
 */

const VIEWBOX_W = 1000;
const FONT_SIZE = 272.63;

/** Hauteur de boîte pour 1000 de large — c'est la hauteur de capitale. */
export const SERIES_WORDMARK_CAP = 195;

/**
 * Largeur de boîte qui fait rendre le mot à `fontSize` px. L'inverse de la
 * règle de trois ci-dessus : le SVG étant en `width: 100%`, sa taille de fonte
 * rendue vaut `FONT_SIZE × largeur / 1000`.
 *
 * C'est par là que la branche desktop cale son état réduit sur le titre
 * d'`/archives` : elle demande la largeur qui donne exactement la même taille
 * de fonte, plutôt que de transcrire un rapport d'échelle à la main.
 */
export function seriesWordmarkWidthFor(fontSize: number) {
  return (fontSize * VIEWBOX_W) / FONT_SIZE;
}

export function SeriesWordmark() {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${SERIES_WORDMARK_CAP}`}
      aria-hidden="true"
      focusable="false"
    >
      <text
        x="0"
        y={SERIES_WORDMARK_CAP}
        fontSize={FONT_SIZE}
        textLength={VIEWBOX_W}
        lengthAdjust="spacing"
      >
        SERIES
      </text>
    </svg>
  );
}
