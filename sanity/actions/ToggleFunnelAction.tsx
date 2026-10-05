import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@sanity/ui';
import { AddIcon, RemoveIcon } from '@sanity/icons';
import { useClient, type DocumentActionComponent } from 'sanity';
import {
  ADD_LABEL,
  REMOVE_LABEL,
  isInFunnel,
  setInFunnel,
} from '../lib/funnelCuration';

const API_VERSION = '2026-01-01';

/**
 * Action document « Ajouter à la funnel curation » / « Retirer de la funnel
 * curation » — un clic, disponible sur toute photo ouverte, quel que soit le
 * panneau d'où l'on vient. C'est le geste qui rend une liste d'une centaine de
 * photos praticable : le champ du singleton, lui, ne sait ajouter qu'une
 * référence à la fois via sa recherche.
 *
 * L'appartenance ne vit pas sur la photo (voir `schemas/funnelCuration.ts`) :
 * l'état est donc LU sur le singleton publié, au montage et après chaque clic.
 */
export const ToggleFunnelAction: DocumentActionComponent = (props) => {
  const { id, draft, published, onComplete } = props;
  const baseClient = useClient({ apiVersion: API_VERSION });
  const client = useMemo(
    () => baseClient.withConfig({ perspective: 'raw' }),
    [baseClient]
  );
  const toast = useToast();
  const [inFunnel, setInFunnelState] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    // En cas d'échec de lecture, on retombe sur « pas dedans » plutôt que de
    // griser l'action : `setInFunnel` relit l'état réel avant d'écrire, un
    // ajout sur une photo déjà présente ne fait rien.
    isInFunnel(client, id)
      .then(setInFunnelState)
      .catch(() => setInFunnelState(false));
  }, [client, id]);

  useEffect(refresh, [refresh]);

  const current = published ?? draft;
  const title =
    typeof current?.title === 'string' && current.title ? current.title : 'La photo';

  return {
    label: busy || inFunnel === null ? 'Un instant…' : inFunnel ? REMOVE_LABEL : ADD_LABEL,
    icon: inFunnel ? RemoveIcon : AddIcon,
    disabled: busy || inFunnel === null || !current,
    title: 'Galerie du tunnel de design-folio. Invisible sur amatencio-photo.',
    onHandle: async () => {
      if (inFunnel === null) return;
      setBusy(true);
      const next = !inFunnel;
      try {
        await setInFunnel(client, id, next);
        setInFunnelState(next);
        toast.push({
          status: 'success',
          title: next
            ? `${title} est dans la funnel curation`
            : `${title} est retirée de la funnel curation`,
          description: next
            ? 'Ajoutée en fin de liste, sans Publish. L’ordre se règle dans Photos → Funnel curation.'
            : 'Enregistré tout de suite, sans Publish.',
        });
      } catch (err) {
        toast.push({
          status: 'error',
          title: 'Changement impossible',
          description:
            err instanceof Error ? err.message : 'Erreur réseau inconnue.',
        });
        refresh();
      } finally {
        setBusy(false);
        onComplete();
      }
    },
  };
};
