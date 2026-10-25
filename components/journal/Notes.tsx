'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { StateDot } from '@/components/site/StateDot';
import {
  EDITORIAL_SIDENOTE,
  MICRO_LABEL,
  NOTE_CALL,
} from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { DICT, DEFAULT_LANG, type Lang } from '@/lib/journal/i18n';

/**
 * NOTES D'UN ARTICLE — l'appel dans le texte, la note en marge, le tiroir
 * mobile. Un seul état partagé par l'article : la note ALLUMÉE.
 *
 * Deux sources, une priorité : le survol (passager) l'emporte sur l'épingle
 * (posée au clic). Survoler l'appel 12 allume la note 12 en marge et l'amène
 * en face de sa ligne si elle n'y est pas (repliée, ou poussée plus bas) ;
 * cliquer l'épingle là, jusqu'au clic suivant sur l'appel ou sur la note, ou
 * Échap. Sur téléphone, le clic est le seul geste, et il ouvre la note SOUS
 * le paragraphe au lieu d'envoyer le lecteur en bas de page.
 *
 * L'orange ne dit qu'une chose ici, comme partout sur le site (§4.3) : quelle
 * note est active. Aplat derrière le chiffre, voyant devant la note.
 *
 * Sans JavaScript, l'appel reste un lien vers l'entrée de bibliographie.
 */

/**
 * Deux sortes de notes. `ref` : une référence, numérotée (1, 2, 3…), qui
 * renvoie à la bibliographie. `draft` : une NOTE D'ATELIER — ce que l'auteur
 * a laissé entre crochets dans son brouillon (« [à confirmer : …] »),
 * lettrée (a, b, c…) pour ne jamais se confondre avec une source. Elles ne
 * vivent que tant que l'article est un brouillon.
 */
export type NoteKind = 'ref' | 'draft';

type NotesState = {
  /** La langue de l'article : étiquettes et noms des notes. */
  lang: Lang;
  lit: string | null;
  pinned: string | null;
  /** Notes repliées par rangée (clé : première note de la rangée). */
  folds: Folds;
  expanded: ReadonlySet<string>;
  hoverOn: (id: string, from: HoverSource) => void;
  hoverOff: () => void;
  togglePin: (id: string) => void;
  toggleFold: (row: string) => void;
};

type HoverSource = 'call' | 'note';
type Fold = { ids: string[]; top: number };
type Folds = Record<string, Fold>;

const NotesContext = createContext<NotesState | null>(null);

function useNotes(): NotesState {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('Notes: composant hors de <NotesProvider>');
  return ctx;
}

/**
 * Délai avant d'éteindre un survol : le temps d'aller de l'appel à sa note,
 * qui vient de se poser en face, sans qu'elle reparte sous le pointeur.
 */
const HOVER_GRACE = 160;

export function NotesProvider({ children, lang }: { children: ReactNode; lang: Lang }) {
  const [hover, setHover] = useState<{ id: string; from: HoverSource } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [folds, setFolds] = useState<Folds>({});
  const leave = useRef(0);
  const flowRef = useRef<HTMLDivElement>(null);
  const flow = useRef<Flow | null>(null);
  const expandedRef = useRef(expanded);
  const focusRef = useRef<string | null>(null);

  // La note MISE AU POINT — déplacée en face de son appel. L'appel survolé
  // la commande ; une fois le pointeur passé sur la note elle-même, elle
  // reste où elle est (la survoler ne doit pas la faire fuir) ; sinon,
  // l'épingle.
  const focus =
    hover?.from === 'call' ? hover.id : hover?.from === 'note' && hover.id === focusRef.current ? hover.id : pinned;

  useEffect(() => {
    flow.current = flowSidenotes(flowRef.current, expandedRef, setFolds, () => applyFocus(flowRef.current, focusRef.current));
    return () => flow.current?.dispose();
  }, []);
  useEffect(() => {
    expandedRef.current = expanded;
    flow.current?.schedule();
  }, [expanded]);
  useEffect(() => {
    focusRef.current = focus;
    applyFocus(flowRef.current, focus);
  }, [focus]);
  // Échap rend la note épinglée à sa place.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned]);
  useEffect(() => () => clearTimeout(leave.current), []);

  const value = useMemo<NotesState>(
    () => ({
      lang,
      lit: hover?.id ?? pinned,
      pinned,
      folds,
      expanded,
      hoverOn: (id, from) => {
        clearTimeout(leave.current);
        setHover({ id, from });
      },
      hoverOff: () => {
        clearTimeout(leave.current);
        leave.current = window.setTimeout(() => setHover(null), HOVER_GRACE);
      },
      togglePin: (id) => setPinned((p) => (p === id ? null : id)),
      toggleFold: (row) =>
        setExpanded((prev) => {
          const next = new Set(prev);
          if (!next.delete(row)) next.add(row);
          return next;
        }),
    }),
    [hover, pinned, folds, expanded, lang],
  );
  return (
    <NotesContext.Provider value={value}>
      <div ref={flowRef} className="contents">
        {children}
      </div>
    </NotesContext.Provider>
  );
}

/** Écart entre deux notes de marge. */
const SIDENOTE_GAP = 12;
/** Air minimal entre la dernière note et l'objet large qui suit. */
const SIDENOTE_OBSTACLE_GAP = 24;
/** Hauteur de l'étiquette « + n notes » : une ligne de note. */
const FOLD_HEIGHT = 19;
/**
 * En deçà, une note est déjà en face de son appel : la mise au point
 * l'allume sans la déplacer. Une demi-ligne de texte courant.
 */
const DISPLACE_MIN = 16;

type Flow = { schedule: () => void; dispose: () => void };

/**
 * Haut de la note alignée sur la LIGNE de son appel : la ligne se retrouve
 * par l'interligne du paragraphe (un appel en exposant déborde au-dessus de
 * sa ligne, son propre rect ne la donne pas), puis la première ligne de la
 * note est centrée sur elle.
 */
function anchorOf(note: HTMLElement): number {
  const call = document.getElementById(note.id.replace(/^sn-/, 'call-'));
  const para = call?.closest('p');
  if (!call || !para) return note.getBoundingClientRect().top;
  const line = parseFloat(getComputedStyle(para).lineHeight);
  const noteLine = parseFloat(getComputedStyle(note).lineHeight);
  const top = para.getBoundingClientRect().top;
  const r = call.getBoundingClientRect();
  const index = Math.max(0, Math.floor(((r.top + r.bottom) / 2 - top) / line));
  return top + index * line + (line - noteLine) / 2;
}

/**
 * Bord droit de ce qu'un bloc DESSINE, pas de sa boîte : un H2 court occupe
 * toute la colonne mais ne touche pas la marge, il ne doit pas y faire mur.
 */
function inkRight(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return r.width || r.height ? r.right : el.getBoundingClientRect().right;
}

/**
 * Écoulement des notes de marge (refonte 2026-10-25, demande Alexandre).
 *
 * **Le texte fixe les espacements, rien d'autre.** Avant, une pile de notes
 * qui atteignait un objet débordant dans la marge (exergue, H2) allongeait
 * la rangée d'autant : 200 px de vide entre deux paragraphes pour une note
 * longue. Désormais une rangée n'est JAMAIS rallongée par la mise en page.
 *
 * Chaque note se pose en face de la ligne de son appel, ou plus bas si la
 * précédente occupe encore la place. Sa rangée dispose de la marge jusqu'au
 * prochain appel d'une autre rangée, ou jusqu'au prochain objet qui mord
 * sur la marge. Ce qui ne tient pas se REPLIE derrière une étiquette
 * « + 2 notes · 26, 27 », posée là où la première note repliée aurait dû
 * paraître. Une note repliée reste à un survol de son appel (cf. `applyFocus`).
 *
 * Déplier est un geste du lecteur : là, et là seulement, les notes suivantes
 * descendent, et si un objet barre la marge, la rangée s'allonge — le
 * lecteur a demandé la place.
 *
 * Les notes sont positionnées par `top` ; `translate` est réservé à la mise
 * au point, qui s'anime. Rejoué à chaque changement de taille.
 */
function flowSidenotes(
  root: HTMLElement | null,
  expanded: { current: ReadonlySet<string> },
  publish: (folds: Folds) => void,
  after: () => void,
): Flow | null {
  const column = root?.firstElementChild as HTMLElement | null | undefined;
  if (!column) return null;

  let frame = 0;
  let last = '';
  const run = () => {
    const children = Array.from(column.children) as HTMLElement[];
    for (const el of children) if (el.hasAttribute('data-note-row')) el.style.paddingBottom = '';
    for (const n of column.querySelectorAll<HTMLElement>('[data-sidenote][data-folded]')) n.removeAttribute('data-folded');
    const next: Folds = {};
    const done = () => {
      const key = JSON.stringify(next);
      if (key !== last) publish(next);
      last = key;
      after();
    };
    // Sous 1100 px, la marge est cachée : rien à écouler.
    const marginLeft = Array.from(column.querySelectorAll<HTMLElement>('[data-sidenotes]'))
      .find((a) => a.offsetParent !== null)
      ?.getBoundingClientRect().left;
    if (marginLeft === undefined) return done();

    type Item = { row: HTMLElement; aside: HTMLElement; notes: HTMLElement[] } | { wall: HTMLElement };
    const items: Item[] = [];
    for (const el of children) {
      if (el.hasAttribute('data-note-row')) {
        const aside = el.querySelector<HTMLElement>('[data-sidenotes]');
        if (aside) items.push({ row: el, aside, notes: Array.from(aside.querySelectorAll<HTMLElement>('[data-sidenote]')) });
      } else if (inkRight(el) > marginLeft) {
        items.push({ wall: el });
      }
    }

    let floor = -Infinity;
    let lastRow: HTMLElement | null = null;
    items.forEach((item, k) => {
      if ('wall' in item) {
        // Seul un dépli peut encore atteindre un mur : la rangée s'allonge.
        const overlap = floor + SIDENOTE_OBSTACLE_GAP - item.wall.getBoundingClientRect().top;
        if (overlap > 0 && lastRow) lastRow.style.paddingBottom = `${overlap}px`;
        floor = -Infinity;
        lastRow = null;
        return;
      }
      const { row, aside, notes } = item;
      lastRow = row;
      const key = notes[0].id.replace(/^sn-/, '');
      const base = aside.getBoundingClientRect().top;
      const following = items[k + 1];
      const limit = !following
        ? Infinity
        : 'wall' in following
          ? following.wall.getBoundingClientRect().top - SIDENOTE_OBSTACLE_GAP
          : anchorOf(following.notes[0]) - SIDENOTE_GAP;
      const heights = notes.map((n) => n.offsetHeight);
      const anchors = notes.map(anchorOf);

      // Empile les `count` premières notes sous le plancher.
      const stack = (count: number) => {
        const tops: number[] = [];
        let y = floor;
        for (let i = 0; i < count; i++) {
          tops.push(Math.max(anchors[i], y + SIDENOTE_GAP));
          y = tops[i] + heights[i];
        }
        return { tops, bottom: y };
      };
      const all = stack(notes.length);
      let cut = notes.length;
      if (all.bottom > limit) {
        // Garder les premières notes tant qu'elles laissent la place de l'étiquette.
        cut = 0;
        while (cut < notes.length && all.tops[cut] + heights[cut] + SIDENOTE_GAP + FOLD_HEIGHT <= limit) cut++;
      }
      const open = cut < notes.length && expanded.current.has(key);
      const shown = open ? notes.length : cut;
      notes.forEach((n, i) => {
        n.style.top = `${all.tops[i] - base}px`;
      });
      if (cut === notes.length) {
        floor = all.bottom;
        return;
      }
      const kept = stack(cut);
      const foldTop = open ? all.bottom + SIDENOTE_GAP : Math.max(anchors[cut], kept.bottom + SIDENOTE_GAP);
      for (let i = shown; i < notes.length; i++) {
        notes[i].setAttribute('data-folded', '');
        // Une note repliée part de son étiquette quand on la met au point.
        notes[i].style.top = `${foldTop - base}px`;
      }
      next[key] = { ids: notes.slice(cut).map((n) => n.id.replace(/^sn-/, '')), top: foldTop - base };
      floor = foldTop + FOLD_HEIGHT;
    });
    done();
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(run);
  };
  schedule();
  document.fonts?.ready.then(schedule);
  const ro = new ResizeObserver(schedule);
  ro.observe(column);
  return {
    schedule,
    dispose: () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    },
  };
}

/**
 * MISE AU POINT d'une note : elle vient se poser en face de la ligne de son
 * appel, par-dessus ses voisines qui s'estompent. Repliée, elle sort de son
 * étiquette ; déjà en face (à `DISPLACE_MIN` près), elle s'allume sur place.
 * La rendre (`id` nul ou autre) la renvoie à sa place.
 */
function applyFocus(root: HTMLElement | null, id: string | null) {
  if (!root) return;
  for (const n of root.querySelectorAll<HTMLElement>('[data-sidenote][data-focus]')) {
    if (n.id === `sn-${id}`) continue;
    n.removeAttribute('data-focus');
    n.style.translate = '';
  }
  for (const a of root.querySelectorAll<HTMLElement>('[data-sidenotes][data-raised]')) a.removeAttribute('data-raised');
  root.removeAttribute('data-displaced');
  const note = id ? document.getElementById(`sn-${id}`) : null;
  const aside = note?.parentElement;
  if (!note || !aside || aside.offsetParent === null) return;
  const slot = aside.getBoundingClientRect().top + (parseFloat(note.style.top) || 0);
  const delta = anchorOf(note) - slot;
  note.setAttribute('data-focus', '');
  if (note.hasAttribute('data-folded') || Math.abs(delta) > DISPLACE_MIN) {
    note.style.translate = `0 ${delta}px`;
    aside.setAttribute('data-raised', '');
    root.setAttribute('data-displaced', '');
  } else {
    note.style.translate = '';
  }
}

function noteName(id: string, kind: NoteKind, lang: Lang) {
  return kind === 'draft' ? DICT[lang].workshopNote(id) : DICT[lang].note(id);
}

export function NoteCall({ id, kind, href }: { id: string; kind: NoteKind; href: string }) {
  const { lang, lit, pinned, hoverOn, hoverOff, togglePin } = useNotes();
  const n = id;
  return (
    <a
      href={href}
      id={`call-${id}`}
      aria-label={noteName(id, kind, lang)}
      aria-describedby={`sn-${id}`}
      aria-expanded={pinned === id}
      className={cn(NOTE_CALL, 'text-[var(--color-fg)] scroll-mt-24')}
      style={{
        padding: '1px 2px',
        marginLeft: -1,
        borderRadius: 1,
        backgroundColor: lit === n ? 'var(--color-active-bg)' : undefined,
      }}
      onMouseEnter={() => hoverOn(n, 'call')}
      onMouseLeave={hoverOff}
      onFocus={() => hoverOn(n, 'call')}
      onBlur={hoverOff}
      onClick={(e) => {
        e.preventDefault();
        togglePin(n);
      }}
    >
      {n}
    </a>
  );
}

export type RowNote = { id: string; kind: NoteKind; body: ReactNode };

/**
 * Seuil de la marge de notes : 680 de mesure + 48 d'écart + ~240 de marge
 * lisible + gouttières. En dessous (tablette comprise), la marge tombait à
 * 8 px à 800 de large et les références débordaient : c'est le tiroir qui
 * prend le relais, comme sur téléphone. Écrit en `min-[1100px]:` ci-dessous.
 */

/** Largeur de la colonne de chiffres en marge — le voyant, son écart, deux chiffres. */
const SIDENOTE_NUM_WIDTH = 30;

/** Courbe et durée du site (cf. TableOfContents) : la note glisse en 260 ms. */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Un paragraphe et ses notes. Au-dessus de 1100 px : grille à deux colonnes,
 * le corps à la mesure (680), les notes dans la marge droite que la colonne
 * de 1107 laisse libre, posées une à une par `flowSidenotes`. En dessous :
 * le paragraphe seul, et la note épinglée qui s'ouvre juste après lui.
 */
export function NoteRow({
  notes,
  children,
  style,
}: {
  notes: RowNote[];
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { lang, lit, pinned, folds, expanded, hoverOn, hoverOff, togglePin, toggleFold } = useNotes();
  const t = DICT[lang];
  const open = notes.find((note) => note.id === pinned);
  const key = notes[0]?.id;
  const fold = key ? folds[key] : undefined;
  const unfolded = key ? expanded.has(key) : false;

  return (
    <div
      data-note-row
      className="min-[1100px]:grid min-[1100px]:gap-x-12"
      style={{
        gridTemplateColumns: 'minmax(0, var(--editorial-measure)) minmax(0, 1fr)',
        ...style,
      }}
    >
      {children}

      {notes.length > 0 && (
        // Cellule vide qui porte les notes HORS FLUX : la rangée prend la
        // hauteur du paragraphe. La note mise au point passe au-dessus des
        // rangées suivantes (`data-raised`). Les notes débordent de leur
        // cellule : la cellule laisse passer le pointeur, sinon celle de la
        // rangée suivante capte les clics des notes dépliées.
        <div className="hidden min-[1100px]:block relative pointer-events-none">
          <aside
            data-sidenotes
            aria-label={t.notes}
            className="pointer-events-auto absolute inset-x-0 top-0 data-[raised]:z-10"
          >
            {notes.map(({ id, kind, body }) => (
              <p
                key={id}
                id={`sn-${id}`}
                data-sidenote
                className={cn(
                  EDITORIAL_SIDENOTE,
                  'absolute inset-x-0 flex bg-[var(--color-bg)]',
                  // Repliée : absente, sauf mise au point — elle sort alors
                  // en fondu (`starting:`) et y rentre de même.
                  '[&[data-folded]:not([data-focus])]:hidden [&[data-folded]:not([data-focus])]:opacity-0 starting:opacity-0',
                  // Une note mise au point hors de sa place : les autres s'effacent.
                  '[[data-displaced]_&:not([data-focus])]:opacity-25',
                  'data-[focus]:z-10 data-[focus]:shadow-[0_0_0_8px_var(--color-bg)]',
                  'motion-reduce:!transition-none',
                  lit === id && 'text-[var(--color-fg)]',
                  pinned === id && 'cursor-pointer',
                )}
                style={{
                  transition: `translate 260ms ${EASE}, opacity 200ms ${EASE}, color 200ms ${EASE}, display 200ms allow-discrete`,
                }}
                onMouseEnter={() => hoverOn(id, 'note')}
                onMouseLeave={hoverOff}
                // Cliquer la note épinglée la rend à sa place, comme l'appel.
                onClick={() => pinned === id && togglePin(id)}
              >
                {/* Colonne de chiffres calée sur la PREMIÈRE ligne de la note
                    (hauteur = un interligne) : centrée sur toute la note, le
                    voyant tombait au milieu d'une note de deux lignes. */}
                <span
                  className="flex items-center gap-[6px] shrink-0 self-start"
                  style={{ width: SIDENOTE_NUM_WIDTH, height: '1.45em' }}
                >
                  <span className="flex">
                    <StateDot on={lit === id} />
                  </span>
                  <span className="font-bold tabular-nums text-[var(--color-fg)]">{id}</span>
                </span>
                <span className="flex flex-col gap-1">
                  {kind === 'draft' && <DraftLabel lang={lang} />}
                  <span>{body}</span>
                </span>
              </p>
            ))}
            {fold && fold.ids.length > 0 && (
              // L'étiquette du pli : combien, et lesquelles — le lecteur qui
              // cherche la 27 sait qu'elle est là sans déplier.
              <button
                type="button"
                aria-expanded={unfolded}
                onClick={() => toggleFold(key!)}
                className={cn(
                  MICRO_LABEL,
                  'absolute left-0 flex items-center leading-none text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)]',
                  '[[data-displaced]_&]:opacity-25 transition-[color,opacity] duration-200 motion-reduce:transition-none',
                )}
                style={{ top: fold.top, height: FOLD_HEIGHT, paddingLeft: SIDENOTE_NUM_WIDTH }}
              >
                {unfolded ? t.foldNotes : t.foldedNotes(fold.ids)}
              </button>
            )}
          </aside>
        </div>
      )}

      {open && (
        <div
          className="min-[1100px]:hidden flex flex-col gap-2"
          style={{
            marginTop: 16,
            padding: '12px 14px 14px',
            backgroundColor: 'var(--color-bg-elev)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className={cn(MICRO_LABEL, 'flex items-center gap-[6px]')}>
              <StateDot on />
              {open.kind === 'draft' ? `${t.toDecide} (${open.id})` : t.note(open.id)}
            </span>
            <button
              type="button"
              className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
              onClick={() => togglePin(open.id)}
            >
              {t.close}
            </button>
          </div>
          <p className={cn(EDITORIAL_SIDENOTE, 'text-[var(--color-fg)]')}>{open.body}</p>
        </div>
      )}
    </div>
  );
}

/** Étiquette d'une note d'atelier — une question de l'auteur, pas une source. */
export function DraftLabel({ lang = DEFAULT_LANG }: { lang?: Lang }) {
  return <span className={cn(MICRO_LABEL, 'text-[var(--color-fg)]')}>{DICT[lang].toDecide}</span>;
}
