import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Button, Menu, MenuButton, MenuItem, useToast } from '@sanity/ui';
import { EyeClosedIcon, EyeOpenIcon } from '@sanity/icons';
import imageUrlBuilder from '@sanity/image-url';
import { useClient } from 'sanity';
import {
  setPhotoHidden,
  visibilityLabel,
  visibilityToast,
} from '../lib/photoVisibility';

const API_VERSION = '2026-01-01';
/** Carré demandé au CDN : net à 33 px en @2x, suffisant pour les mises en page plus larges. */
const THUMB_PX = 96;

/**
 * Vignette d'aperçu d'une photo, avec l'interrupteur « Masquée du site » par-dessus
 * (skill sanity-studio §11.19).
 *
 * **Pourquoi la VIGNETTE.** L'aperçu préparé (`preview.prepare`) est la seule
 * valeur qui traverse toutes les listes où une photo apparaît — listes de
 * documents de Structure, lignes de `photoOrder` / `curation`, aperçu de
 * `coverPhoto` — et aucune n'offre de menu de ligne extensible. Or Sanity
 * VALIDE ce que `prepare` rend : `title`, `subtitle`, `description` doivent
 * être des scalaires (`isRenderable`, source installée 5.26 — un élément React
 * dans `subtitle` a fait tomber toutes les lignes en « Invalid preview
 * config »), tandis que `media` accepte n'importe quoi et rend un élément tel
 * quel (`renderMedia`). La vignette est donc le seul emplacement possible, et
 * on la dessine soi-même : même URL que `SanityDefaultMedia` (builder
 * `@sanity/image-url`, recadrage hotspot/crop), `object-fit: cover`.
 *
 * **Rien ne change sur une photo visible** : l'œil ouvert ne recouvre la
 * vignette qu'au survol (ou au focus) de la ligne. Une photo masquée porte en
 * permanence la vignette assombrie et l'œil fermé — c'est son marqueur. Le
 * survol est détecté sur la ligne (`[data-ui="PreviewCard"]`) et non sur le
 * bouton, sinon on ne pourrait pas le trouver pour le survoler.
 *
 * **La ligne est un lien ou un bouton** (navigation vers le document, ou
 * ouverture de la référence) : chaque événement du contrôle est arrêté avant
 * d'atteindre la ligne, y compris ceux du menu, qui remontent l'arbre React
 * même depuis un portail.
 */
export function PhotoRowMedia({
  id,
  title,
  image,
  hidden,
  size = THUMB_PX,
}: {
  id: string;
  title: string;
  image: unknown;
  hidden: boolean;
  /**
   * Carré demandé au CDN. Le défaut sert les lignes de liste (33 px) ; la
   * planche-contact de `PhotoGridPane` demande plus grand pour ses cases.
   */
  size?: number;
}) {
  const baseClient = useClient({ apiVersion: API_VERSION });
  const client = useMemo(
    () => baseClient.withConfig({ perspective: 'raw' }),
    [baseClient]
  );
  const toast = useToast();
  const menuId = useId();
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const [rowActive, setRowActive] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const src = useMemo(() => {
    const asset = (image as { asset?: { _ref?: string } } | null)?.asset;
    if (!asset?._ref) return null;
    try {
      return imageUrlBuilder(baseClient)
        .image(
          image as Parameters<ReturnType<typeof imageUrlBuilder>['image']>[0]
        )
        .width(size)
        .height(size)
        .fit('crop')
        .auto('format')
        .url();
    } catch {
      return null;
    }
  }, [baseClient, image, size]);

  useEffect(() => {
    // Ligne native de Sanity, ou ligne / case de `PhotoGridPane` (qui marque
    // ses cartes elle-même, faute de pouvoir typer `PreviewCard as={ChildLink}`).
    const row = hostRef.current?.closest(
      '[data-ui="PreviewCard"], [data-photo-row]'
    );
    if (!row) return;
    const on = () => setRowActive(true);
    const off = () => setRowActive(false);
    row.addEventListener('mouseenter', on);
    row.addEventListener('mouseleave', off);
    row.addEventListener('focusin', on);
    row.addEventListener('focusout', off);
    return () => {
      row.removeEventListener('mouseenter', on);
      row.removeEventListener('mouseleave', off);
      row.removeEventListener('focusin', on);
      row.removeEventListener('focusout', off);
    };
  }, []);

  const swallow = useCallback((e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  // Le clavier ne doit pas atteindre la ligne (Entrée / Espace l'activeraient),
  // mais Échap doit encore fermer le menu : on ne bloque que la remontée.
  const swallowKeys = useCallback((e: KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const next = !hidden;
    try {
      const write = await setPhotoHidden(client, id, next);
      toast.push({ status: 'success', ...visibilityToast(title, next, write) });
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Changement impossible',
        description:
          err instanceof Error ? err.message : 'Erreur réseau inconnue.',
      });
    } finally {
      setBusy(false);
    }
  }, [busy, client, hidden, id, title, toast]);

  const shown = hidden || rowActive || open;

  // ⚠️ Les gestionnaires qui AVALENT les événements ne sont posés que sur le
  // bouton, jamais sur la vignette entière : la vignette fait partie d'un lien
  // (la ligne, ou toute la case de la planche-contact), et l'avaler empêchait
  // d'ouvrir la photo en cliquant dessus — payé le 2026-09-10 sur la grille.
  return (
    <span
      ref={hostRef}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: hidden ? 0.35 : 1,
            transition: 'opacity 120ms',
          }}
        />
      ) : null}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: shown ? 1 : 0,
          transition: 'opacity 120ms',
          // La couche ne capte rien : seul le bouton, dessous, est cliquable.
          pointerEvents: 'none',
        }}
      >
        <span
          onClick={swallow}
          onMouseDown={swallow}
          onKeyDown={swallowKeys}
          style={{
            display: 'inline-flex',
            // Invisible = inerte, pour ne pas intercepter un clic destiné au lien.
            pointerEvents: shown ? 'auto' : 'none',
          }}
        >
          <MenuButton
            id={menuId}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            popover={{ portal: true, placement: 'bottom-start' }}
            button={
              <Button
                mode="bleed"
                padding={2}
                fontSize={1}
                tone={hidden ? 'caution' : 'default'}
                icon={hidden ? EyeClosedIcon : EyeOpenIcon}
                aria-label={
                  hidden ? 'Photo masquée du site' : 'Visibilité sur le site'
                }
                disabled={busy}
                style={{ background: 'rgba(0,0,0,.45)', color: '#fff' }}
              />
            }
            menu={
              <Menu>
                <MenuItem
                  text={visibilityLabel(hidden)}
                  icon={hidden ? EyeOpenIcon : EyeClosedIcon}
                  onClick={() => {
                    void toggle();
                  }}
                />
              </Menu>
            }
          />
        </span>
      </span>
    </span>
  );
}
