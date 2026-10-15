/**
 * Transitions de page latérales — la page qui part, la page qui arrive.
 *
 * Trois chemins s'en servent :
 *   - le retour à la home par le logo (`home-return.ts`) : le corps de page
 *     part à DROITE, la home naît sur le logo ;
 *   - un clic dans la nav-bar d'une page vers une autre (`SiteHeader`) : la
 *     page courante sort d'un côté, la nouvelle entre de l'autre ;
 *   - un clic dans le menu du hero de la home (`HomeHero`) : le hero monte en
 *     nav-bar (le scroll-morph joué tout seul), puis la nouvelle page entre par
 *     la droite en poussant la photo vers la gauche.
 *
 * LE SENS suit l'ordre de `NAV_LINKS`, la home comptant pour « avant Series » :
 * aller plus loin dans le menu fait entrer la page par la droite, revenir en
 * arrière la fait entrer par la gauche. Une page hors menu (/legal…) compte
 * comme la home.
 *
 * Les deux moitiés ne se parlent que par `pending` : un module, pas un
 * contexte React — la page de départ est démontée avant que l'autre existe.
 * La moitié ARRIVÉE est jouée par `<PageArrival />` (layout du groupe (site)),
 * SAUF sur /series : son entrée existante (le train, `entrance.ts`) EST déjà
 * une arrivée latérale, on lui donne seulement le sens — la durée n'est pas
 * rallongée (demande Alexandre, 2026-10-15).
 *
 * Mouvement réduit : rien ne part d'ici, la navigation reste instantanée
 * (CLAUDE.md §3.2).
 */

import { animate, rubberCurve, type RubberCurve } from '@/lib/motion/rubber';
import { NAV_LINKS, isSamePage } from './nav';
import { ACTIVE_FILL_PADDING } from './controls';

// ─── Réglages ──────────────────────────────────────────────────────────────

/** Sortie du corps de page. */
export const EXIT_DURATION = 0.64;
/** Trajet en largeurs d'écran : au-delà de 1, le contenu sort encore lancé et
    son freinage se passe hors champ. */
const EXIT_TRAVEL = 1.12;
/** Cisaillement maximal du contenu poussé, en degrés. Le bord d'où vient la
    poussée part devant, l'autre traîne. */
const SKEW = 2.2;
/** Entrée de la nouvelle page : même durée que la sortie, les deux corps
    restent bord à bord. */
const ENTER_DURATION = 0.64;

/** `prompt` : le contenu RÉPOND au clic, 100 ms d'immobilité se liraient
    comme un retard (cf. `lib/motion/rubber.ts`). */
export const CONTENT: RubberCurve = rubberCurve({
  lead: 0.7,
  stiffness: 420,
  damping: 30,
  onset: 'prompt',
});

/** Au-delà, le témoin ne vaut plus rien (navigation jamais arrivée). */
const HANDOFF_TTL_MS = 10_000;

// ─── Géométrie ─────────────────────────────────────────────────────────────

export type Box = { left: number; top: number; width: number; height: number };

export function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** La boîte du TEXTE d'un lien : l'item actif porte un padding (son fond
    plein), le libellé du hero n'en a pas. */
export function contentBoxOf(el: HTMLElement): Box {
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

/**
 * La nav-bar TELLE QU'ELLE SERA sur la page `activeHref` : glyph et texte de
 * chaque libellé. Mesurée sur le vrai `SiteHeader`, même sur la home où il est
 * masqué — on le rend le temps d'une lecture synchrone, sans peinture.
 *
 * C'est ce qui corrige l'écart de 5 à 15 px noté le 2026-10-02 entre
 * l'atterrissage du scroll-morph et la nav-bar des autres pages : il ne venait
 * que du surlignage de la page courante (padding de l'item actif, qui décale
 * toute la rangée en `space-between`). Le morph vise une barre sans item
 * actif, juste pour la home ; une page de destination en a toujours un.
 */
export function measureNavBar(activeHref: string): { glyph: Box; nav: Box[] } | null {
  const header = document.querySelector<HTMLElement>('header[data-top-bar]');
  const glyph = header?.querySelector('nav > a svg');
  if (!header || !glyph) return null;
  const links = Array.from(header.querySelectorAll<HTMLElement>('[data-nav-link]'));
  const active = NAV_LINKS.findIndex((l) => isSamePage(l.href, activeHref));

  const display = header.style.display;
  const visibility = header.style.visibility;
  header.style.display = 'block';
  header.style.visibility = 'hidden';
  // Sur la home, aucun lien n'est actif : on pose le surlignage de la
  // destination le temps de la mesure, avec la valeur même de `SiteHeader`.
  const target = active >= 0 ? links[active] : null;
  const padding = target?.style.padding ?? '';
  if (target) target.style.padding = ACTIVE_FILL_PADDING;
  const out = { glyph: boxOf(glyph), nav: links.map(contentBoxOf) };
  if (target) target.style.padding = padding;
  header.style.display = display;
  header.style.visibility = visibility;
  return out;
}

// ─── Sens ──────────────────────────────────────────────────────────────────

/** Côté par lequel ENTRE la nouvelle page : 1 = droite, -1 = gauche. */
export type Side = 1 | -1;

function rank(path: string): number {
  return NAV_LINKS.findIndex((l) => isSamePage(l.href, path));
}

export function sideFor(from: string, to: string): Side {
  return rank(to) > rank(from) ? 1 : -1;
}

// ─── Passage de témoin ─────────────────────────────────────────────────────

export type PageArrival = {
  at: number;
  /** Chemin de destination. */
  to: string;
  side: Side;
  /** Appelés au commit de la page d'arrivée (la photo du hero part alors). */
  onArrive: (() => void)[];
};

let pending: PageArrival | null = null;
let forget = 0;

/**
 * Lecture SANS consommation (StrictMode rejoue les effets). `path` : le
 * témoin ne vaut que pour la page qu'il annonce.
 */
export function peekPageArrival(path?: string): PageArrival | null {
  if (pending && performance.now() - pending.at > HANDOFF_TTL_MS) pending = null;
  if (pending && path !== undefined && !isSamePage(pending.to, path)) return null;
  return pending;
}

export function announcePageArrival(to: string, side: Side): PageArrival {
  window.clearTimeout(forget);
  pending = { at: performance.now(), to, side, onArrive: [] };
  return pending;
}

/** Une copie du corps de page est en train de sortir. */
let exiting = false;
export const isExiting = () => exiting;

// ─── Moitié DÉPART ─────────────────────────────────────────────────────────

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Clic dans la nav-bar d'une page vers une autre. À appeler dans le `onClick`,
 * SANS annuler la navigation : la page suivante se charge pendant que
 * celle-ci s'en va.
 */
export function beginPageLeave(href: string): void {
  if (reduced() || exiting) return;
  const from = location.pathname;
  if (isSamePage(href, from)) return;
  const side = sideFor(from, href);
  announcePageArrival(href, side);
  const page = document.querySelector<HTMLElement>('[data-scroll-container]');
  if (page) pushAway(page, side === 1 ? -1 : 1);
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

/**
 * Copie figée de `el`, posée sur `<body>` à l'endroit exact de l'original.
 *
 * ⚠️ Ce qui glisse est toujours une COPIE : l'original est démonté par le
 * routeur à un instant qu'on ne choisit pas, et disparaîtrait d'un coup en
 * plein mouvement.
 */
export function ghostOf(el: HTMLElement, zIndex: number): HTMLElement {
  const rect = el.getBoundingClientRect();
  const ghost = el.cloneNode(true) as HTMLElement;
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
    margin: '0',
    zIndex: String(zIndex),
    pointerEvents: 'none',
    transition: 'none',
    transform: 'none',
    opacity: '1',
    visibility: 'visible',
    transformOrigin: '0 0',
    willChange: 'transform',
  });
  document.body.appendChild(ghost);
  copyScroll(el, ghost);
  return ghost;
}

/**
 * Fait glisser `ghost` hors de l'écran vers `toward` (1 = droite) puis le
 * retire. Rend l'arrêt.
 */
export function slideOut(ghost: HTMLElement, toward: Side, done?: () => void): () => void {
  const travel = window.innerWidth * EXIT_TRAVEL * toward;
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    stop();
    ghost.remove();
    done?.();
  };
  const stop = animate(
    EXIT_DURATION,
    (p) => {
      const skew = -toward * SKEW * CONTENT.strain(p);
      ghost.style.transform = `translate3d(${travel * CONTENT.at(p)}px, 0, 0) skewX(${skew}deg)`;
    },
    remove
  );
  // Filet qui ne dépend PAS de l'horloge d'animation (onglet en arrière-plan :
  // rAF gelé). La copie ne reste jamais à l'écran.
  window.setTimeout(remove, EXIT_DURATION * 1000 + 400);
  return remove;
}

/**
 * Pousse le corps de page hors de l'écran vers `toward`. L'original est
 * masqué tout de suite ; c'est la page d'arrivée qui le rend.
 *
 * `onAbandon` : la navigation n'est pas arrivée là où on l'attendait (clic
 * ailleurs pendant la sortie, ou jamais partie).
 */
export function pushAway(page: HTMLElement, toward: Side, onAbandon?: () => void): void {
  const ghost = ghostOf(page, 20);
  page.style.visibility = 'hidden';
  exiting = true;
  slideOut(ghost, toward, () => {
    exiting = false;
  });

  // L'original masqué est rendu par la page d'arrivée (`PageArrival`, ou le
  // démontage pour la home). Filet : si l'URL a changé alors qu'il est
  // toujours masqué, ou au bout du délai si la navigation n'a jamais eu lieu.
  const from = location.pathname;
  const born = performance.now();
  const watch = window.setInterval(() => {
    const expired = performance.now() - born > HANDOFF_TTL_MS;
    if (page.isConnected && (location.pathname !== from || expired)) {
      if (page.style.visibility === 'hidden') {
        page.style.visibility = '';
        onAbandon?.();
      }
    }
    if (!page.isConnected || page.style.visibility === '') window.clearInterval(watch);
  }, 200);
}

// ─── Moitié ARRIVÉE ────────────────────────────────────────────────────────

/**
 * Joue l'arrivée de la page `pathname`. À appeler dans un `useLayoutEffect`
 * déclenché par le changement de route : l'état de départ (hors écran) est
 * posé AVANT le premier paint. Rend l'arrêt.
 */
export function playPageArrival(arrival: PageArrival, pathname: string): () => void {
  window.clearTimeout(forget);
  for (const f of arrival.onArrive) f();
  arrival.onArrive = [];

  const page = document.querySelector<HTMLElement>('[data-scroll-container]');
  const clear = () => {
    pending = null;
  };
  if (!page) {
    clear();
    return () => {};
  }
  page.style.visibility = '';

  // /series joue SA propre entrée (le train), dans le sens qu'on lui a
  // laissé : faire glisser le conteneur en plus doublerait le mouvement.
  if (isSamePage('/series', pathname) || reduced()) {
    // Effacé au tour suivant : le `useLayoutEffect` de la page l'a déjà lu.
    forget = window.setTimeout(clear, 0);
    return () => {};
  }

  const travel = window.innerWidth * arrival.side;
  page.style.transformOrigin = '0 0';
  const settle = () => {
    page.style.transform = '';
    page.style.transformOrigin = '';
  };
  const stop = animate(
    ENTER_DURATION,
    (p) => {
      const q = CONTENT.at(p);
      const skew = arrival.side * SKEW * CONTENT.strain(p);
      page.style.transform =
        p >= 1 ? '' : `translate3d(${travel * (1 - q)}px, 0, 0) skewX(${skew}deg)`;
    },
    () => {
      settle();
      clear();
    }
  );
  // Vol interrompu (StrictMode, ou nouvelle navigation) : repos immédiat,
  // témoin effacé au tour suivant — une relance immédiate l'annule.
  return () => {
    stop();
    settle();
    forget = window.setTimeout(clear, 0);
  };
}
