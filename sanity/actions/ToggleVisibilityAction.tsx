import { useMemo, useState } from 'react';
import { useToast } from '@sanity/ui';
import { EyeClosedIcon, EyeOpenIcon } from '@sanity/icons';
import { useClient, type DocumentActionComponent } from 'sanity';
import {
  setPhotoHidden,
  visibilityLabel,
  visibilityToast,
} from '../lib/photoVisibility';

const API_VERSION = '2026-01-01';

/**
 * Action document « Masquer du site » / « Montrer sur le site » — un clic,
 * disponible sur toute photo ouverte, quel que soit le panneau d'où l'on vient.
 * Même geste que l'œil des lignes de liste (`PhotoRowSubtitle`) ; l'écriture
 * (patch direct du publié et du brouillon, sans Publish) vit une seule fois
 * dans `sanity/lib/photoVisibility.ts`, qui en donne les raisons.
 *
 * L'état affiché est celui que LIT LE SITE : la version publiée quand elle
 * existe, le brouillon sinon.
 */
export const ToggleVisibilityAction: DocumentActionComponent = (props) => {
  const { id, draft, published, onComplete } = props;
  const baseClient = useClient({ apiVersion: API_VERSION });
  const client = useMemo(
    () => baseClient.withConfig({ perspective: 'raw' }),
    [baseClient]
  );
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const current = published ?? draft;
  const hidden = current?.hidden === true;
  const title =
    typeof current?.title === 'string' && current.title ? current.title : 'La photo';

  return {
    label: busy ? 'Un instant…' : visibilityLabel(hidden),
    icon: hidden ? EyeOpenIcon : EyeClosedIcon,
    disabled: busy || !current,
    title: hidden
      ? 'La photo reprend sa place partout : home, /archives, /series.'
      : 'La photo disparaît du site sans rien perdre (séries, ordre, curation).',
    onHandle: async () => {
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
        onComplete();
      }
    },
  };
};
