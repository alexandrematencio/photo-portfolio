'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { PhotoCard } from '@/components/gallery/PhotoCard';
import { PhotoLightbox } from '@/components/gallery/PhotoLightbox';
import { PHOTO_GRID_STYLE } from '@/components/series/page/SeriesPhotoGrid';
import { StateDot } from '@/components/site/StateDot';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import type { PreparedSeries } from '@/lib/site/series';
import {
  EDITORIAL_LINK_DECORATION,
  MICRO_LABEL,
  MICRO_LABEL_XS,
  PAGE_CONTROLS_GAP,
} from '@/lib/site/typography';
import { preloadImage } from '@/lib/utils/image-preload';
import { cn } from '@/lib/utils/cn';

/**
 * /work — LA CONSOLE (2026-11-15, prototype validé par Alexandre).
 *
 * Même grammaire Teenage Engineering que la console d'/archives, mais pas les
 * mêmes commandes : /work n'a ni axe de regroupement ni filtre. Chaque pont
 * reçoit donc un outil d'EXPLORATION propre à la page, au lieu d'une copie :
 *
 * - **Pont haut** (`--color-bg-plate`) : la PLANCHE CONTACT. Une vignette de
 *   couverture par collection, nom + compte. Survol souris = on PARCOURT la
 *   collection (la position du curseur choisit l'une des 8 premières photos) :
 *   on voit ce qu'il y a dedans avant de cliquer. Marque de sélection =
 *   CHÂSSIS orange autour de la vignette + `StateDot` devant le nom — la
 *   grammaire des pastilles de filtre d'/archives (le « trait de crayon » a été
 *   essayé et écarté le 2026-11-15).
 * - **Module sombre** (`--color-bg-plate-dark`) : le TRANSPORT. ◀ 03/09 ▶
 *   entre collections, et ▶ qui lance la lightbox en diaporama.
 * - **Pont bas, COLLANT** (`--color-bg-plate-low`, comme le pont des filtres
 *   d'/archives) : le SÉQUENCEUR. Une case par photo ; les cases noires sont
 *   les photos à l'écran ; survol = aperçu, clic = y aller. On sait toujours où
 *   on est (« 06–16 / 39 ») et on change de collection sans remonter.
 *
 * Contrats tenus :
 * - Lightbox = CAROUSEL de la collection affichée, UNE instance, état ici
 *   (CLAUDE.md §3.4).
 * - Sous `md`, la planche est une bande qui DÉFILE (jamais une rangée qui
 *   wrappe) : des images, pas des boutons — exception à `ListSelector`
 *   arbitrée par Alexandre le 2026-11-15.
 * - Paddings en style inline (le reset `* { padding: 0 }` avale les utilities).
 * - L'adresse suit la collection (`#slug`, en `replaceState` : changer
 *   d'onglet n'empile pas d'historique).
 * - Un survol qui suit un défilement n'est pas une intention : rien ne se
 *   précharge (règle de `lib/utils/image-preload.ts`).
 */

/** Photos parcourues au survol d'une vignette. */
const SKIM_MAX = 8;
/** Au-delà, les cartes sont hors champ : rien à mettre en scène. */
const ENTRANCE_MAX = 12;
/** Un survol arrivé moins de 250 ms après un défilement n'est pas un geste. */
const SCROLL_QUIET_MS = 250;

const thumbUrl = (p: Photo, w: number, h: number) =>
  (p.image && urlFor(p.image)?.width(w).height(h).fit('crop').quality(70).auto('format').url()) || null;
const peekUrl = (p: Photo) =>
  (p.image && urlFor(p.image)?.width(192).quality(70).auto('format').url()) || null;

const pad2 = (n: number) => String(n).padStart(2, '0');
const motionAllowed = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
const scrollContainerOf = (el: Element | null) =>
  el?.closest<HTMLElement>('[data-scroll-container]') ?? null;

/** « 2020–2026 · Paris, Djerba +4 » — années et villes, DÉDUITES des photos. */
function collectionPlaces(photos: Photo[]): string {
  const years = photos.map((p) => p.year).filter((y): y is number => Number.isFinite(y));
  const span = years.length
    ? Math.min(...years) === Math.max(...years)
      ? String(years[0])
      : `${Math.min(...years)}–${Math.max(...years)}`
    : '';
  const cities = [
    ...new Set(photos.map((p) => p.location?.split(',')[0]?.trim()).filter(Boolean)),
  ] as string[];
  const where =
    cities.length <= 2 ? cities.join(', ') : `${cities.slice(0, 2).join(', ')} +${cities.length - 2}`;
  return [span, where].filter(Boolean).join(' · ');
}

// ─── Icônes du transport (triangles pleins, à la façon d'une touche) ─────────
const Tri = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 10 10" width={10} height={10} aria-hidden fill="currentColor">
    <path d={dir === 'left' ? 'M7 1 2.5 5 7 9z' : 'M3 1 7.5 5 3 9z'} />
  </svg>
);

export function WorkGallery({ collections }: { collections: PreparedSeries[] }) {
  const [active, setActive] = useState(0);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [lightbox, setLightbox] = useState<{ index: number; autoplay: boolean } | null>(null);
  const [peek, setPeek] = useState<{ k: number; left: number } | null>(null);

  const stripRef = useRef<HTMLDivElement>(null);
  const deckTopRef = useRef<HTMLDivElement>(null);
  const deckLowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastScrollRef = useRef(0);
  const lastLightboxIndex = useRef(0);
  const animateNext = useRef(false);

  const collection = collections[active] ?? collections[0];

  // Collection demandée par l'adresse — lue au montage (export statique : le
  // HTML servi montre toujours la première).
  useEffect(() => {
    // Un fragment mal encodé (`#%E0`) lève URIError : on reste sur la première.
    let slug = '';
    try {
      slug = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const i = collections.findIndex((c) => c.slug === slug);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique de l'URL au montage
    if (i > 0) setActive(i);
  }, [collections]);

  // Horodatage du dernier défilement, où qu'il ait lieu (le conteneur de
  // scroll n'est pas `window` : capture sur le document).
  useEffect(() => {
    const onScroll = () => {
      lastScrollRef.current = performance.now();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  const select = useCallback(
    (i: number) => {
      const n = collections.length;
      const next = ((i % n) + n) % n;
      if (next === active) return;
      animateNext.current = true;
      setActive(next);
      setPeek(null);
      window.history.replaceState(window.history.state, '', `#${collections[next].slug}`);
      // Grille déjà sous les yeux : on se recale sur son début, sous le pont bas.
      const panel = panelRef.current;
      const deck = deckLowRef.current;
      const container = scrollContainerOf(panel);
      if (panel && deck && container) {
        const delta = panel.getBoundingClientRect().top - deck.getBoundingClientRect().bottom;
        if (delta < 0) container.scrollTop += delta;
      }
    },
    [active, collections]
  );

  // La vignette active reste dans la bande (bande qui défile sous `md`, ou
  // planche trop large pour l'écran).
  useEffect(() => {
    const strip = stripRef.current;
    const el = frameRefs.current[active];
    if (!strip || !el) return;
    const margin = 32;
    const left = el.offsetLeft - strip.scrollLeft;
    if (left < margin || left + el.offsetWidth > strip.clientWidth - margin) {
      strip.scrollTo({ left: el.offsetLeft - margin, behavior: motionAllowed() ? 'smooth' : 'auto' });
    }
  }, [active]);

  // Séquenceur : quelles photos sont à l'écran, SOUS le pont bas collant.
  // Une PLAGE continue (min–max) : des cartes de hauteurs inégales laisseraient
  // des trous dans la rangée, que l'œil lirait comme une panne.
  useEffect(() => {
    const grid = gridRef.current;
    const deck = deckLowRef.current;
    if (!grid || !deck) return;
    const top = (scrollContainerOf(deck)?.getBoundingClientRect().top ?? 0) + deck.offsetHeight;
    const seen = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const k = Number((e.target as HTMLElement).dataset.k);
          if (e.isIntersecting) seen.add(k);
          else seen.delete(k);
        }
        setRange(seen.size ? [Math.min(...seen), Math.max(...seen)] : null);
      },
      { rootMargin: `-${Math.round(top)}px 0px 0px 0px` }
    );
    for (const el of grid.children) io.observe(el);
    return () => io.disconnect();
  }, [active]);

  // Entrée de la grille au changement de collection — fondu + 16 px, 40 ms de
  // décalage (CLAUDE.md §3.2). Jamais au chargement, jamais en mouvement réduit.
  useEffect(() => {
    if (!animateNext.current) return;
    animateNext.current = false;
    if (!motionAllowed() || !gridRef.current) return;
    [...gridRef.current.children].slice(0, ENTRANCE_MAX).forEach((el, k) => {
      el.animate(
        [
          { opacity: 0, transform: 'translateY(16px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 450, delay: k * 40, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' }
      );
    });
  }, [active]);

  const goToPhoto = (k: number) => {
    gridRef.current?.children[k]?.scrollIntoView({
      block: 'start',
      behavior: motionAllowed() ? 'smooth' : 'auto',
    });
  };

  const backToSheet = () => {
    deckTopRef.current?.scrollIntoView({ block: 'center', behavior: motionAllowed() ? 'smooth' : 'auto' });
  };

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    // La grille reprend là où l'œil s'est arrêté (diaporama compris).
    const k = lastLightboxIndex.current;
    requestAnimationFrame(() => gridRef.current?.children[k]?.scrollIntoView({ block: 'center' }));
  }, []);

  const onTabKey = (e: ReactKeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: collections.length - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    const n = collections.length;
    const next = ((map[e.key] % n) + n) % n;
    select(next);
    frameRefs.current[next]?.focus();
  };

  if (!collection) return null;
  const n = collection.photos.length;
  const position = range
    ? `${pad2(range[0] + 1)}${range[1] !== range[0] ? `–${pad2(range[1] + 1)}` : ''}`
    : null;

  // UNE racine : `PageShell` pose son `gap` entre chacun de ses enfants.
  return (
    <div>
      {/* ══ Pont haut : planche contact + module de transport ══ */}
      <div
        ref={deckTopRef}
        className="flex flex-col md:flex-row md:items-stretch bg-[var(--color-bg-plate)]"
      >
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Collection"
          onKeyDown={onTabKey}
          className="flex min-w-0 flex-1 gap-6 md:gap-4 overflow-x-auto snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            padding: '22px var(--page-gutter) 16px',
            scrollPaddingInline: 'var(--page-gutter)',
          }}
        >
          {collections.map((c, i) => (
            <ContactFrame
              key={c._id}
              ref={(el) => {
                frameRefs.current[i] = el;
              }}
              collection={c}
              selected={i === active}
              onSelect={() => select(i)}
              lastScrollRef={lastScrollRef}
            />
          ))}
        </div>

        <div
          role="group"
          aria-label="Transport"
          className="flex flex-none items-center justify-between md:justify-center gap-4 bg-[var(--color-bg-plate-dark)]"
          style={{ padding: '8px var(--page-gutter)' }}
        >
          <div className="flex md:flex-col items-center gap-2.5 md:gap-2">
            <span className={cn(MICRO_LABEL_XS, 'text-[var(--color-fg-muted-dark)]')}>Collection</span>
            <div className="flex items-center gap-1">
              <Disc label="Previous collection" onClick={() => select(active - 1)}>
                <Tri dir="left" />
              </Disc>
              <span
                className={cn(MICRO_LABEL, 'text-[12px] text-[var(--color-bg)] text-center')}
                style={{ minWidth: 52 }}
                aria-live="polite"
              >
                {pad2(active + 1)}
                <span className="font-medium text-[var(--color-fg-muted-dark)]"> / {pad2(collections.length)}</span>
              </span>
              <Disc label="Next collection" onClick={() => select(active + 1)}>
                <Tri dir="right" />
              </Disc>
            </div>
          </div>
          <div className="flex md:flex-col items-center gap-2.5 md:gap-2">
            <span className={cn(MICRO_LABEL_XS, 'text-[var(--color-fg-muted-dark)]')}>Slideshow</span>
            <Disc
              label={`Play ${collection.title} as a slideshow`}
              onClick={() => setLightbox({ index: range ? range[0] : 0, autoplay: true })}
            >
              <svg viewBox="0 0 10 10" width={10} height={10} aria-hidden fill="currentColor">
                <path d="M2.5 1 9 5 2.5 9z" />
              </svg>
            </Disc>
          </div>
        </div>
      </div>

      {/* ══ Pont bas, collant : séquenceur ══
          Fond OPAQUE : il passe par-dessus la grille au défilement. */}
      <div
        ref={deckLowRef}
        className={cn(
          MICRO_LABEL,
          'sticky top-0 z-30 flex flex-wrap md:flex-nowrap items-center gap-x-5 gap-y-2 bg-[var(--color-bg-plate-low)] text-[var(--color-fg-muted-plate-low)]'
        )}
        style={{ padding: '10px var(--page-gutter) 12px' }}
      >
        <div className="flex w-full md:w-auto flex-none items-center gap-0.5">
          <Chevron label="Previous collection" onClick={() => select(active - 1)} dir="left" />
          <button
            type="button"
            onClick={backToSheet}
            title="Back to the contact sheet"
            className="flex-1 md:flex-none text-left uppercase text-[var(--color-fg)] cursor-pointer hover:underline underline-offset-[3px] md:min-w-[170px]"
            style={{ paddingInline: 4 }}
          >
            {collection.title}
          </button>
          <span className="md:hidden tabular-nums" style={{ marginRight: 8 }}>
            {position && <b className="text-[var(--color-fg)]">{position}</b>} {position ? '/' : ''} {pad2(n)}
          </span>
          <Chevron label="Next collection" onClick={() => select(active + 1)} dir="right" />
        </div>

        <div aria-hidden className="relative flex min-w-0 flex-1 basis-full md:basis-0 items-stretch gap-0.5 h-3 md:h-4">
          {collection.photos.map((p, k) => {
            const lit = range !== null && k >= range[0] && k <= range[1];
            return (
              <button
                key={p._id}
                type="button"
                tabIndex={-1}
                onClick={() => goToPhoto(k)}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'mouse') return;
                  const el = e.currentTarget;
                  setPeek({ k, left: el.offsetLeft + el.offsetWidth / 2 });
                }}
                onPointerLeave={() => setPeek(null)}
                className={cn(
                  'flex-1 basis-0 max-w-[22px] min-w-0 border cursor-pointer transition-colors motion-reduce:transition-none',
                  lit
                    ? 'bg-[var(--color-fg)] border-[var(--color-fg)]'
                    : 'border-[var(--color-line-plate-low)] hover:border-[var(--color-fg)]'
                )}
                style={{ borderRadius: 1 }}
              />
            );
          })}
          {peek && collection.photos[peek.k] && peekUrl(collection.photos[peek.k]) && (
            <span
              className="absolute pointer-events-none bg-[var(--color-bg)]"
              style={{
                top: 'calc(100% + 10px)',
                left: peek.left,
                width: 104,
                padding: 4,
                transform: 'translateX(-50%)',
                boxShadow: '0 1px 0 var(--color-line-plate-low)',
              }}
            >
              <Image
                src={peekUrl(collection.photos[peek.k])!}
                alt=""
                width={192}
                height={Math.round(192 / (collection.photos[peek.k].image?.dimensions?.aspectRatio ?? 1.5))}
                className="block w-full h-auto"
              />
            </span>
          )}
        </div>

        <span className="hidden md:flex flex-none gap-4 whitespace-nowrap tabular-nums">
          <span>
            {position && <b className="text-[var(--color-fg)]">{position}</b>} {position ? '/' : ''} {pad2(n)}
          </span>
          <span>{collectionPlaces(collection.photos)}</span>
        </span>
      </div>

      {/* ══ Grille ══ — `paddingTop` = moitié basse du contrat `controlBand`. */}
      <section
        ref={panelRef}
        role="tabpanel"
        aria-label={collection.title}
        style={{ paddingInline: 'var(--page-gutter)', paddingTop: PAGE_CONTROLS_GAP }}
      >
        <p className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')} style={{ marginBottom: 24 }}>
          {n} photo{n === 1 ? '' : 's'} ·{' '}
          <Link href={`/series/${collection.slug}`} className={EDITORIAL_LINK_DECORATION}>
            About this collection
          </Link>
        </p>
        <div ref={gridRef} key={collection._id} style={PHOTO_GRID_STYLE}>
          {collection.photos.map((p, k) => (
            // `scroll-margin` : un clic du séquenceur pose la photo SOUS le pont collant.
            <div key={p._id} data-k={k} style={{ scrollMarginTop: 72 }}>
              <PhotoCard photo={p} onOpen={() => setLightbox({ index: k, autoplay: false })} />
            </div>
          ))}
        </div>
      </section>

      {lightbox && (
        <PhotoLightbox
          key={collection._id}
          photos={collection.photos}
          initialIndex={lightbox.index}
          onClose={closeLightbox}
          slideshow
          autoplay={lightbox.autoplay}
          onIndexChange={(i) => {
            lastLightboxIndex.current = i;
          }}
        />
      )}
    </div>
  );
}

// ─── Vignette de la planche ──────────────────────────────────────────────────

type FrameProps = {
  collection: PreparedSeries;
  selected: boolean;
  onSelect: () => void;
  lastScrollRef: RefObject<number>;
  ref: (el: HTMLButtonElement | null) => void;
};

function ContactFrame({ collection: c, selected, onSelect, lastScrollRef, ref }: FrameProps) {
  const skimPhotos = c.photos.slice(0, SKIM_MAX);
  const [armed, setArmed] = useState(false);
  const [skim, setSkim] = useState<number | null>(null);
  const shown = skim !== null ? skimPhotos[skim] : c.cover;
  const src = thumbUrl(shown, 208, 140);

  // `timeStamp` de l'évènement : même horloge que `performance.now()`.
  const arm = (pointerType: string, at: number) => {
    if (pointerType !== 'mouse' || armed) return;
    if (at - (lastScrollRef.current ?? 0) < SCROLL_QUIET_MS) return;
    for (const p of skimPhotos) {
      const u = thumbUrl(p, 208, 140);
      if (u) void preloadImage(u, 'high');
    }
    setArmed(true);
  };

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      aria-label={`${c.title}, ${c.photos.length} photos`}
      onClick={onSelect}
      onPointerEnter={(e) => arm(e.pointerType, e.timeStamp)}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        if (!armed) return arm(e.pointerType, e.timeStamp);
        const thumb = e.currentTarget.firstElementChild as HTMLElement | null;
        if (!thumb) return;
        const r = thumb.getBoundingClientRect();
        if (e.clientY > r.bottom + 8) return; // sur le nom : on garde l'image courante
        const k = Math.max(
          0,
          Math.min(skimPhotos.length - 1, Math.floor(((e.clientX - r.left) / r.width) * skimPhotos.length))
        );
        if (k !== skim) setSkim(k);
      }}
      onPointerLeave={() => setSkim(null)}
      className="group relative flex-none snap-start text-left cursor-pointer w-[96px] md:w-[104px]"
    >
      <span className="relative block w-[96px] h-[64px] md:w-[104px] md:h-[70px] overflow-hidden bg-[var(--color-bg-plate-low)]">
        {src && (
          <Image src={src} alt="" width={208} height={140} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {/* Châssis : toujours rendu, seule la couleur bascule (la marque ne
            change jamais la taille du contrôle). */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 border-2 transition-colors motion-reduce:transition-none',
            selected ? 'border-[var(--color-link)]' : 'border-transparent'
          )}
        />
      </span>

      {/* Jauge du parcours au survol — en encre, pas en orange : la position
          d'un survol n'est pas un état. */}
      <span
        aria-hidden
        className={cn(
          'flex gap-0.5 h-0.5 transition-opacity motion-reduce:transition-none',
          skim !== null ? 'opacity-100' : 'opacity-0'
        )}
        style={{ marginTop: 5 }}
      >
        {skimPhotos.map((p, k) => (
          <i
            key={p._id}
            className={cn('flex-1', k === skim ? 'bg-[var(--color-fg)]' : 'bg-[var(--color-bg-plate-low)]')}
          />
        ))}
      </span>

      <span
        className={cn(
          MICRO_LABEL,
          'relative block leading-[1.25] transition-colors motion-reduce:transition-none',
          selected
            ? 'text-[var(--color-fg)]'
            : 'text-[var(--color-fg-muted-plate)] group-hover:text-[var(--color-fg)]'
        )}
        style={{ marginTop: 6, minHeight: '2.5em' }}
      >
        {/* Voyant dans la gouttière entre deux vignettes : il n'entre pas dans
            le flux du nom, qui reste aligné sur l'image. */}
        <span className="absolute flex" style={{ left: -12, top: 3 }}>
          <StateDot on={selected} />
        </span>
        {c.title} <span className="font-medium">{c.photos.length}</span>
      </span>
    </button>
  );
}

// ─── Touches ─────────────────────────────────────────────────────────────────

/** Touche ronde du module sombre — la forme des boutons de densité d'/archives. */
function Disc({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ width: 44, height: 44, borderRadius: '50%' }}
      className="inline-flex items-center justify-center cursor-pointer text-[var(--color-fg-muted-dark)] hover:text-[var(--color-bg)] transition-colors motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}

function Chevron({ label, onClick, dir }: { label: string; onClick: () => void; dir: 'left' | 'right' }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ width: 28, height: 28 }}
      className="inline-flex flex-none items-center justify-center cursor-pointer text-[var(--color-fg-muted-plate-low)] hover:text-[var(--color-fg)] transition-colors motion-reduce:transition-none"
    >
      <Tri dir={dir} />
    </button>
  );
}
