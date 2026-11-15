import { useEffect, type RefObject } from 'react';
import type gsap from 'gsap';
import type { Phase } from './chains';

/**
 * Comment on reconnaît un NOUVEAU geste de molette (2026-11-15, deuxième
 * version). L'inertie d'un trackpad émet à chaque frame pendant une à deux
 * secondes, avec une amplitude qui ne fait que DÉCROÎTRE : un silence de
 * 250 ms (première version) obligeait donc à attendre la fin de la traîne,
 * « des fois ça marche », jamais au moment voulu. On reconnaît maintenant un
 * geste neuf à deux signes, le premier qui arrive l'emporte :
 *   - un silence de `GESTURE_GAP_MS` (une molette de souris, cran par cran) ;
 *   - une amplitude qui REMONTE au-dessus de l'enveloppe de la traîne :
 *     `|delta| > enveloppe × GESTURE_RISE`, l'enveloppe étant le maximum
 *     récent amorti de `ENVELOPE_DECAY` par événement. Une inertie ne remonte
 *     jamais ; un doigt reposé, si.
 */
const GESTURE_GAP_MS = 120;
const GESTURE_RISE = 1.4;
const ENVELOPE_DECAY = 0.9;
/** Sous ce delta (px), un sursaut n'est que du bruit de capteur. */
const GESTURE_MIN = 3;

/**
 * Le défilement ADOUCI de la rangée (demande Alexandre, 2026-11-15 : « adouci
 * comme pour la home, mais plus rapide »). La molette ne pose plus
 * `scrollLeft`, elle déplace une CIBLE que la rangée rejoint par une approche
 * exponentielle (constante de temps `SMOOTH_TAU` s). Arrivée aux bouts,
 * c'est la cible qui bute : la rangée y FREINE au lieu d'y cogner. La home
 * (Lenis, 1,2 s expo.out) tient la page entière ; ici ~0,3 s pour s'établir,
 * un simple amorti qui n'encombre pas un petit geste.
 */
const SMOOTH_TAU = 0.075;

/**
 * Gestes de la rangée fermée : molette sur les deux axes et réserve du footer
 * (§3.7 invariant 14), rangement du footer, cliquer-glisser.
 */
export function useRowGestures({
  sceneRef,
  rowRef,
  phase,
  scrollContainer,
  showFooter,
  footerShown,
  footerTween,
}: {
  sceneRef: RefObject<HTMLElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  phase: Phase;
  scrollContainer: () => HTMLElement | null;
  showFooter: (show: boolean) => void;
  footerShown: RefObject<boolean>;
  footerTween: RefObject<gsap.core.Tween | null>;
}) {
  // Molette → défilement horizontal de la rangée (spec §5), sur LES DEUX AXES.
  //
  // Écoutée sur le CONTENEUR DE SCROLL DE LA PAGE, plus sur la seule rangée :
  // toute la surface de la page répond au geste, pas uniquement la bande de
  // piles en bas d'écran (la nav-bar, elle, est `fixed` HORS de ce conteneur —
  // elle garde donc son comportement propre). Corollaire : la page ne défile
  // plus jamais verticalement d'elle-même, c'est ce gestionnaire qui décide,
  // et le seul défilement vertical possible est la révélation du footer en
  // bout de rangée.
  //
  // Les DEUX AXES mènent à la rangée (demande Alexandre, 2026-08-24) : molette
  // de souris comme geste horizontal de trackpad, c'est à l'utilisateur de
  // choisir. On retient l'axe DOMINANT du geste et on l'applique tel quel — un
  // geste vers le bas ou vers la droite avance dans la rangée, vers le haut ou
  // vers la gauche recule.
  //
  // ⚠️ LE FOOTER N'ENTRE QU'AU GESTE SUIVANT LA BUTÉE (2026-11-15, détail
  // plus bas). Du 2026-08-24 à cette date, seul l'axe VERTICAL pouvait le
  // chercher : une inertie de fin de glissement latéral suffisait à le tirer.
  // La butée qui arrête la traîne règle ce problème pour les deux axes, d'où
  // le retour de « vers la droite » (demande Alexandre : « si un scroll
  // down/right s'ajoute »). Au retour : vers le haut on range le footer, vers
  // la gauche on repart dans la rangée (et le footer se range de lui-même dès
  // qu'elle quitte le bout, via l'écouteur `scroll` ci-dessous).
  //
  // ⚠️ L'axe horizontal était jusqu'ici laissé au natif (`deltaX` dominant →
  // early return). Le laisser passer maintenant le ferait jouer DEUX fois
  // au-dessus de la rangée, qui est elle-même en `overflow-x-auto` : d'où le
  // `preventDefault` sur les deux axes.
  //
  // Non-passive : on doit pouvoir preventDefault.
  useEffect(() => {
    const cont = scrollContainer();
    const row = rowRef.current;
    if (!cont || !row) return;

    // LA BUTÉE AVANT LE FOOTER (demande Alexandre, 2026-11-15 : « une fois
    // le bout atteint, ça stoppe le scroll en cours, mais au scroll suivant,
    // même petit, ça sort le footer »). Le geste qui amène la rangée à son
    // bout s'y arrête, traîne d'inertie comprise ; le premier événement d'un
    // NOUVEAU geste (détection en tête de fichier) vers le bas ou la droite
    // fait entrer le footer.
    let lastWheel = -Infinity;
    let envelope = 0;

    // Défilement adouci : la cible, et la boucle qui la rejoint.
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let target = row.scrollLeft;
    let raf = 0;
    let lastFrame = 0;
    const stopSmooth = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      const gap = target - row.scrollLeft;
      if (Math.abs(gap) < 0.5) {
        row.scrollLeft = target;
        raf = 0;
        return;
      }
      row.scrollLeft += gap * (1 - Math.exp(-dt / SMOOTH_TAU));
      raf = requestAnimationFrame(frame);
    };
    const scrollTo = (next: (from: number) => number) => {
      // Rien en cours : la rangée a pu bouger par ailleurs (glisser, flèches).
      if (!raf) target = row.scrollLeft;
      const maxLeft = row.scrollWidth - row.clientWidth;
      target = Math.max(0, Math.min(maxLeft, next(target)));
      if (reduced.matches) {
        row.scrollLeft = target;
        return;
      }
      if (!raf) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    // La main reprend la rangée (clic, glisser, touche) : l'amorti s'arrête
    // où il en est. Un clic qui OUVRE une série mesure les piles, elles ne
    // doivent plus bouger sous les clones (invariant 18, même raison).
    const takeOver = () => stopSmooth();
    row.addEventListener('pointerdown', takeOver, true);
    window.addEventListener('keydown', takeOver, true);

    const onWheel = (e: WheelEvent) => {
      // Branche cachée (viewport mobile) : ne jamais réagir — invariant 3.
      if (sceneRef.current?.offsetParent === null) return;

      if (phase !== 'closed') {
        // Vue ouverte : rien ne change à l'expérience — la colonne de vignettes
        // garde son défilement natif. Seule la PAGE est immobilisée, sans quoi
        // la vue ouverte remonterait de 70 px sous la nav-bar en découvrant un
        // footer qui n'a rien à faire là (il n'appartient qu'au bout de la
        // rangée). Pendant les vols (opening/closing/switching), tout est gelé :
        // un défilement en cours de vol déplacerait les éléments réels sous des
        // clones `position: fixed`, et le raccord se ferait à côté.
        const t = e.target as Element | null;
        const inCol = t?.closest?.('[data-open-col]');
        if (!inCol || phase !== 'open') e.preventDefault();
        return;
      }

      // Axe dominant du geste. Un trackpad renvoie presque toujours un peu des
      // deux ; prendre le plus grand évite qu'une diagonale involontaire
      // annule le geste voulu.
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();

      // Nouveau geste ? (en tête de fichier)
      const size = Math.abs(delta);
      const fresh =
        e.timeStamp - lastWheel >= GESTURE_GAP_MS ||
        (size >= GESTURE_MIN && size > envelope * GESTURE_RISE);
      envelope = fresh ? size : Math.max(size, envelope * ENVELOPE_DECAY);
      lastWheel = e.timeStamp;

      const maxLeft = row.scrollWidth - row.clientWidth;
      // Le bout, c'est celui où va la rangée (la cible), pas celui où l'amorti
      // l'a déjà menée. Tolérance d'1 px : scrollLeft fractionnaire.
      const atEnd = (raf ? target : row.scrollLeft) >= maxLeft - 1;

      if (delta > 0) {
        // Au bout, la traîne du geste qui y a mené bute sans rien faire ; le
        // premier événement d'un geste NEUF sort le footer.
        if (atEnd) {
          if (fresh && !footerShown.current) showFooter(true);
        } else scrollTo((t) => t + delta);
      } else if (footerShown.current && !horizontal) {
        // Vers le haut, le footer se range d'abord : il occupe le cran qui
        // l'avait fait venir.
        showFooter(false);
      } else {
        // Vers la gauche (ou vers le haut footer déjà rangé) → on recule dans
        // la rangée. Si le footer était sorti, l'écouteur `scroll` de la rangée
        // le range dès qu'elle quitte le bout : c'est déjà le chemin du
        // cliquer-glisser et des flèches, on n'en ajoute pas un deuxième.
        scrollTo((t) => t + delta);
      }
    };

    cont.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stopSmooth();
      cont.removeEventListener('wheel', onWheel);
      row.removeEventListener('pointerdown', takeOver, true);
      window.removeEventListener('keydown', takeOver, true);
    };
  }, [phase, scrollContainer, showFooter, footerShown, rowRef, sceneRef]);

  // Le footer n'existe qu'au bout de la rangée : dès qu'on s'en éloigne — au
  // cliquer-glisser, aux flèches du clavier, à la barre de défilement — il se
  // range. Sans ça il resterait suspendu au-dessus d'une rangée revenue au
  // milieu de sa course, sans plus rien à quoi être accroché.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const onScroll = () => {
      if (!footerShown.current) return;
      if (sceneRef.current?.offsetParent === null) return;
      const maxLeft = row.scrollWidth - row.clientWidth;
      if (row.scrollLeft < maxLeft - 1) showFooter(false);
    };
    row.addEventListener('scroll', onScroll, { passive: true });
    return () => row.removeEventListener('scroll', onScroll);
  }, [showFooter, footerShown, rowRef, sceneRef]);

  // Le vol en cours ne doit pas être doublé d'un glissement de footer.
  useEffect(
    () => () => {
      footerTween.current?.kill();
    },
    [footerTween]
  );

  // Cliquer-glisser sur la rangée. Seuil de 6 px avant de « voler » le clic.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScroll = row.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        row.setPointerCapture(e.pointerId);
      }
      if (moved) row.scrollLeft = startScroll - dx;
    };
    const onUp = () => {
      dragging = false;
    };
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    row.addEventListener('pointerdown', onDown);
    row.addEventListener('pointermove', onMove);
    row.addEventListener('pointerup', onUp);
    row.addEventListener('click', onClickCapture, true);
    return () => {
      row.removeEventListener('pointerdown', onDown);
      row.removeEventListener('pointermove', onMove);
      row.removeEventListener('pointerup', onUp);
      row.removeEventListener('click', onClickCapture, true);
    };
  }, [rowRef]);
}
