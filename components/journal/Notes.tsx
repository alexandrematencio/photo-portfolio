'use client';

import {
  createContext,
  useContext,
  useMemo,
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
 * (posée au clic). Survoler l'appel 12 allume la note 12 en marge, et
 * inversement ; cliquer l'épingle — sur téléphone, c'est le seul geste, et
 * il ouvre la note SOUS le paragraphe au lieu d'envoyer le lecteur en bas
 * de page puis de l'obliger à remonter.
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
  setHover: (id: string | null) => void;
  togglePin: (id: string) => void;
};

const NotesContext = createContext<NotesState | null>(null);

function useNotes(): NotesState {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('Notes: composant hors de <NotesProvider>');
  return ctx;
}

export function NotesProvider({ children, lang }: { children: ReactNode; lang: Lang }) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const value = useMemo<NotesState>(
    () => ({
      lang,
      lit: hover ?? pinned,
      pinned,
      setHover,
      togglePin: (id) => setPinned((p) => (p === id ? null : id)),
    }),
    [hover, pinned, lang],
  );
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

function noteName(id: string, kind: NoteKind, lang: Lang) {
  return kind === 'draft' ? DICT[lang].workshopNote(id) : DICT[lang].note(id);
}

export function NoteCall({ id, kind, href }: { id: string; kind: NoteKind; href: string }) {
  const { lang, lit, pinned, setHover, togglePin } = useNotes();
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
      onMouseEnter={() => setHover(n)}
      onMouseLeave={() => setHover(null)}
      onFocus={() => setHover(n)}
      onBlur={() => setHover(null)}
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

/**
 * Un paragraphe et ses notes. Au-dessus de 1100 px : grille à deux colonnes,
 * le corps à la mesure (680), les notes dans la marge droite que la colonne
 * de 1107 laisse libre. En dessous : le paragraphe seul, et la note épinglée
 * qui s'ouvre juste après lui.
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
  const { lang, lit, pinned, setHover, togglePin } = useNotes();
  const t = DICT[lang];
  const open = notes.find((note) => note.id === pinned);

  return (
    <div
      className="min-[1100px]:grid min-[1100px]:gap-x-12"
      style={{
        gridTemplateColumns: 'minmax(0, var(--editorial-measure)) minmax(0, 1fr)',
        ...style,
      }}
    >
      {children}

      {notes.length > 0 && (
        <aside aria-label={t.notes} className="hidden min-[1100px]:flex flex-col gap-3" style={{ paddingTop: 5 }}>
          {notes.map(({ id, kind, body }) => (
            <p
              key={id}
              id={`sn-${id}`}
              className={cn(
                EDITORIAL_SIDENOTE,
                'flex transition-colors motion-reduce:transition-none',
                lit === id && 'text-[var(--color-fg)]',
              )}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
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
        </aside>
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
