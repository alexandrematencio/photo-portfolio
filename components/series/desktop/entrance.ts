import gsap from 'gsap';
import { SERIES_WORDMARK_CAP } from '../shared/SeriesWordmark';

/**
 * ENTRÉE DE LA PAGE /series — deux mouvements, une seule arrivée.
 *
 * 1. La RANGÉE de covers entre par la droite et freine jusqu'à sa place, à
 *    gauche : un train qui rentre en gare.
 * 2. Le LETTRAGE « SERIES » se révèle LETTRE PAR LETTRE : chacune monte d'une
 *    hauteur de boîte en basculant de 60° autour de son axe horizontal, dans
 *    une perspective, sous un masque qui coupe au bord haut de la rangée.
 *
 * ⚠️ **La révélation du titre est une TRANSPOSITION STRICTE** de l'animation
 * de `.home_title` de la démo Codrops « Building Asynchronous Page
 * Transitions » (https://async-page-transitions.crnacura.workers.dev/,
 * `Enter-BLgfmHMt.js`) — demande Alexandre, 2026-08-25 : « strictement la même
 * animation ». Sa recette, verbatim :
 *
 *     const split = new SplitText(h1, { type: 'chars' });
 *     gsap.set(split.chars, { y: '100%', rotateX: 60, force3D: true });
 *     tl.to(split.chars, { y: 0, rotateX: 0, duration: 2.1,
 *                          stagger: 0.035, ease: 'expo.out' }, 0.32);
 *
 * avec, côté CSS, `overflow: hidden` et `perspective: 1000px` sur le `h1`.
 * Les cinq nombres (60°, 100 %, 2,1 s, 0,035 s, 0,32 s) et l'easing viennent
 * de là et ne se retouchent pas « au goût » sans le dire.
 *
 * ⚠️ Aucune de ces deux animations ne touche aux propriétés déjà écrites
 * ailleurs sur la page :
 *   - la rangée n'est animée qu'en `x` — son `y` appartient au mécanisme de
 *     révélation du footer (§3.7 invariant 14) ;
 *   - les lettres ne sont PAS le `<span>` que le repli met à l'échelle
 *     (`titleRef`) : elles vivent DEDANS. Les transforms se composent au lieu
 *     de se disputer — l'effet de repli repose sa cible à chaque commit de
 *     phase ET à chaque redimensionnement (invariant 17), il écraserait une
 *     animation d'entrée sans le moindre signal.
 */

// ── Le train ────────────────────────────────────────────────────────────────

/**
 * `power2.out`, et ce n'est pas un choix de goût : sa vitesse décroît
 * LINÉAIREMENT jusqu'à zéro, c'est-à-dire une décélération CONSTANTE — le
 * freinage d'un train. `expo.out` (ou l'`expo.inOut` des vols, §3.7 invariant
 * 5bis) écraserait presque tout le trajet dans les premières frames et
 * finirait en glissade interminable : la signature d'une porte qui s'ouvre,
 * pas d'une masse qui s'arrête.
 */
const TRAIN_EASE = 'power2.out';
const TRAIN_DUR = 1.0;

/**
 * Jeu des attelages. Un train tracté roule attelages TENDUS : chaque wagon
 * traîne un peu derrière sa position de repos, et d'autant plus qu'il est
 * loin de la tête. Au freinage, la rame se referme d'avant en arrière.
 *
 * D'où deux paramètres et pas un : un décalage initial PROPORTIONNEL au rang
 * (12 px par pile, plafonné — au-delà de la huitième on est de toute façon
 * hors écran, et le plafond borne le `scrollWidth` que ces transforms ajoutent
 * temporairement à la rangée), et un départ échelonné qui fait courir la
 * fermeture le long de la rame au lieu de la jouer d'un bloc.
 *
 * Résolution en `power3.out` sur une durée plus longue que celle du corps du
 * train : la rame finit de se tasser APRÈS que la locomotive s'est arrêtée.
 * C'est ce décalage, et lui seul, qui donne le poids — sans rebond (§3.2 :
 * pas de bounce sur du contenu sérieux).
 */
const COUPLING_STEP = 12;
const COUPLING_MAX = 90;
const COUPLING_STAGGER = 0.012;
const COUPLING_DUR = 1.2;

// ── Le lettrage ─────────────────────────────────────────────────────────────

/** Les cinq nombres de la démo. Voir le préambule — ils viennent d'ailleurs. */
const CHARS_AT = 0.32;
const CHARS_DUR = 2.1;
const CHARS_STAGGER = 0.035;
const CHARS_ROTATE = 60;
const CHARS_EASE = 'expo.out';
const CHARS_PERSPECTIVE = 1000;

/**
 * Marge verticale de chaque fenêtre de lettre, en pourcentage de la hauteur de
 * capitale. Elle sert DEUX fins, et c'est pour ça qu'elle vaut 6 et pas 2 :
 *
 *   - la boîte du lettrage est calée sur la hauteur de CAPITALE, donc sur la
 *     ligne de base, sous laquelle les glyphes ronds (S, E, R) débordent d'un
 *     bon pour cent. Une fenêtre à ras raboterait leur courbe ;
 *   - `y: '100%'` déplace la lettre de SA PROPRE hauteur. Fenêtre plus haute
 *     que la capitale, la lettre descend donc PLUS bas que la ligne de
 *     masquage, laquelle passe 2 % sous la ligne de base (cf.
 *     `WORDMARK_MASK_CLIP`). C'est ce qui permet de garder le `100%` de la
 *     démo à la lettre, sans rien ajouter pour compenser notre propre masque.
 */
const LETTER_SLACK_PCT = 6;

/**
 * ÉTATS DE DÉPART, ÉCRITS DANS LE HTML SERVEUR.
 *
 * Ils ne sont pas posés par le JS au montage, et c'est délibéré : la page est
 * un export STATIQUE, donc le navigateur peint le HTML bien avant que
 * l'hydratation ne rende la main à React (mesuré ~200 ms en dev). Poser
 * l'état de départ dans l'effet, c'est montrer la page au repos puis
 * téléporter la rangée hors écran — le train arrivait deux fois. Même parti
 * que le splash de la home, qui sert ses éléments animés en `opacity: 0` dans
 * le markup.
 *
 * Le lettrage, lui, est descendu EN BLOC sous le masque : les lettres n'ont
 * pas encore d'existence à ce moment-là (leur découpage suppose un SVG rendu
 * et mesuré, cf. `splitWordmark`). Le relais est invisible parce que les deux
 * états coïncident — le bloc à 115 % de la capitale et les lettres à 100 % de
 * leur propre fenêtre sont l'un comme l'autre entièrement sous la ligne.
 *
 * Les deux valeurs sont exprimées de façon à coïncider EXACTEMENT avec ce que
 * le JS reprendra : `100vw` est la largeur de fenêtre au sens de
 * `window.innerWidth` (barre de défilement classique comprise), et un
 * pourcentage de `translateY` se rapporte à la hauteur de l'élément lui-même.
 *
 * ⚠️ Contrepartie, à ne pas oublier : ce qui est caché par le HTML doit être
 * RÉVÉLÉ par quelqu'un. Les deux chemins qui ne jouent pas l'entrée
 * (mouvement réduit, branche cachée) reposent explicitement les deux éléments
 * (`settleAtRest`), et un `<noscript>` annule les deux transforms — sans quoi
 * la rangée resterait hors écran pour de bon.
 */
export const INITIAL_ROW_TRANSFORM = 'translateX(100vw)';
export const INITIAL_WORDMARK_TRANSFORM = 'translateY(115%)';

/**
 * LE MASQUE — la découpe qui tient les lettres cachées sous le bord haut de la
 * rangée. C'est notre équivalent de l'`overflow: hidden` que la démo pose sur
 * son `h1` ; nous ne pouvons pas l'employer tel quel, il faut laisser le
 * dépassement SORTIR par le haut (la boîte du lettrage épouse les glyphes).
 * D'où `inset()` à valeurs négatives sur trois côtés — la découpe s'étend hors
 * de la boîte, elle ne coupe qu'en bas.
 *
 * Les 2 % de mou en bas : `SeriesWordmark` cale la boîte sur la hauteur de
 * CAPITALE, donc sur la ligne de base — or les glyphes ronds débordent
 * dessous, et le SVG est en `overflow: visible` exprès. Une découpe à 0 % les
 * raboterait à l'arrêt. Ces 2 % sont la raison d'être de `LETTER_SLACK_PCT`.
 *
 * Permanent et inerte : la découpe est solidaire du lettrage, elle voyage avec
 * lui quand il se replie. Rien à nettoyer à la fin de l'entrée.
 */
export const WORDMARK_MASK_CLIP = 'inset(-100% -10% -2% -10%)';

/**
 * DÉCOUPE DU LETTRAGE EN LETTRES — l'équivalent de `SplitText` pour un mot qui
 * n'est pas du texte HTML.
 *
 * Le mot est UN SEUL `<text>` SVG dont `textLength` force la chasse : c'est ce
 * qui garantit le remplissage sans dépendre d'aucune métrique de fonte
 * (§3.7 invariant 17), et il n'est donc pas question de le remplacer par six
 * textes indépendants — la somme de six chasses naturelles ne fait pas la
 * largeur voulue.
 *
 * La sortie : six fenêtres, chacune contenant une COPIE du SVG entier dont le
 * seul `viewBox` change. Le texte est identique dans les six, donc les glyphes
 * tombent exactement où le SVG d'origine les met ; c'est le cadrage qui isole
 * une lettre. Rien n'est transcrit, rien n'est recalculé : les bornes viennent
 * de `getStartPositionOfChar`, c'est-à-dire du moteur de rendu lui-même, APRÈS
 * ajustement par `textLength`.
 *
 * Tout est en POURCENTAGES de la boîte. Les bornes sont en unités de `viewBox`,
 * donc proportionnelles par nature : le découpage survit au redimensionnement
 * sans qu'aucun écouteur n'ait à le refaire. C'est aussi ce qui le rend
 * compatible avec le repli, qui met la boîte à l'échelle (invariant 17).
 *
 * Le SVG d'origine reste EN PLACE, seulement `visibility: hidden` : c'est lui
 * qui donne sa hauteur à la boîte (ratio du `viewBox`), et le retirer ferait
 * s'effondrer le titre. Il redevient visible si l'on défait le découpage.
 */
export type SplitWordmark = {
  chars: HTMLElement[];
  restore: () => void;
};

export function splitWordmark(host: HTMLElement): SplitWordmark | null {
  const svg = host.querySelector('svg');
  const text = svg?.querySelector('text');
  if (!svg || !text) return null;

  let edges: number[];
  try {
    const n = text.getNumberOfChars();
    if (!n) return null;
    edges = [];
    for (let i = 0; i < n; i++) edges.push(text.getStartPositionOfChar(i).x);
    edges.push(text.getEndPositionOfChar(n - 1).x);
  } catch {
    // Texte pas encore rendu (fonte, sous-arbre masqué) : pas de découpage,
    // donc pas d'animation de lettres. L'appelant repose le mot au repos.
    return null;
  }

  const boxW = svg.viewBox.baseVal.width;
  const boxH = SERIES_WORDMARK_CAP;
  const slack = (LETTER_SLACK_PCT / 100) * boxH;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  const layer = document.createElement('div');
  layer.setAttribute('data-wordmark-chars', '');
  // `perspective` sur le PARENT des lettres, comme la démo la pose sur son
  // `h1` : c'est elle qui donne au basculement sa profondeur. Sans elle,
  // `rotateX` n'est plus qu'un écrasement vertical.
  layer.style.cssText =
    `position:absolute;inset:0;perspective:${CHARS_PERSPECTIVE}px;`;

  const chars = edges.slice(0, -1).map((x, i) => {
    const w = edges[i + 1] - x;
    const cell = document.createElement('span');
    // `overflow: hidden` sur la CELLULE : la feuille de style du site met les
    // SVG du titre en `overflow: visible` (le mot déborde de sa boîte de
    // capitale, cf. les glyphes ronds), et chaque fenêtre contient le mot
    // entier — sans coupe, les six lettres se peindraient six fois.
    cell.style.cssText =
      `position:absolute;display:block;overflow:hidden;` +
      `left:${pct(x, boxW)};width:${pct(w, boxW)};` +
      `top:${pct(-slack, boxH)};height:${pct(boxH + 2 * slack, boxH)};` +
      `backface-visibility:hidden;will-change:transform;`;

    // Le SVG de la fenêtre garde le `viewBox` D'ORIGINE et la largeur du mot
    // ENTIER : c'est la cellule qui coupe, jamais le SVG qui se recadre. Un
    // `viewBox` par lettre marchait, mais il fallait alors `preserveAspectRatio`
    // pour recaler la fenêtre dans sa cellule — et cette mise à l'échelle
    // décalait chaque lettre d'une fraction de pixel : mesuré à 121 de plus
    // grand écart et 1,3 % de pixels touchés contre le rendu d'un seul tenant,
    // tous sur les bords verticaux des glyphes, c'est-à-dire un demi-pixel de
    // glissement qui change l'anticrénelage des fûts. Ici, le SVG est posé
    // dans les mêmes conditions que l'original — même `viewBox`, même largeur
    // rendue — et seule sa position dans la cellule change.
    const inner = document.createElement('span');
    inner.style.cssText =
      `position:absolute;display:block;` +
      `left:${pct(-x, w)};width:${pct(boxW, w)};` +
      `top:${pct(slack, boxH + 2 * slack)};`;
    const win = svg.cloneNode(true) as SVGSVGElement;
    win.style.cssText = 'display:block;width:100%;height:auto;';
    inner.appendChild(win);
    cell.appendChild(inner);
    layer.appendChild(cell);
    return cell;
  });

  const hostPosition = host.style.position;
  host.style.position = 'relative';
  svg.style.visibility = 'hidden';
  host.appendChild(layer);

  return {
    chars,
    restore: () => {
      layer.remove();
      svg.style.visibility = '';
      host.style.position = hostPosition;
    },
  };
}

// ── Exécution ───────────────────────────────────────────────────────────────

export type Entrance = { finish: () => void };

/**
 * Repose la rangée et le lettrage à leur place, sans animation. C'est la
 * contrepartie obligatoire des états de départ servis dans le HTML : tout
 * chemin qui renonce à l'entrée doit passer par ici.
 */
export function settleAtRest(row: HTMLElement, wordmark: HTMLElement): void {
  gsap.set(row, { x: 0 });
  gsap.set(wordmark, { y: 0 });
}

/**
 * Joue l'entrée. L'appelant a déjà vérifié que la branche est VISIBLE
 * (`offsetParent`) et que le mouvement n'est pas réduit.
 *
 * Les états de départ sont posés en `gsap.set` SYNCHRONE, avant la
 * construction de la timeline : un `tl.set()` ne s'exécuterait qu'au premier
 * tick du ticker, donc potentiellement après une frame peinte au repos.
 */
export function runEntrance({
  row,
  stacks,
  wordmark,
}: {
  row: HTMLElement;
  stacks: HTMLElement[];
  wordmark: HTMLElement;
}): Entrance {
  // Le train part de HORS ÉCRAN à droite — une largeur de fenêtre pleine, la
  // même que celle qu'écrit `INITIAL_ROW_TRANSFORM`. On ne MESURE pas le bord
  // gauche de la rangée pour la déduire : elle est déjà translatée par le HTML
  // au moment où cet appel a lieu, le rect ne dit donc plus où elle se pose.
  // Le débord ne crée pas de barre horizontale — le conteneur de scroll de la
  // page est en `overflow-x-hidden` (`FramedScroll`).
  const travel = window.innerWidth;
  const slack = (i: number) => Math.min(i * COUPLING_STEP, COUPLING_MAX);

  gsap.set(row, { x: travel });
  gsap.set(stacks, { x: (i: number) => slack(i) });

  // Le découpage AVANT de rendre la main au lettrage : les lettres prennent
  // le relais du bloc descendu par le HTML, et les deux états se valent à
  // l'œil (tout est sous le masque). L'ordre inverse montrerait le mot posé
  // le temps d'une frame.
  const split = splitWordmark(wordmark);
  if (split) {
    gsap.set(split.chars, { y: '100%', rotateX: CHARS_ROTATE, force3D: true });
    gsap.set(wordmark, { y: 0 });
  }

  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    detach();
    // `x` explicitement, JAMAIS `clearProps: 'transform'` sur la rangée : son
    // `y` porte l'état du footer (§3.7 invariant 14). Sur les piles, en
    // revanche, la purge ciblée est la bonne fin — elles n'ont aucun transform
    // en ligne posé par React (§3.7 invariant 4).
    gsap.set(row, { x: 0 });
    gsap.set(stacks, { clearProps: 'transform' });
    gsap.set(wordmark, { y: 0 });
    // Le découpage se DÉFAIT à la fin : l'état de repos redevient le SVG d'un
    // seul tenant, exactement le DOM d'avant l'entrée. Le repli, le
    // redimensionnement et tout ce qui viendra n'ont donc pas six cellules en
    // plus sous les pieds.
    //
    // Le raccord est mesuré, pas espéré : à l'arrêt, les six fenêtres et le
    // mot d'un seul tenant diffèrent de 0,14 en écart moyen sur 255, 316
    // pixels sur 198 000 au-dessus de 8 — un cinquième de pixel de glissement
    // sur les bords verticaux du « I », la cellule la plus étroite, donc celle
    // où l'arrondi de mise en page est le plus amplifié. Invisible, et de
    // toute façon du même ordre que ce que coûterait de les garder.
    split?.restore();
  };

  const tl = gsap.timeline({ onComplete: settle });
  tl.to(row, { x: 0, duration: TRAIN_DUR, ease: TRAIN_EASE }, 0)
    .to(
      stacks,
      {
        x: 0,
        duration: COUPLING_DUR,
        ease: 'power3.out',
        stagger: { each: COUPLING_STAGGER },
      },
      0
    );
  if (split)
    tl.to(
      split.chars,
      {
        y: 0,
        rotateX: 0,
        force3D: true,
        duration: CHARS_DUR,
        stagger: CHARS_STAGGER,
        ease: CHARS_EASE,
      },
      CHARS_AT
    );

  /**
   * On n'oblige jamais à attendre une animation (§3.1.4). Le premier geste de
   * l'utilisateur — molette, clic, touche — n'ANNULE pas l'entrée (elle
   * disparaîtrait sous la main, et le train se téléporterait), il l'accélère
   * d'un facteur 3 : ce qui restait se joue en un tiers de temps.
   */
  const hurry = () => tl.timeScale(3);
  const opts = { passive: true, once: true } as const;
  window.addEventListener('wheel', hurry, opts);
  window.addEventListener('pointerdown', hurry, opts);
  window.addEventListener('keydown', hurry, opts);
  function detach() {
    window.removeEventListener('wheel', hurry);
    window.removeEventListener('pointerdown', hurry);
    window.removeEventListener('keydown', hurry);
  }

  return {
    finish: () => {
      tl.kill();
      settle();
    },
  };
}
