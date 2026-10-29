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
import { useDrawOnArrival } from '@/components/journal/Highlight';
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
 * Accès : la marque dans la marge gauche (survol, focus), la pastille en bas
 * d'écran, la touche `M`. Échap ferme. Le dessin (Sigma) n'est chargé qu'à la
 * première ouverture, et seulement dès 768 px — sur téléphone, le panneau
 * seul.
 *
 * Arrivée depuis /concept-map (`#p-<clé>`) : la thèse du passage est déjà la
 * thèse courante, le panneau fermé l'attend.
 */

const Graph = dynamic(() => import('./ConceptMapGraph'), { ssr: false });

/** Le nœud se pose dans le tiers gauche du dessin : son libellé part à droite et doit y tenir. */
const GRAPH_LABEL_ROOM = 200;

/** Nom provisoire de la vue — à Alexandre de le choisir. */
export const ARTICLE_MAP_LABEL = 'Concept Map';

type Ctx = { openAt: (id: string) => void; reading: string | null; lang: Lang };
const ArticleMapContext = createContext<Ctx | null>(null);

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
      reading,
      lang: view.lang,
      openAt: (id) => {
        pick(id);
        show(true);
      },
    }),
    [reading, pick, show, view.lang],
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

  const at = shown ? theses.indexOf(shown) : -1;
  const step = (d: number) => {
    const next = theses[at + d];
    if (next) pick(next);
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

  const readingNode = reading ? ix.byId.get(reading) : null;

  return (
    <ArticleMapContext.Provider value={ctx}>
      {children}

      {/* La pastille : la thèse en cours, un toucher ouvre le panneau. */}
      <button
        type="button"
        onClick={() => {
          setPicked(null);
          show(true);
        }}
        data-shown={readingNode && !open ? '' : undefined}
        aria-hidden={!readingNode || open}
        tabIndex={readingNode && !open ? 0 : -1}
        className="article-map-pill flex items-center gap-3 border border-[var(--color-line)] bg-[var(--color-bg-raised)] text-left shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        style={{ borderRadius: CONTROL_RADIUS, padding: '10px 14px' }}
      >
        <MapGlyph />
        <span className="flex min-w-0 flex-col">
          <span className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}>
            {ARTICLE_MAP_LABEL}
            {reading && ` · ${theses.indexOf(reading) + 1}/${theses.length}`}
          </span>
          <span className="truncate text-[14px] font-bold leading-[1.3] text-[var(--color-fg)]">
            {readingNode && frenchSpaces(readingNode.label)}
          </span>
        </span>
        <kbd
          aria-hidden
          className={cn(MICRO_LABEL, 'hidden flex-none border border-[var(--color-line)] text-[var(--color-fg-muted)] [@media(hover:hover)]:inline-block')}
          style={{ padding: '1px 5px', borderRadius: CONTROL_RADIUS }}
        >
          M
        </kbd>
      </button>

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
              {picked ? (
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

/**
 * La marque dans la marge gauche d'un paragraphe couvert par une thèse :
 * visible au survol du paragraphe ou au focus ; à demi, en permanence, sur
 * le paragraphe de la thèse en cours. Seul le paragraphe de la citation porte un vrai bouton nommé ; sur
 * les suivants, la marque sert la souris et se tait pour le lecteur d'écran
 * (une annonce par paragraphe noierait le texte). Sur écran tactile : rien,
 * la pastille fait ce travail (CSS `.map-mark`).
 */
export function MapMark({ id, label, anchor }: { id: string; label: string; anchor: boolean }) {
  const ctx = useContext(ArticleMapContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.openAt(id)}
      data-current={anchor && ctx.reading === id ? '' : undefined}
      aria-label={anchor ? DICT[ctx.lang].map.mark(label) : undefined}
      aria-hidden={anchor ? undefined : true}
      tabIndex={anchor ? undefined : -1}
      title={label}
      className="map-mark items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)]"
    >
      <MapGlyph />
    </button>
  );
}

/**
 * LE SOULIGNÉ D'UNE CITATION (2026-10-29, demande Alexandre) — la phrase du
 * texte qu'une thèse ou un mécanisme de la carte cite (`quote`). La pastille
 * dit « thèse 3/7 : … » ; le pointillé montre DANS le texte d'où elle vient.
 * Même geste que le surligné jaune (`Highlight`, même déclencheur, même
 * courbe) mais en retrait : un pointillé gris clair, qui ne concurrence ni
 * le jaune ni les liens. La citation de la thèse en cours — celle de la
 * pastille — fonce d'un cran (`data-current`). CSS : `.journal-concept`.
 */
export function ConceptQuote({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(ArticleMapContext);
  const ref = useDrawOnArrival<HTMLSpanElement>();
  return (
    <span ref={ref} className="journal-concept" data-current={ctx?.reading === id ? '' : undefined}>
      {children}
    </span>
  );
}
