import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@sanity/ui';
import { ImageIcon, StarIcon } from '@sanity/icons';
import { useClient } from 'sanity';
import { IntentLink } from 'sanity/router';

import { reorderCuration } from '../lib/curationOrder';
import type { ThumbFn } from './search/SearchCard';

const API_VERSION = '2026-01-01';
/** Côté d'une vignette de la carte, en px. */
const TILE = 84;
/** Déplacement du pointeur (px) avant qu'un appui devienne un glisser. */
const DRAG_THRESHOLD = 6;
/** Délai entre le dernier ← / → au clavier et l'enregistrement. */
const KEYBOARD_COMMIT_DELAY = 700;

export type CurationEntry = {
  _id: string;
  title: string;
  slug: string;
  image?: { asset?: { _ref: string } };
};

type DragState = {
  id: string;
  pointerId: number;
  el: HTMLElement;
  startX: number;
  startY: number;
  /** Où le pointeur a saisi la vignette, pour que le fantôme ne saute pas. */
  grabX: number;
  grabY: number;
  /** Passe à vrai une fois le seuil franchi : avant, c'est un simple clic. */
  active: boolean;
  /** Cases de la grille, mesurées au départ du glisser — elles ne bougent pas. */
  slots: DOMRect[];
};

function ids(entries: CurationEntry[]): string {
  return entries.map((e) => e._id).join('|');
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * La case la plus proche du pointeur, ou `null` s'il s'en est trop éloigné
 * (au-delà d'une case et quelque : on ne saute pas au hasard).
 */
function slotAt(slots: DOMRect[], x: number, y: number): number | null {
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  slots.forEach((r, i) => {
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best !== null && bestDistance < TILE * 1.2 ? best : null;
}

/**
 * « La curation (home) » : la home telle qu'elle sortira, dans l'ordre — et
 * l'ordre se change ICI, au glisser-déposer (ou ← / → au clavier sur une
 * vignette), sans passer par le formulaire des Réglages du site
 * (skill sanity-studio §11.20).
 *
 * Le geste est enregistré au relâchement, tout de suite, sans Publish
 * (`reorderCuration` : publié + brouillon, une transaction). Ajouter ou
 * retirer une photo reste l'affaire des Réglages — cette carte ne sait que
 * ranger.
 *
 * Glisser-déposer en événements pointeur, sans bibliothèque : la vignette
 * saisie reste dans la grille, assombrie, et un fantôme suit le pointeur ;
 * la grille se réordonne en direct sous lui. Un clic sans déplacement reste
 * un clic (ouverture de la photo) — c'est le seuil qui les distingue.
 */
export function CurationCard({
  curation,
  thumbUrl,
}: {
  curation: (CurationEntry | null)[] | null;
  thumbUrl: ThumbFn;
}) {
  const baseClient = useClient({ apiVersion: API_VERSION });
  const client = useMemo(
    () => baseClient.withConfig({ perspective: 'raw' }),
    [baseClient]
  );
  const toast = useToast();

  const entries = useMemo(
    () => (curation ?? []).filter((p): p is CurationEntry => Boolean(p)),
    [curation]
  );

  const [order, setOrder] = useState<CurationEntry[]>(entries);
  const orderRef = useRef(order);
  /** Dernier ordre connu en base — la référence du « rien n'a changé » et du repli en cas d'erreur. */
  const savedRef = useRef<CurationEntry[]>(entries);
  const dragRef = useRef<DragState | null>(null);
  const commitTimer = useRef<number | undefined>(undefined);
  const justDragged = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; src: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  // Nouvelle donnée du Tableau de bord (rafraîchissement) : on se cale dessus,
  // sauf au milieu d'un geste ou d'un enregistrement clavier en attente.
  useEffect(() => {
    if (dragRef.current || commitTimer.current !== undefined) return;
    orderRef.current = entries;
    savedRef.current = entries;
    setOrder(entries);
  }, [entries]);

  const commit = useCallback(
    async (next: CurationEntry[]) => {
      if (ids(next) === ids(savedRef.current)) return;
      setSaving(true);
      try {
        const write = await reorderCuration(
          client,
          next.map((e) => e._id)
        );
        savedRef.current = next;
        toast.push({
          status: 'success',
          title: 'Ordre de la home enregistré',
          description: write.draftAligned
            ? 'Enregistré tout de suite, sans Publish — le brouillon des Réglages a été rangé aussi. Le site en ligne suivra au prochain déploiement.'
            : 'Enregistré tout de suite, sans Publish. Le site en ligne suivra au prochain déploiement.',
        });
      } catch (err) {
        orderRef.current = savedRef.current;
        setOrder(savedRef.current);
        toast.push({
          status: 'error',
          title: 'Ordre non enregistré',
          description:
            err instanceof Error ? err.message : 'Erreur réseau inconnue.',
        });
      } finally {
        setSaving(false);
      }
    },
    [client, toast]
  );
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // Un enregistrement clavier encore en attente part au démontage.
  useEffect(
    () => () => {
      if (commitTimer.current === undefined) return;
      window.clearTimeout(commitTimer.current);
      commitTimer.current = undefined;
      void commitRef.current(orderRef.current);
    },
    []
  );

  const reorder = useCallback((from: number, to: number) => {
    const next = move(orderRef.current, from, to);
    orderRef.current = next;
    setOrder(next);
  }, []);

  const scheduleCommit = useCallback(() => {
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = undefined;
      void commitRef.current(orderRef.current);
    }, KEYBOARD_COMMIT_DELAY);
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, id: string) => {
      if (e.button !== 0 || saving) return;
      const rect = e.currentTarget.getBoundingClientRect();
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        el: e.currentTarget,
        startX: e.clientX,
        startY: e.clientY,
        grabX: e.clientX - rect.left,
        grabY: e.clientY - rect.top,
        active: false,
        slots: [],
      };
    },
    [saving]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) {
          return;
        }
        d.active = true;
        d.el.setPointerCapture(d.pointerId);
        d.slots = Array.from(containerRef.current?.children ?? []).map((c) =>
          c.getBoundingClientRect()
        );
        setDraggingId(d.id);
      }
      e.preventDefault();
      const entry = orderRef.current.find((p) => p._id === d.id);
      setGhost({
        x: e.clientX - d.grabX,
        y: e.clientY - d.grabY,
        src: entry ? thumbUrl(entry.image, 160) : null,
      });
      const target = slotAt(d.slots, e.clientX, e.clientY);
      if (target === null) return;
      const from = orderRef.current.findIndex((p) => p._id === d.id);
      if (from !== -1 && from !== target) reorder(from, target);
    },
    [reorder, thumbUrl]
  );

  const onPointerEnd = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (!d.active) return;
    try {
      d.el.releasePointerCapture(d.pointerId);
    } catch {
      // Capture déjà relâchée (pointercancel) : rien à faire.
    }
    justDragged.current = true;
    setDraggingId(null);
    setGhost(null);
    void commit(orderRef.current);
  }, [commit]);

  // Le clic qui termine un glisser ne doit pas ouvrir la photo.
  const onClickCapture = useCallback((e: MouseEvent<HTMLElement>) => {
    if (!justDragged.current) return;
    justDragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>, index: number) => {
      const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (delta === 0 || saving) return;
      e.preventDefault();
      const to = index + delta;
      if (to < 0 || to >= orderRef.current.length) return;
      reorder(index, to);
      scheduleCommit();
    },
    [reorder, saving, scheduleCommit]
  );

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Flex align="center" gap={2}>
          <StarIcon />
          <Heading size={1}>La curation (home)</Heading>
          <Badge tone={order.length > 0 ? 'primary' : 'caution'}>{order.length}</Badge>
          {saving && <Spinner muted />}
        </Flex>

        {order.length === 0 ? (
          <Card padding={3} radius={2} tone="caution">
            <Text size={1}>
              Aucune photo curatée : la home est vide. Ouvre{' '}
              <strong>Réglages du site → Curation</strong> et ajoute des photos.
            </Text>
          </Card>
        ) : (
          <div
            ref={containerRef}
            onClickCapture={onClickCapture}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
          >
            {order.map((photo, i) => {
              const src = thumbUrl(photo.image, 160);
              const dragging = draggingId === photo._id;
              return (
                <IntentLink
                  key={photo._id}
                  intent="edit"
                  params={{ id: photo._id, type: 'photo' }}
                  title={`${photo.title} — glisser pour déplacer, ← / → au clavier`}
                  aria-label={`${i + 1}. ${photo.title}`}
                  onPointerDown={(e) => onPointerDown(e, photo._id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerEnd}
                  onPointerCancel={onPointerEnd}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    textDecoration: 'none',
                    touchAction: 'none',
                    userSelect: 'none',
                    cursor: dragging ? 'grabbing' : 'grab',
                    opacity: dragging ? 0.3 : 1,
                  }}
                >
                  <Card
                    radius={2}
                    tone="transparent"
                    border
                    style={{ width: TILE, overflow: 'hidden' }}
                  >
                    <Box style={{ position: 'relative', width: TILE, height: TILE }}>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          draggable={false}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <Flex
                          align="center"
                          justify="center"
                          style={{ width: '100%', height: '100%', opacity: 0.4 }}
                        >
                          <ImageIcon />
                        </Flex>
                      )}
                      <Badge
                        tone="default"
                        style={{ position: 'absolute', top: 4, left: 4 }}
                      >
                        {i + 1}
                      </Badge>
                    </Box>
                  </Card>
                </IntentLink>
              );
            })}
          </div>
        )}

        {ghost && (
          <div
            aria-hidden
            style={{
              position: 'fixed',
              left: ghost.x,
              top: ghost.y,
              width: TILE,
              height: TILE,
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,.35)',
              transform: 'scale(1.06)',
              pointerEvents: 'none',
              zIndex: 1000,
              background: 'var(--card-border-color, #222)',
            }}
          >
            {ghost.src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ghost.src}
                alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </div>
        )}

        <Text size={0} muted>
          L&apos;ordre affiché = l&apos;ordre sur la home. Glisse une vignette (ou
          ← / → au clavier) pour la déplacer : enregistré tout de suite, sans
          Publish — le site suivra au prochain déploiement. Ajouter ou retirer
          une photo : Réglages du site → Curation.
        </Text>
      </Stack>
    </Card>
  );
}
