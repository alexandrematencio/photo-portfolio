/**
 * Retour à la home par le logo — la transition, en deux moitiés.
 *
 * Depuis n'importe quelle page, cliquer le glyph de la nav-bar :
 *   1. `beginHomeReturn` (au clic, sur la page de DÉPART) mesure la nav-bar,
 *      puis pousse le corps de page vers la droite jusqu'à le sortir de
 *      l'écran. La nav-bar, elle, ne bouge pas ;
 *   2. `playHomeArrival` (au montage du hero, sur la page d'ARRIVÉE) fait
 *      naître le hero à l'emplacement exact du logo : le glyph grandit jusqu'au
 *      centre, la photo sort de lui, et chaque libellé quitte sa place dans la
 *      barre pour sa place dans la rangée du hero.
 *
 * C'est le morph de la home (hero → nav-bar, `HomeHero.tsx`) joué à l'envers et
 * tout seul. Il n'y a pas de fondu entre deux éléments : la nav-bar est
 * démontée dans le commit même où le hero se monte, et le hero commence
 * posé sur les rects qu'on vient de lui mesurer.
 *
 * Les deux moitiés ne se parlent que par `pending` : un module, pas un
 * contexte React — la page de départ est démontée avant que l'autre existe.
 *
 * ⚠️ Le corps de page est démonté par le routeur à un instant qu'on ne
 * choisit pas. Ce qui glisse est donc une COPIE (`cloneNode`), posée sur
 * `<body>` ; l'original est masqué tout de suite. Sans la copie, le contenu
 * disparaîtrait d'un coup dès que la home est prête, en plein mouvement.
 *
 * Mouvement réduit : `beginHomeReturn` ne fait rien, la navigation reste
 * celle d'avant — instantanée (CLAUDE.md §3.2).
 */

import { animate, rubberCurve, smoothstep, type RubberCurve } from '@/lib/motion/rubber';

// ─── Réglages ──────────────────────────────────────────────────────────────
// Tout ce qui se règle à l'œil est ici. Les durées sont en secondes.

/** Du clic au repos complet. Le vol du hero se raccourcit pour tenir dedans
    quand la home met du temps à arriver — jusqu'à `ARRIVAL_MIN`. */
const BUDGET = 1;
const ARRIVAL_MAX = 0.86;
const ARRIVAL_MIN = 0.62;

/** Sortie du corps de page. */
const EXIT_DURATION = 0.64;
/** Trajet en largeurs d'écran : au-delà de 1, le contenu sort encore lancé et
    son freinage se passe hors champ. */
const EXIT_TRAVEL = 1.12;
/** Cisaillement maximal du contenu poussé, en degrés. Le haut (côté logo, d'où
    vient la poussée) part devant, le bas traîne. */
const EXIT_SKEW = 2.2;

/** `prompt` pour les deux corps qui RÉPONDENT au clic : le contenu, puis le
    glyph. Les autres suivent, leur inertie est la bienvenue. */
const CONTENT: RubberCurve = rubberCurve({
  lead: 0.7,
  stiffness: 420,
  damping: 30,
  onset: 'prompt',
});
/** Le glyph mène : il est ce qu'on a cliqué. */
const LOGO: RubberCurve = rubberCurve({
  lead: 0.62,
  stiffness: 300,
  damping: 17,
  onset: 'prompt',
});
/** La photo est le corps le plus lourd : plus de retard, plus de dépassement. */
const PHOTO: RubberCurve = rubberCurve({ lead: 0.6, stiffness: 200, damping: 13 });
/** Les libellés sont légers : ils collent au geste et rebondissent court. */
const NAV: RubberCurve = rubberCurve({ lead: 0.58, stiffness: 300, damping: 14 });

/** Étirement maximal dans le sens du trajet (0,1 = 10 %). 0 coupe l'effet. */
const STRETCH_LOGO = 0.1;
const STRETCH_PHOTO = 0.09;
const STRETCH_NAV = 0.14;

/** Départs décalés, en fraction de la durée du vol. Chaque corps a aussi SA
    durée : rien n'arrive au même instant, c'est ce qui donne du poids. */
const LOGO_SPAN = { delay: 0, duration: 0.9 };
const PHOTO_SPAN = { delay: 0.07, duration: 0.93 };
const NAV_SPAN = { delay: 0.04, step: 0.028, duration: 0.82 };

/** Taille de la photo à sa naissance, en fraction de sa taille au repos. */
const PHOTO_BIRTH_SCALE = 0.05;

/** Au-delà, les mesures de la nav-bar ne valent plus rien (fenêtre
    redimensionnée, navigation venue d'ailleurs). */
const HANDOFF_TTL_MS = 10_000;

// ─── Passage de témoin ─────────────────────────────────────────────────────

type Box = { left: number; top: number; width: number; height: number };

export type HomeReturnHandoff = {
  /** `performance.now()` au clic. */
  at: number;
  /** Le glyph de la nav-bar. */
  glyph: Box;
  /** Le TEXTE de chaque libellé de la nav-bar, dans l'ordre de `NAV_LINKS` ;
      `null` quand la rangée est cachée (sous `md`). */
  nav: (Box | null)[];
};

let pending: HomeReturnHandoff | null = null;
/** Une copie du corps de page est en train de sortir. */
let exiting = false;
/** Effacement différé du témoin après un vol interrompu (cf. `playHomeArrival`). */
let forget = 0;

/**
 * Lecture SANS consommation : en dev, React rejoue les effets (StrictMode), et
 * un témoin consommé au premier passage laisserait le second sans rien — hero
 * figé dans son état de départ. C'est `playHomeArrival` qui l'efface, à la fin.
 */
export function peekHomeReturn(): HomeReturnHandoff | null {
  if (pending && performance.now() - pending.at > HANDOFF_TTL_MS) pending = null;
  return pending;
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** La boîte du TEXTE d'un lien : l'item actif porte un padding (son fond
    plein), et le libellé du hero, qui n'en a pas, doit naître sur les lettres. */
function contentBoxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  return {
    left: r.left + pl,
    top: r.top + pt,
    width: r.width - pl - pr,
    height: r.height - pt - pb,
  };
}

// ─── Moitié DÉPART ─────────────────────────────────────────────────────────

/**
 * À appeler dans le `onClick` du logo, SANS annuler la navigation : le routeur
 * part en même temps, la home se charge pendant que le contenu s'en va.
 */
export function beginHomeReturn(glyph: Element, navLinks: HTMLElement[]): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (exiting) return; // double clic : un seul départ

  pending = {
    at: performance.now(),
    glyph: boxOf(glyph),
    nav: navLinks.map((el) => (el.offsetParent !== null ? contentBoxOf(el) : null)),
  };

  const page = document.querySelector<HTMLElement>('[data-scroll-container]');
  if (page) pushAway(page);
}

/** Les positions de défilement ne se clonent pas : on les recopie, sinon la
    copie repartirait du haut de page. Les deux arbres ont le même ordre. */
function copyScroll(from: HTMLElement, to: HTMLElement): void {
  to.scrollTop = from.scrollTop;
  to.scrollLeft = from.scrollLeft;
  const a = from.querySelectorAll<HTMLElement>('*');
  const b = to.querySelectorAll<HTMLElement>('*');
  for (let i = 0; i < a.length; i++) {
    if (a[i].scrollTop || a[i].scrollLeft) {
      b[i].scrollTop = a[i].scrollTop;
      b[i].scrollLeft = a[i].scrollLeft;
    }
  }
}

function pushAway(page: HTMLElement): void {
  const rect = page.getBoundingClientRect();
  const ghost = page.cloneNode(true) as HTMLElement;
  // La copie ne doit répondre à rien de ce qui cherche LE conteneur de scroll
  // (TopBarAutoHide, /series), ni au clavier, ni aux lecteurs d'écran.
  ghost.removeAttribute('data-scroll-container');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    // Sous le hero (z-30) et la nav-bar (z-50) : ce sont eux qui poussent.
    zIndex: '20',
    pointerEvents: 'none',
    transition: 'none',
    transformOrigin: '0 0',
    willChange: 'transform',
  });
  document.body.appendChild(ghost);
  copyScroll(page, ghost);
  page.style.visibility = 'hidden';

  const travel = window.innerWidth * EXIT_TRAVEL;
  exiting = true;
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    exiting = false;
    stop();
    ghost.remove();
  };
  const stop = animate(
    EXIT_DURATION,
    (p) => {
      const x = travel * CONTENT.at(p);
      const skew = -EXIT_SKEW * CONTENT.strain(p);
      ghost.style.transform = `translate3d(${x}px, 0, 0) skewX(${skew}deg)`;
    },
    remove
  );
  // Filets qui ne dépendent PAS de l'horloge d'animation (onglet en
  // arrière-plan : rAF gelé). La copie ne reste jamais à l'écran.
  window.setTimeout(remove, EXIT_DURATION * 1000 + 400);

  // L'original masqué n'est démonté QUE par l'arrivée sur la home. Si le
  // visiteur a cliqué autre chose avant qu'elle n'arrive, le conteneur est
  // réutilisé par la page suivante — encore masqué. On le rend dès que l'URL
  // a changé alors qu'il est toujours là, ou au bout du délai si la navigation
  // n'a jamais eu lieu. Tant que la home charge, il reste masqué : le voir
  // revenir après l'avoir vu partir serait pire qu'un écran vide.
  const from = location.pathname;
  const born = performance.now();
  const watch = window.setInterval(() => {
    const expired = performance.now() - born > HANDOFF_TTL_MS;
    if (page.isConnected && (location.pathname !== from || expired)) {
      page.style.visibility = '';
      pending = null;
    }
    if (!page.isConnected || page.style.visibility === '') window.clearInterval(watch);
  }, 200);
}

// ─── Moitié ARRIVÉE ────────────────────────────────────────────────────────

export type HomeArrivalParts = {
  /** Bloc glyph + « PHOTOGRAPHY ». */
  logoBlock: HTMLElement;
  /** « PHOTOGRAPHY » — fondu en route, il n'existe pas dans la nav-bar. */
  name: HTMLElement | null;
  photo: HTMLElement | null;
  /** Les libellés du hero, dans l'ordre de `NAV_LINKS`. */
  navItems: (HTMLElement | null)[];
  arrow: HTMLElement | null;
};

type Flight = {
  el: HTMLElement;
  curve: RubberCurve;
  stretch: number;
  delay: number;
  duration: number;
  /** Translation et échelle au départ ; au repos : 0, 0, 1. */
  dx: number;
  dy: number;
  scale: number;
  /** Direction du trajet, pour étirer dans son axe. */
  angle: number;
};

const center = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

function flightTransform(f: Flight, p: number): string {
  const q = f.curve.at(p);
  const k = 1 - q;
  const strain = f.stretch * f.curve.strain(p);
  const scale = f.scale + (1 - f.scale) * q;
  // Étiré dans l'axe du trajet, aminci en travers — le volume se conserve à
  // peu près, c'est ce qui se lit comme de la matière et non comme un zoom.
  return (
    `translate(${f.dx * k}px, ${f.dy * k}px) ` +
    `rotate(${f.angle}rad) scale(${1 + strain}, ${1 - strain * 0.5}) rotate(${-f.angle}rad) ` +
    `scale(${scale})`
  );
}

function makeFlight(
  el: HTMLElement,
  from: { x: number; y: number },
  scale: number,
  curve: RubberCurve,
  stretch: number,
  span: { delay: number; duration: number },
  /** Le point de l'élément qui doit tomber sur `from` ; défaut : son centre. */
  anchor?: { x: number; y: number }
): Flight {
  const rest = center(boxOf(el));
  const a = anchor ?? rest;
  // L'échelle s'applique autour du centre de l'élément : l'ancre, elle, se
  // rapproche du centre d'autant. D'où le terme en `scale`.
  const dx = from.x - rest.x - scale * (a.x - rest.x);
  const dy = from.y - rest.y - scale * (a.y - rest.y);
  return {
    el,
    curve,
    stretch,
    delay: span.delay,
    duration: span.duration,
    dx,
    dy,
    scale,
    angle: Math.atan2(-dy, -dx),
  };
}

/**
 * Joue l'arrivée et rend la fonction qui l'arrête. À appeler dans un
 * `useLayoutEffect` : l'état de départ est posé AVANT le premier paint, sinon
 * le hero apparaît une frame au centre, à sa taille finale, avant de sauter
 * dans le coin.
 *
 * `done` n'est appelé qu'à la fin du vol, jamais à l'arrêt.
 */
export function playHomeArrival(
  handoff: HomeReturnHandoff,
  parts: HomeArrivalParts,
  done: () => void
): () => void {
  const { logoBlock, name, photo, navItems, arrow } = parts;
  window.clearTimeout(forget);
  const all = [logoBlock, photo, ...navItems].filter(Boolean) as HTMLElement[];

  // Mesures au repos : rien ne doit traîner d'un passage précédent.
  for (const el of all) {
    el.style.transformOrigin = '50% 50%';
    el.style.transform = '';
  }

  const from = center(handoff.glyph);
  const flights: Flight[] = [];

  // Le glyph est centré en haut du bloc, plus large que lui (« PHOTOGRAPHY ») :
  // c'est le GLYPH, pas le bloc, qui doit naître sur celui de la nav-bar.
  const heroGlyph = logoBlock.querySelector('svg');
  const glyphBox = heroGlyph ? boxOf(heroGlyph) : boxOf(logoBlock);
  flights.push(
    makeFlight(
      logoBlock,
      from,
      handoff.glyph.width / glyphBox.width,
      LOGO,
      STRETCH_LOGO,
      LOGO_SPAN,
      center(glyphBox)
    )
  );

  if (photo) {
    flights.push(
      makeFlight(photo, from, PHOTO_BIRTH_SCALE, PHOTO, STRETCH_PHOTO, PHOTO_SPAN)
    );
  }

  navItems.forEach((item, i) => {
    const start = handoff.nav[i];
    if (!item) return;
    // Rangée cachée (sous `md`) d'un côté ou de l'autre : rien à faire voler.
    if (!start || item.offsetParent === null) {
      item.style.opacity = '1';
      return;
    }
    const rest = boxOf(item);
    item.style.opacity = '1';
    flights.push(
      makeFlight(item, center(start), start.width / rest.width, NAV, STRETCH_NAV, {
        delay: NAV_SPAN.delay + i * NAV_SPAN.step,
        duration: NAV_SPAN.duration,
      })
    );
  });

  // La home a mis `elapsed` à arriver : le vol prend ce qui reste du budget.
  const elapsed = (performance.now() - handoff.at) / 1000;
  const seconds = Math.min(ARRIVAL_MAX, Math.max(ARRIVAL_MIN, BUDGET - elapsed));

  const settle = () => {
    for (const el of all) {
      el.style.transform = '';
      el.style.transformOrigin = '';
    }
    if (photo) photo.style.opacity = '1';
    if (name) name.style.opacity = '';
    if (arrow) {
      arrow.style.opacity = '1';
      arrow.style.transform = '';
    }
  };

  const stop = animate(
    seconds,
    (t) => {
      for (const f of flights) {
        const p = Math.min(1, Math.max(0, (t - f.delay) / f.duration));
        f.el.style.transform = flightTransform(f, p);
      }
      if (photo) photo.style.opacity = String(smoothstep(0.07, 0.24, t));
      if (name) name.style.opacity = String(smoothstep(0.5, 0.9, t));
      if (arrow) {
        const a = smoothstep(0.72, 1, t);
        arrow.style.opacity = String(a);
        arrow.style.transform = `translateY(${(1 - a) * 6}px)`;
      }
    },
    () => {
      settle();
      pending = null;
      done();
    }
  );

  // Vol interrompu (le visiteur est reparti avant la fin) : le témoin ne doit
  // pas resservir à une arrivée venue d'ailleurs. Effacé au tour suivant et
  // non tout de suite — en dev, StrictMode arrête puis relance dans la foulée,
  // et la relance annule l'effacement.
  return () => {
    stop();
    forget = window.setTimeout(() => {
      pending = null;
    }, 0);
  };
}
