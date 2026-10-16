import gsap from 'gsap';

/**
 * RÉVÉLATION DE TEXTE — l'effet 3 de la démo Codrops « ScrollBlurTypography »
 * (github.com/codrops/ScrollBlurTypography, `js/effect-3/blurScrollEffect.js`),
 * déplacé du scroll vers le CHARGEMENT, et retourné pour du noir sur blanc.
 *
 * Ce qui vient de la démo, à ne pas retoucher au goût sans le dire : chaque
 * caractère part écrasé (`scaleY 0.1`), étiré (`scaleX 1.8`), flou (10 px) et
 * éteint à moitié, puis reprend sa forme sans easing propre (`ease: 'none'`).
 * Un caractère s'anime sur DIX pas de caractère (`stagger 0.05` pour une durée
 * de 0.5) : c'est ce ratio qui donne le dégradé de netteté le long de la ligne.
 *
 * L'inversion : la démo écrit `brightness(50%)` — du texte BLANC à mi-chemin du
 * fond noir. Sur du texte noir, `brightness` ne fait rien (noir × n = noir) ;
 * le même mi-chemin vers le fond, c'est `opacity 0.5`.
 *
 * Ce qui change par rapport à la démo (demande Alexandre, 2026-10-16) :
 *   - au chargement, le texte se révèle jusqu'à `HORIZON_BAND` au-dessus du bas
 *     de l'écran — tout ce qui est plus bas reste flou ;
 *   - la ligne qui suit la dernière ligne nette montre déjà `HINT_WORDS` mots
 *     nets : la promesse qu'il y a de la suite ;
 *   - le défilement repousse ce front, mais ne le fait JAMAIS reculer : un
 *     texte lu ne se re-brouille pas en remontant.
 *
 * Le front est UN nombre, `t`, compté en caractères : le caractère `i` est net
 * quand `t ≥ i + TAIL`, intact quand `t ≤ i`. Tout l'état tient là-dedans.
 */

/** Durée d'animation d'un caractère, en pas de caractère (démo : 0.5 / 0.05). */
const TAIL = 10;
/** Bande floue au-dessus de l'horizon : 2 cm, en px CSS (96 px par pouce). */
const HORIZON_BAND = (2 / 2.54) * 96;
/** Mots déjà nets sur la première ligne encore floue. */
const HINT_WORDS = 3;
/**
 * Vitesse du front au chargement, en caractères par seconde, CONSTANTE
 * (`ease: 'none'`, comme le scrub de la démo) : la page se lit ligne après
 * ligne, ~0,25 s par ligne de courant. Une durée fixe avec un easing de
 * sortie avalait les premières lignes d'un coup — lu comme une apparition en
 * bloc (Alexandre, 2026-10-16).
 */
const LOAD_RATE = 280;
/** Lissage du front quand le défilement le repousse (l'équivalent du `scrub`). */
const SCROLL_DURATION = 0.6;

const FROM = { scaleX: 1.8, scaleY: 0.1, blur: 10, opacity: 0.5 };

/**
 * Ce qui s'anime d'un bloc sans être découpé : une image (le logo AAXLO), un
 * SVG, ou un nœud que React met à jour après le montage (`ProtectedEmail`
 * assemble son libellé côté client — un nœud texte qu'on aurait remplacé
 * recevrait la mise à jour hors du document, en silence).
 */
const ATOMIC = 'img, svg, [data-reveal-atomic]';
/** Jamais découpé, jamais animé : texte invisible ou non rendu. */
const SKIP = '.sr-only, noscript, style, script';

type Unit = { el: HTMLElement; word: number };
type Line = { first: number; last: number; bottom: number };

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
/** Par GRAPHÈME, pas par point de code : un drapeau 🇫🇷 en fait deux. */
const graphemes = (s: string) =>
  segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s);

/**
 * Remplace chaque nœud texte par sa version découpée — mots insécables, un
 * `inline-block` par caractère (un `inline` ignore `transform`). Le texte
 * d'origine reste lisible des lecteurs d'écran dans un `.sr-only` voisin : un
 * mot découpé en vingt boîtes s'épelle lettre à lettre dans VoiceOver.
 *
 * Rend la défaite : les nœuds d'ORIGINE reprennent leur place, ceux que React
 * connaît, pas des copies.
 */
function split(root: HTMLElement): { units: Unit[]; undo: () => void } {
  const units: Unit[] = [];
  const restores: (() => void)[] = [];
  let word = 0;

  // Un atomique est animé entier : rien de ce qu'il contient n'est retenu.
  const insideAtomic = (node: Node) => {
    const host = node.parentElement?.closest(ATOMIC);
    return Boolean(host && root.contains(host));
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node instanceof Element) {
        if (node.matches(SKIP)) return NodeFilter.FILTER_REJECT;
        return node.matches(ATOMIC) && !insideAtomic(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
      return node.nodeValue?.trim() && !insideAtomic(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  const nodes: Node[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);

  for (const node of nodes) {
    if (node instanceof Element) {
      node.classList.add('tr-u');
      units.push({ el: node as HTMLElement, word: word++ });
      restores.push(() => node.classList.remove('tr-u'));
      continue;
    }
    const text = node.nodeValue ?? '';
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        // Le blanc reste du TEXTE : c'est lui qui porte les coupures de ligne
        // et les retours de `whitespace-pre-line`.
        visual.append(part);
        continue;
      }
      const w = document.createElement('span');
      w.className = 'tr-w';
      for (const g of graphemes(part)) {
        const c = document.createElement('span');
        c.className = 'tr-u';
        c.textContent = g;
        w.append(c);
        units.push({ el: c, word });
      }
      visual.append(w);
      word++;
    }
    const spoken = document.createElement('span');
    spoken.className = 'sr-only';
    spoken.textContent = text;
    node.parentNode!.replaceChild(spoken, node);
    spoken.before(visual);
    restores.push(() => {
      visual.remove();
      spoken.replaceWith(node);
    });
  }

  return { units, undo: () => restores.reverse().forEach((r) => r()) };
}

/**
 * Lignes VISUELLES, dans l'ordre de lecture. Mesurées au CENTRE de chaque
 * boîte : `scale` part du centre, et l'entrée latérale de la page ne fait que
 * translater et cisailler en x — le centre vertical ne bouge sous aucun des
 * deux. La hauteur vient d'`offsetHeight`, que les transforms ne touchent pas.
 */
function measureLines(units: Unit[], scroller: HTMLElement): Line[] {
  const origin = scroller.getBoundingClientRect().top - scroller.scrollTop;
  const lines: Line[] = [];
  let cy = -Infinity;
  units.forEach(({ el }, i) => {
    const r = el.getBoundingClientRect();
    const h = el.offsetHeight || r.height;
    const center = (r.top + r.bottom) / 2 - origin;
    const line = lines[lines.length - 1];
    if (!line || Math.abs(center - cy) > h / 2) {
      lines.push({ first: i, last: i, bottom: center + h / 2 });
      cy = center;
    } else {
      line.last = i;
      line.bottom = Math.max(line.bottom, center + h / 2);
    }
  });
  return lines;
}

/** Où doit être le front pour la position de défilement courante. */
function frontFor(units: Unit[], lines: Line[], scroller: HTMLElement): number {
  const horizon = scroller.scrollTop + scroller.clientHeight - HORIZON_BAND;
  const next = lines.find((l) => l.bottom > horizon);
  if (!next) return units.length - 1 + TAIL;
  // Les premiers mots de la ligne suivante. Jamais la ligne entière : le
  // signe qu'il reste à lire, c'est précisément ce qui reste flou après eux.
  const words: number[] = [];
  for (let i = next.first; i <= next.last; i++) {
    if (words[words.length - 1] !== units[i].word) words.push(units[i].word);
  }
  const shown = Math.max(1, Math.min(HINT_WORDS, words.length - 1));
  const lastWord = words[shown - 1];
  let end = next.first;
  while (end + 1 < units.length && units[end + 1].word <= lastWord) end++;
  return end + TAIL;
}

function paint(el: HTMLElement, p: number) {
  if (p >= 1) {
    el.style.transform = el.style.filter = el.style.opacity = '';
    el.classList.add('tr-on');
    return;
  }
  const sx = FROM.scaleX + (1 - FROM.scaleX) * p;
  const sy = FROM.scaleY + (1 - FROM.scaleY) * p;
  el.style.transform = `scale(${sx}, ${sy})`;
  el.style.filter = `blur(${FROM.blur * (1 - p)}px)`;
  el.style.opacity = String(FROM.opacity + (1 - FROM.opacity) * p);
}

export type TextRevealOptions = {
  /** Attente avant la révélation du chargement (l'entrée latérale de la page). */
  delay?: number;
};

/**
 * Découpe `root`, pose l'état de départ et lance la révélation. `scroller` est
 * l'élément qui défile (`[data-scroll-container]` hors home). Rend l'arrêt, qui
 * remet le texte d'origine en place.
 */
export function attachTextReveal(
  root: HTMLElement,
  scroller: HTMLElement,
  { delay = 0 }: TextRevealOptions = {}
): () => void {
  const { units, undo } = split(root);
  let lines = measureLines(units, scroller);

  const state = { t: 0 };
  let target = 0;
  /** Tout ce qui est avant `settled` est net et nettoyé : on n'y revient plus. */
  let settled = 0;

  const render = () => {
    const t = state.t;
    for (let i = settled; i < units.length && i < t; i++) {
      const p = Math.min(1, (t - i) / TAIL);
      paint(units[i].el, p);
      if (p >= 1 && i === settled) settled++;
    }
  };

  const advance = (duration: number | null, ease: string, wait = 0) => {
    const next = frontFor(units, lines, scroller);
    if (next <= target) return;
    target = next;
    gsap.to(state, {
      t: target,
      duration: duration ?? (target - state.t) / LOAD_RATE,
      delay: wait,
      ease,
      overwrite: true,
      onUpdate: render,
    });
  };

  advance(null, 'none', delay);

  let frame = 0;
  const onScroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => advance(SCROLL_DURATION, 'power2.out'));
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  // La largeur change, les lignes aussi : on re-mesure, le front ne recule pas.
  let width = root.clientWidth;
  const resize = new ResizeObserver(() => {
    if (root.clientWidth === width) return;
    width = root.clientWidth;
    lines = measureLines(units, scroller);
    onScroll();
  });
  resize.observe(root);

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    scroller.removeEventListener('scroll', onScroll);
    gsap.killTweensOf(state);
    for (const { el } of units) {
      el.style.transform = el.style.filter = el.style.opacity = '';
      el.classList.remove('tr-on');
    }
    undo();
  };
}
