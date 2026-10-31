'use client';

import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { StateDot } from '@/components/site/StateDot';
import { CONTROL_RADIUS } from '@/lib/site/controls';
import { frenchSpaces } from '@/lib/journal/french';
import { conceptMapPath, DICT, type Lang } from '@/lib/journal/i18n';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { MapView } from '@/lib/journal/conceptMapData';
import { HASH_KEY, indexMap } from './model';
import { MapPanel, ReadLink } from './MapPanel';

/**
 * LA CONCEPT MAP DANS L'ARTICLE (phase 4 bis,
 * docs/superpowers/plans/2026-10-28-journal-map.md). L'article emporte sa part
 * de la carte (`articleMapView`) : ses thèses, leurs mécanismes, et les
 * passages des autres articles qui emploient les mêmes.
 *
 * Où en est la lecture : la thèse dont un paragraphe (`covers`) croise la
 * ligne de lecture, aux 35 % de l'écran. Un IntersectionObserver sur une
 * bande d'un pour cent, aucun écouteur `scroll` : entre deux paragraphes
 * (figure, intertitre), la thèse d'avant reste.
 *
 * Le panneau est fermé par défaut et ne pousse jamais le texte : tiroir à
 * droite dès 1280 px (il recouvre la marge des notes tant qu'il est ouvert —
 * il n'y a pas d'autre place), feuille montante en dessous. Ouvert, il SUIT
 * la lecture ; choisir un autre nœud le détache, « Revenir au passage lu »
 * le raccroche.
 *
 * Accès : la citation soulignée (un clic), sa marque dans la marge droite,
 * les pastilles en haut d'écran, la touche `M`. Échap ferme. Le dessin (Sigma) n'est chargé qu'à la
 * première ouverture, et seulement dès 768 px — sur téléphone, le panneau
 * seul.
 *
 * Arrivée depuis /concept-map (`#p-<clé>`) : la thèse du passage est déjà la
 * thèse courante, le panneau fermé l'attend.
 */

const Graph = dynamic(() => import('./ConceptMapGraph'), { ssr: false });

/** Le nœud se pose dans le tiers gauche du dessin : son libellé part à droite et doit y tenir. */
const GRAPH_LABEL_ROOM = 200;

/** La barre du site (`SiteHeader`, h-16) : ce qu'elle couvre n'est pas à l'écran. */
const SITE_HEADER = 64;

/**
 * Le haut de la pile (2026-10-31, demande Alexandre) : 16 px sous le chapô
 * tant qu'il est à l'écran — il court sur toute la largeur du titre, la pile
 * ne doit pas le couvrir, et une citation peut y être dès l'arrivée — puis
 * 16 px sous la barre du site, une fois le chapô passé.
 */
const PILLS_GAP = 16;

/** Écart entre le texte et la colonne des notes (`NoteRow`, `gap-x-12`). */
const NOTES_GAP = 48;

/** Nom provisoire de la vue — à Alexandre de le choisir. */
export const ARTICLE_MAP_LABEL = 'Concept Map';

/**
 * LES CITATIONS À L'ÉCRAN (2026-10-29, demande Alexandre) : un seul état
 * commande le pointillé (`ConceptQuote`), la marque de marge
 * (`ConceptMarks`) et la pastille. Une citation est « à l'écran » dès
 * qu'une partie passe sous la barre du site ; deux à l'écran, deux pastilles,
 * dans l'ordre de lecture.
 */
type Ctx = {
  openAt: (id: string) => void;
  visible: ReadonlySet<string>;
  lang: Lang;
  /** La citation désignée par le pointeur (ou le focus), où qu'il soit : texte, pastille ou marque. */
  hot: string | null;
  setHot: (id: string | null) => void;
};
const ArticleMapContext = createContext<Ctx | null>(null);

/**
 * LE SURVOL CROISÉ (2026-10-31, demande Alexandre) : la citation, sa
 * pastille et sa marque se désignent l'une l'autre. Souris seulement — au
 * doigt, un `pointerenter` précède le clic et resterait collé.
 */
const hoverProps = (ctx: Ctx, id: string) => ({
  onPointerEnter: (e: { pointerType: string }) => e.pointerType === 'mouse' && ctx.setHot(id),
  onPointerLeave: () => ctx.setHot(null),
});

const editable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function ArticleMap({ view, children }: { view: MapView; children: ReactNode }) {
  const ix = useMemo(() => indexMap(view), [view]);
  // L'article est nommé dans la carte par son adresse française, quelle que soit la langue de la page.
  const articleId = view.article ?? '';
  const t = DICT[view.lang];
  const theses = useMemo(() => ix.thesesOfArticle.get(articleId) ?? [], [ix, articleId]);
  const thesisOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of theses) for (const k of ix.byId.get(t)?.covers ?? []) m.set(k, t);
    return m;
  }, [ix, theses]);
  const all = useMemo(() => new Set(view.nodes.map((n) => n.id)), [view]);

  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  /** Un nœud choisi à la main ; `null` : le panneau suit la lecture. */
  const [picked, setPicked] = useState<string | null>(null);
  const [center, setCenter] = useState(0);
  const [wide, setWide] = useState(false);
  const [drawn, setDrawn] = useState(false);
  /** Les citations soulignées, dans l'ordre du texte, et celles qui sont à l'écran. */
  const [order, setOrder] = useState<string[]>([]);
  const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set());
  const [hot, setHot] = useState<string | null>(null);
  /** La colonne des notes, dès qu'elle existe (1100 px) : les pastilles s'y rangent. */
  const [rail, setRail] = useState<{ left: number; width: number } | null>(null);
  const pills = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLParagraphElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const shown = picked ?? reading ?? theses[0] ?? null;

  // Où en est la lecture.
  useEffect(() => {
    const fromHash = window.location.hash.match(/^#p-(.+)$/);
    if (fromHash && thesisOf.has(fromHash[1])) setReading(thesisOf.get(fromHash[1])!);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).at(-1);
        const id = hit && thesisOf.get((hit.target as HTMLElement).id.slice(2));
        if (id) setReading(id);
      },
      { rootMargin: '-35% 0px -64% 0px' },
    );
    for (const k of thesisOf.keys()) {
      const el = document.getElementById(`p-${k}`);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [thesisOf]);

  // Les citations à l'écran. Une citation coupée en plusieurs morceaux est
  // à l'écran dès que l'un d'eux l'est.
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.journal-concept[data-concept]')];
    setOrder([...new Set(els.map((el) => el.dataset.concept!))]);
    const seen = new Set<HTMLElement>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? seen.add(e.target as HTMLElement) : seen.delete(e.target as HTMLElement);
        setVisible(new Set([...seen].map((el) => el.dataset.concept!)));
      },
      { rootMargin: `-${SITE_HEADER}px 0px 0px 0px` },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [view]);

  // Les pastilles dans la colonne des notes : même bord gauche, même largeur.
  useEffect(() => {
    const row = document.querySelector<HTMLElement>('[data-note-row]');
    if (!row) return;
    const mq = window.matchMedia('(min-width: 1100px)');
    const measure = () => {
      const text = row.firstElementChild?.getBoundingClientRect();
      if (!mq.matches || !text) return setRail(null);
      const left = Math.round(text.right + NOTES_GAP);
      setRail({ left, width: Math.round(row.getBoundingClientRect().right) - left });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Sous le chapô, puis sous la barre. Écrit à même le style, une fois par
  // image : le suivre au défilement ne doit rien rendre. Sur téléphone, la
  // pile est en bas (CSS) : on rend la main.
  useEffect(() => {
    const el = pills.current;
    if (!el) return;
    const lead = document.querySelector<HTMLElement>('[data-lead]');
    const mq = window.matchMedia('(min-width: 768px)');
    let frame = 0;
    const place = () => {
      frame = 0;
      el.style.top = mq.matches ? `${Math.round(Math.max(SITE_HEADER, lead?.getBoundingClientRect().bottom ?? 0)) + PILLS_GAP}px` : '';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    // En capture : la page défile dans sa colonne, pas dans `window`.
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Le centre du dessin glisse vers le nœud montré, sans rien reconstruire.
  useEffect(() => {
    if (open && shown) setCenter((c) => c + 1);
  }, [open, shown]);

  const show = useCallback((next: boolean) => {
    if (next) {
      returnTo.current = document.activeElement as HTMLElement | null;
      setDrawn(true);
      setOpen(true);
      // Après la peinture : un élément encore `inert` ne prend pas le focus.
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    } else {
      setOpen(false);
      if (panel.current?.contains(document.activeElement)) returnTo.current?.focus({ preventScroll: true });
    }
  }, []);

  const pick = useCallback((id: string) => setPicked(id === reading ? null : id), [reading]);

  const ctx = useMemo<Ctx>(
    () => ({
      visible,
      lang: view.lang,
      hot,
      setHot,
      openAt: (id) => {
        pick(id);
        show(true);
      },
    }),
    [visible, pick, show, view.lang, hot],
  );

  // `M` ouvre et ferme, Échap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        show(!open);
      } else if (e.key === 'Escape' && open) show(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, show]);

  /**
   * ← → mènent la lecture elle-même : l'article défile jusqu'à la citation de
   * la thèse suivante (ou précédente), posée dans la bande où l'observateur de
   * lecture regarde (35 % de la hauteur). Pendant le trajet, le panneau tient
   * la thèse visée ; quand la lecture l'atteint, il se raccroche à elle.
   */
  const [travel, setTravel] = useState<string | null>(null);
  useEffect(() => {
    if (travel && reading === travel) {
      setTravel(null);
      setPicked(null);
    }
  }, [reading, travel]);
  // Le lecteur reprend la main en cours de route : le trajet s'abandonne, le
  // panneau garde la thèse visée et propose de revenir au passage lu.
  useEffect(() => {
    if (!travel) return;
    const cancel = () => setTravel(null);
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    return () => {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
    };
  }, [travel]);

  const at = shown ? theses.indexOf(shown) : -1;
  const step = (d: number) => {
    const next = theses[at + d];
    if (!next) return;
    pick(next);
    setTravel(null);
    const covers = ix.byId.get(next)?.covers ?? [];
    const el =
      document.querySelector<HTMLElement>(`.journal-concept[data-concept="${CSS.escape(next)}"]`) ??
      (covers[0] ? document.getElementById(`p-${covers[0]}`) : null);
    if (!el) return;
    setTravel(next);
    const line = Math.min(el.getBoundingClientRect().height, 24);
    el.style.scrollMarginTop = `${Math.round(window.innerHeight * 0.355 - line / 2)}px`;
    el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.style.scrollMarginTop = '';
  };
  const onPanelKey = (e: ReactKeyboardEvent) => {
    if (editable(e.target) || at < 0) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      step(e.key === 'ArrowLeft' ? -1 : 1);
    }
  };

  /**
   * Un passage de CET article : on laisse le navigateur suivre l'ancre, pour
   * que `hashchange` réveille `PassageArrival` (la navigation de Next passe
   * par `pushState`, qui ne le déclenche pas). La feuille se referme : le
   * lecteur veut voir le paragraphe. Le panneau se raccroche à la lecture.
   */
  const onPanelClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.origin !== window.location.origin || a.pathname !== window.location.pathname || !a.hash) return;
    e.preventDefault();
    setPicked(null);
    if (!window.matchMedia('(min-width: 1280px)').matches) show(false);
    if (window.location.hash === a.hash) {
      document.getElementById(decodeURIComponent(a.hash.slice(1)))?.scrollIntoView({ block: 'start' });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else window.location.hash = a.hash;
  };

  return (
    <ArticleMapContext.Provider value={ctx}>
      {children}

      {/* Les pastilles, en haut : une par citation à l'écran, dans l'ordre de
          lecture ; un toucher ouvre le panneau sur elle. Toutes montées,
          repliées tant qu'elles sont hors champ (CSS `.article-map-slot`). */}
      <div
        ref={pills}
        className="article-map-pills"
        data-hot={hot && !open && visible.has(hot) ? '' : undefined}
        style={rail ? { left: rail.left, width: rail.width, right: 'auto' } : undefined}
      >
        {order.map((id) => {
          const node = ix.byId.get(id);
          const on = !open && visible.has(id);
          if (!node) return null;
          const n = theses.indexOf(id);
          return (
            <div key={id} className="article-map-slot" data-shown={on ? '' : undefined} data-hot={hot === id ? '' : undefined}>
              <div>
                <button
                  type="button"
                  onClick={() => ctx.openAt(id)}
                  {...hoverProps(ctx, id)}
                  onFocus={() => setHot(id)}
                  onBlur={() => setHot(null)}
                  aria-hidden={!on}
                  tabIndex={on ? 0 : -1}
                  className="article-map-pill flex items-center gap-3 border border-[var(--color-line)] bg-[var(--color-bg-raised)] text-left shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  style={{ borderRadius: CONTROL_RADIUS, padding: '10px 14px' }}
                >
                  <span className="article-map-pill-kicker flex text-[var(--color-fg-muted)]">
                    <MapGlyph />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={cn(MICRO_LABEL, 'article-map-pill-kicker text-[var(--color-fg-muted)]')}>
                      {ARTICLE_MAP_LABEL} · {n >= 0 ? `${n + 1}/${theses.length}` : t.map.mechanism}
                    </span>
                    <span className="truncate text-[14px] font-bold leading-[1.3] text-[var(--color-fg)]">{frenchSpaces(node.label)}</span>
                  </span>
                  <kbd
                    aria-hidden
                    className={cn(MICRO_LABEL, 'hidden flex-none border border-[var(--color-line)] text-[var(--color-fg-muted)] [@media(hover:hover)]:inline-block')}
                    style={{ padding: '1px 5px', borderRadius: CONTROL_RADIUS }}
                  >
                    M
                  </kbd>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <aside
        ref={panel}
        aria-label={ARTICLE_MAP_LABEL}
        inert={!open}
        data-open={open ? '' : undefined}
        onKeyDown={onPanelKey}
        onClickCapture={onPanelClick}
        className="article-map flex flex-col overflow-y-auto border-[var(--color-line)] bg-[var(--color-bg-raised)] shadow-[0_-1px_3px_rgba(0,0,0,0.08)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--color-line)] bg-[var(--color-bg-raised)]" style={{ padding: '14px 20px' }}>
          <p ref={heading} tabIndex={-1} className={cn(MICRO_LABEL, 'flex items-center gap-2 text-[var(--color-fg)] outline-none')}>
            <MapGlyph />
            {ARTICLE_MAP_LABEL}
          </p>
          <button
            type="button"
            onClick={() => show(false)}
            aria-label={t.close}
            className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)] motion-reduce:transition-none"
            style={{ padding: 4 }}
          >
            <svg aria-hidden width={12} height={12} viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        {drawn && wide && (
          <div aria-hidden className="concept-stage relative flex-none border-b border-[var(--color-line)] bg-[var(--color-bg)]" style={{ height: 240 }}>
            <Graph ix={ix} visible={all} selected={shown} center={center} zoom={0.3} inset={GRAPH_LABEL_ROOM} onSelect={(id) => id && pick(id)} />
          </div>
        )}

        <div className="flex flex-col gap-5" style={{ padding: 20 }}>
          {at >= 0 && (
            <div className="flex items-center justify-between gap-3">
              <StepButton disabled={at === 0} onClick={() => step(-1)} label={t.map.previous}>
                ←
              </StepButton>
              {picked && picked !== travel ? (
                <button type="button" onClick={() => setPicked(null)} className={cn(MICRO_LABEL, 'flex items-center gap-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')}>
                  <StateDot on={false} />
                  {t.map.backToReading}
                </button>
              ) : (
                <span className={cn(MICRO_LABEL, 'flex items-center gap-2 text-[var(--color-fg)]')}>
                  <StateDot on />
                  {t.map.following}
                </span>
              )}
              <StepButton disabled={at === theses.length - 1} onClick={() => step(1)} label={t.map.next}>
                →
              </StepButton>
            </div>
          )}
          {at < 0 && picked && (
            <button type="button" onClick={() => setPicked(null)} className={cn(MICRO_LABEL, 'flex w-fit items-center gap-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]')}>
              ← {t.map.backToReading}
            </button>
          )}
          {shown && <MapPanel ix={ix} id={shown} onSelect={pick} />}
          {shown && (
            <div className="border-t border-[var(--color-line)]" style={{ paddingTop: 16 }}>
              <ReadLink href={`${conceptMapPath(view.lang)}#${HASH_KEY}=${encodeURIComponent(shown)}`}>{t.map.openFull}</ReadLink>
            </div>
          )}
        </div>
      </aside>
    </ArticleMapContext.Provider>
  );
}

function StepButton({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-[15px] font-bold text-[var(--color-fg)] transition-colors disabled:text-[var(--color-fg-faint)] motion-reduce:transition-none"
      style={{ padding: '2px 6px' }}
    >
      {children}
    </button>
  );
}

/** Trois nœuds reliés : la carte, en 14 px. */
function MapGlyph() {
  return (
    <svg aria-hidden width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} className="flex-none">
      <path d="M4.5 7.5 10 3.5M4.5 7.5l5.5 3" />
      <circle cx={3.5} cy={7.5} r={2} fill="currentColor" stroke="none" />
      <circle cx={10.5} cy={3} r={1.6} />
      <circle cx={10.5} cy={11} r={1.6} />
    </svg>
  );
}

/** Écart entre deux marques qui tomberaient sur la même ligne. */
const MARK_STEP = 16;

/**
 * LES MARQUES DANS LA MARGE DROITE (2026-10-29, demande Alexandre) — une par
 * citation soulignée du paragraphe, en face du début de sa PREMIÈRE ligne,
 * dans la gouttière qui sépare le texte des notes. Une citation coupée en
 * plusieurs morceaux (une autre citation au milieu, ou plus tard des
 * passages dans d'autres paragraphes) : un filet relie la marque à chaque
 * morceau, une branche par morceau — c'est le même concept. Mesuré sur le
 * texte rendu, remesuré quand le paragraphe change de taille (police,
 * largeur, note dépliée). Visible avec son pointillé, donc avec sa pastille.
 * Sur écran tactile : rien, la pastille fait ce travail (CSS `.concept-mark`).
 */
export function ConceptMarks({ items }: { items: { id: string; label: string }[] }) {
  const ctx = useContext(ArticleMapContext);
  const box = useRef<HTMLSpanElement>(null);
  const [placed, setPlaced] = useState<{ id: string; label: string; x: number; ys: number[] }[]>([]);
  const key = items.map((i) => i.id).join(' ');

  useEffect(() => {
    const p = box.current?.parentElement;
    if (!p) return;
    const measure = () => {
      const top = p.getBoundingClientRect().top;
      const rows: number[] = [];
      setPlaced(
        items.flatMap(({ id, label }) => {
          // Le milieu de la première ligne de chaque morceau ; les 3 px du bas
          // portent le pointillé (`.journal-concept`).
          const ys = [...document.querySelectorAll<HTMLElement>(`.journal-concept[data-concept="${CSS.escape(id)}"]`)]
            .map((el) => [...el.getClientRects()].find((r) => r.width > 0))
            .filter((r): r is DOMRect => Boolean(r))
            .map((r) => Math.round(r.top - top + (r.height - 3) / 2));
          if (!ys.length) return [];
          const lines = [...new Set(ys)].sort((a, b) => a - b);
          const x = rows.filter((y) => Math.abs(y - lines[0]) < 12).length * MARK_STEP;
          rows.push(lines[0]);
          return [{ id, label, x, ys: lines }];
        }),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(p);
    return () => ro.disconnect();
    // `items` change d'identité à chaque rendu ; ses ids, non.
  }, [key]);

  if (!ctx) return null;
  return (
    <span ref={box} className="concept-marks">
      {placed.map(({ id, label, x, ys }) => {
        const span = ys.at(-1)! - ys[0];
        return (
          <span key={id} className="concept-mark" data-on={ctx.visible.has(id) ? '' : undefined} data-hot={ctx.hot === id ? '' : undefined}>
            {ys.length > 1 && (
              <svg aria-hidden className="concept-mark-branches" width={12} height={span + 1} style={{ top: ys[0] }}>
                <path d={`M8.5 0.5V${span + 0.5}${ys.map((y) => `M0 ${y - ys[0] + 0.5}H8.5`).join('')}M8.5 0.5H12`} />
              </svg>
            )}
            <button
              type="button"
              onClick={() => ctx.openAt(id)}
              {...hoverProps(ctx, id)}
              aria-label={DICT[ctx.lang].map.mark(label)}
              title={label}
              className="concept-mark-button items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)]"
              style={{ top: ys[0] - 7, left: 16 + x }}
            >
              <MapGlyph />
            </button>
          </span>
        );
      })}
    </span>
  );
}

/**
 * LE SOULIGNÉ D'UNE CITATION (2026-10-29, demande Alexandre) — la phrase du
 * texte qu'une thèse ou un mécanisme de la carte cite (`quote`). Le
 * pointillé gris clair se trace quand la citation entre à l'écran, en même
 * temps que sa pastille paraît en haut : le lecteur voit à quoi la pastille
 * renvoie. Hors champ, il se retire. Un clic ouvre la carte sur elle — sauf
 * sur un lien ou un appel de note qu'elle contient, ou au bout d'une
 * sélection de texte. Au survol, une ombre de gris (opacité −25 %), et sa
 * pastille s'allume ; survoler la pastille ou la marque l'allume à son tour.
 * CSS : `.journal-concept`.
 */
export function ConceptQuote({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(ArticleMapContext);
  const onClick = (e: MouseEvent<HTMLSpanElement>) => {
    if (!ctx || (e.target as HTMLElement).closest('a, button') || !window.getSelection()?.isCollapsed) return;
    ctx.openAt(id);
  };
  return (
    <span
      className="journal-concept"
      data-concept={id}
      data-on={ctx?.visible.has(id) ? '' : undefined}
      data-hot={ctx?.hot === id ? '' : undefined}
      onClick={ctx ? onClick : undefined}
      {...(ctx && hoverProps(ctx, id))}
    >
      {children}
    </span>
  );
}
