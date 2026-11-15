import { useEffect, useRef, type RefObject } from 'react';
import type gsap from 'gsap';
import type { Phase } from './chains';

/**
 * Comment on reconnaît un NOUVEAU geste de molette (2026-11-15, troisième
 * version). L'inertie d'un trackpad émet à chaque frame pendant une à deux
 * secondes, avec une amplitude qui ne fait que DÉCROÎTRE : un silence de
 * 250 ms (première version) obligeait donc à attendre la fin de la traîne,
 * « des fois ça marche », jamais au moment voulu. Un geste neuf se reconnaît
 * à l'un de deux signes :
 *   - un silence de `GESTURE_GAP_MS` (une molette de souris, cran par cran) ;
 *   - une amplitude qui REMONTE au-dessus de l'enveloppe de la traîne
 *     (`|delta| > enveloppe × GESTURE_RISE`, enveloppe = maximum récent amorti
 *     de `ENVELOPE_DECAY` par événement), MAIS SEULEMENT APRÈS UNE RETOMBÉE
 *     (`|delta| < enveloppe × GESTURE_DECLINE` vue au moins une fois depuis
 *     le dernier geste ou la dernière butée). Deuxième version, sans cette
 *     condition : un doigt qui ACCÉLÈRE contre la butée passait pour un geste
 *     neuf, et la série suivante (ou le footer) partait dans le même scroll.
 *     Une inertie retombe toujours avant qu'un doigt reposé ne remonte ; un
 *     doigt qui pousse encore ne retombe pas.
 */
const GESTURE_GAP_MS = 120;
const GESTURE_RISE = 1.4;
const GESTURE_DECLINE = 0.7;
const ENVELOPE_DECAY = 0.9;
/** Sous ce delta (px), un sursaut n'est que du bruit de capteur. */
const GESTURE_MIN = 3;

/**
 * Le défilement ADOUCI (demande Alexandre, 2026-11-15 : « adouci comme pour
 * la home, mais plus rapide »), pour la rangée comme pour la colonne de
 * vignettes. La molette ne pose plus la position, elle déplace une CIBLE que
 * l'élément rejoint par une approche exponentielle (constante de temps
 * `SMOOTH_TAU` s). Arrivée aux bouts, c'est la cible qui bute : l'élément y
 * FREINE au lieu d'y cogner. ~0,25 s pour s'établir, contre 1,2 s de Lenis.
 */
const SMOOTH_TAU = 0.075;

/** État du détecteur de geste — dans un ref : il survit aux changements de
 *  phase (une traîne qui chevauche un vol doit rester une traîne). */
type Gesture = {
  last: number;
  envelope: number;
  declined: boolean;
  /** Une butée vient d'agir (footer, série voisine) : la traîne est avalée
   *  jusqu'au prochain geste neuf. */
  swallow: boolean;
};

function feedGesture(g: Gesture, time: number, size: number): boolean {
  const gap = time - g.last >= GESTURE_GAP_MS;
  const rise =
    g.declined && size >= GESTURE_MIN && size > g.envelope * GESTURE_RISE;
  const fresh = gap || rise;
  if (fresh) {
    g.envelope = size;
    g.declined = false;
  } else {
    if (size < g.envelope * GESTURE_DECLINE) g.declined = true;
    g.envelope = Math.max(size, g.envelope * ENVELOPE_DECAY);
  }
  g.last = time;
  return fresh;
}

/** Le geste en cours vient d'amener l'élément à une butée : il faudra une
 *  retombée PUIS une remontée (ou un silence) pour qu'elle agisse. */
function arriveAtEdge(g: Gesture, size: number) {
  g.declined = false;
  g.envelope = Math.max(g.envelope, size);
}

/** Défilement amorti d'un élément sur un axe. */
function smoothScroller(el: HTMLElement, axis: 'x' | 'y', reduced: MediaQueryList) {
  const get = () => (axis === 'x' ? el.scrollLeft : el.scrollTop);
  const set = (v: number) => {
    if (axis === 'x') el.scrollLeft = v;
    else el.scrollTop = v;
  };
  const max = () =>
    axis === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
  let target = get();
  // La position COURANTE vit ici, en flottant, jamais relue sur l'élément :
  // le navigateur arrondit scrollLeft/scrollTop au pixel, un pas de moins
  // d'un pixel y retombait à zéro et l'approche ne convergeait plus — rangée
  // ou colonne figée à 2 px du bout, boucle sans fin (mesuré le 2026-11-15).
  let cur = target;
  let raf = 0;
  let lastFrame = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const frame = (now: number) => {
    // L'horodatage d'une frame peut précéder le performance.now() du départ.
    const dt = Math.max(0, Math.min(0.05, (now - lastFrame) / 1000));
    lastFrame = now;
    const gap = target - cur;
    if (Math.abs(gap) < 0.5) {
      set(target);
      raf = 0;
      return;
    }
    cur += gap * (1 - Math.exp(-dt / SMOOTH_TAU));
    set(cur);
    raf = requestAnimationFrame(frame);
  };
  return {
    stop,
    max,
    /** Position où VA l'élément (la cible), pas celle où l'amorti l'a mené. */
    pos: () => (raf ? target : get()),
    /** Déplace la cible, bornée ; rend true si ce pas l'amène à une butée. */
    by(delta: number): boolean {
      // Rien en cours : l'élément a pu bouger par ailleurs (glisser, flèches,
      // vignette remise sur sa ligne de pose).
      if (!raf) cur = target = get();
      const m = max();
      const before = target;
      target = Math.max(0, Math.min(m, target + delta));
      const hit =
        (delta > 0 && before < m - 1 && target >= m - 1) ||
        (delta < 0 && before > 1 && target <= 1);
      if (reduced.matches) set(target);
      else if (!raf) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(frame);
      }
      return hit;
    },
  };
}

/**
 * Gestes de la page : molette de la rangée fermée sur les deux axes et
 * réserve du footer (§3.7 invariant 14), molette de la vue ouverte (colonne de
 * vignettes et passage à la série voisine), rangement du footer,
 * cliquer-glisser.
 */
export function useRowGestures({
  sceneRef,
  rowRef,
  phase,
  scrollContainer,
  showFooter,
  footerShown,
  footerTween,
  keepPageFlat,
  onAlbumEdge,
}: {
  sceneRef: RefObject<HTMLElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  phase: Phase;
  scrollContainer: () => HTMLElement | null;
  showFooter: (show: boolean) => void;
  footerShown: RefObject<boolean>;
  footerTween: RefObject<gsap.core.Tween | null>;
  /** Garde de la vue ouverte : page à plat, footer rangé (`useFooterReserve`). */
  keepPageFlat: () => void;
  /** Geste neuf contre un bout de l'album en vue ouverte : série suivante
   *  (1, posée sur sa première photo) ou précédente (-1, sur sa dernière). */
  onAlbumEdge: (dir: 1 | -1) => void;
}) {
  const gesture = useRef<Gesture>({
    last: -Infinity,
    envelope: 0,
    declined: false,
    swallow: false,
  });
  const albumEdge = useRef(onAlbumEdge);
  useEffect(() => {
    albumEdge.current = onAlbumEdge;
  });

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

    // LA BUTÉE (demandes Alexandre, 2026-11-15) : au bout de la rangée comme
    // au bout d'un album, le geste qui y mène s'arrête, traîne d'inertie
    // comprise ; seul un geste NEUF (détection en tête de fichier) va plus
    // loin — le footer au bout de la rangée, la série voisine au bout d'un
    // album. Remonter un peu puis redescendre rebute : chaque arrivée à un
    // bout réarme la butée (`arriveAtEdge`).
    const g = gesture.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const rowScroll = smoothScroller(row, 'x', reduced);
    const colEl = () => sceneRef.current?.querySelector<HTMLElement>('[data-open-col]') ?? null;
    let col: { el: HTMLElement; s: ReturnType<typeof smoothScroller> } | null = null;
    const colScroll = () => {
      const el = colEl();
      if (!el) return null;
      if (col?.el !== el) {
        col?.s.stop();
        col = { el, s: smoothScroller(el, 'y', reduced) };
      }
      return col.s;
    };
    const stopAll = () => {
      rowScroll.stop();
      col?.s.stop();
    };
    // La main reprend (clic, glisser, touche) : l'amorti s'arrête où il en
    // est. Un clic qui OUVRE une série mesure les piles, une touche ↑ / ↓
    // remet une vignette sur sa ligne de pose : rien ne doit plus bouger
    // dessous (invariant 18, même raison).
    cont.addEventListener('pointerdown', stopAll, true);
    window.addEventListener('keydown', stopAll, true);

    const onWheel = (e: WheelEvent) => {
      // Branche cachée (viewport mobile) : ne jamais réagir — invariant 3.
      if (sceneRef.current?.offsetParent === null) return;

      // La page ne défile JAMAIS d'elle-même : tout passe par ici.
      e.preventDefault();

      // Axe dominant du geste. Un trackpad renvoie presque toujours un peu des
      // deux ; prendre le plus grand évite qu'une diagonale involontaire
      // annule le geste voulu.
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const raw = horizontal ? e.deltaX : e.deltaY;
      // Molette en lignes (Firefox) : ~16 px la ligne.
      const delta = e.deltaMode === 1 ? raw * 16 : raw;
      if (!delta) return;

      // Le détecteur est nourri dans TOUTES les phases : une traîne qui
      // chevauche un vol reste une traîne quand la vue se pose.
      const size = Math.abs(delta);
      const fresh = feedGesture(g, e.timeStamp, size);
      if (g.swallow) {
        if (!fresh) return;
        g.swallow = false;
      }

      // Pendant les vols (opening/closing/switching), tout est gelé : un
      // défilement en cours de vol déplacerait les éléments réels sous des
      // clones `position: fixed`, et le raccord se ferait à côté.
      if (phase !== 'closed' && phase !== 'open') return;

      if (phase === 'open') {
        // VUE OUVERTE (demande Alexandre, 2026-11-15). Le footer n'y existe
        // pas. Sur la colonne des noms, la molette ne fait rien (elle ne
        // défile pas) ; partout ailleurs — grande photo, colonne de droite —
        // elle fait défiler la COLONNE DE VIGNETTES, amortie comme la rangée.
        // La photo affichée ne change pas (clic, ↑ / ↓). Seul l'axe vertical.
        //
        // ⚠️ Ce n'est plus le défilement natif de la colonne : arrivé à son
        // bout, le navigateur passait le reste du geste à la PAGE malgré
        // `overscroll-contain` — footer sorti, et rien pour le ranger en vue
        // ouverte, page bloquée jusqu'au rechargement (bug signalé le
        // 2026-11-15).
        if (horizontal) return;
        const t = e.target as Element | null;
        if (t?.closest?.('[data-open-left]')) return;
        const cs = colScroll();
        if (!cs) return;
        const m = cs.max();
        const p = cs.pos();
        const atEdge = delta > 0 ? p >= m - 1 : p <= 1;
        if (atEdge) {
          // Butée : la traîne y meurt ; un geste neuf passe à la voisine.
          if (fresh) {
            stopAll();
            g.swallow = true;
            albumEdge.current(delta > 0 ? 1 : -1);
          }
          return;
        }
        if (cs.by(delta)) arriveAtEdge(g, size);
        return;
      }

      const atEnd = rowScroll.pos() >= rowScroll.max() - 1;

      if (delta > 0) {
        // Au bout, la traîne du geste qui y a mené bute sans rien faire ; le
        // premier événement d'un geste NEUF sort le footer.
        if (atEnd) {
          if (fresh && !footerShown.current) {
            g.swallow = true;
            showFooter(true);
          }
        } else if (rowScroll.by(delta)) arriveAtEdge(g, size);
      } else if (footerShown.current && !horizontal) {
        // Vers le haut, le footer se range d'abord : il occupe le cran qui
        // l'avait fait venir.
        showFooter(false);
        g.swallow = true;
      } else {
        // Vers la gauche (ou vers le haut footer déjà rangé) → on recule dans
        // la rangée. Si le footer était sorti, l'écouteur `scroll` de la rangée
        // le range dès qu'elle quitte le bout : c'est déjà le chemin du
        // cliquer-glisser et des flèches, on n'en ajoute pas un deuxième.
        rowScroll.by(delta);
      }
    };

    // Garde : en vue ouverte, la page reste à plat QUOI QU'IL ARRIVE (touche
    // Espace, barre de défilement, défilement d'accessibilité…). Le footer
    // n'appartient qu'au bout de la rangée fermée.
    const onPageScroll = () => {
      if (phase !== 'open') return;
      if (sceneRef.current?.offsetParent === null) return;
      keepPageFlat();
    };
    onPageScroll();

    cont.addEventListener('wheel', onWheel, { passive: false });
    cont.addEventListener('scroll', onPageScroll, { passive: true });
    return () => {
      stopAll();
      cont.removeEventListener('wheel', onWheel);
      cont.removeEventListener('scroll', onPageScroll);
      cont.removeEventListener('pointerdown', stopAll, true);
      window.removeEventListener('keydown', stopAll, true);
    };
  }, [phase, scrollContainer, showFooter, footerShown, keepPageFlat, rowRef, sceneRef]);

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
