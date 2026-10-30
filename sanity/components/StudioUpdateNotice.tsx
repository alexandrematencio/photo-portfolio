import { useEffect, useState } from 'react';
import { Button, Card, Flex, Text } from '@sanity/ui';
import { WarningOutlineIcon } from '@sanity/icons';

/**
 * « Le Studio a été mis à jour » (2026-10-30, demande Alexandre). Un onglet
 * ouvert AVANT une mise en ligne garde l'ancien code : l'ancien schéma, les
 * anciennes règles. Il bloque alors un Publish que le Studio à jour accepte
 * (payé le jour de la note sur l'IA : un lien `#note-ia` refusé, une Concept
 * Map « à reprendre » qui ne l'était plus). Rien dans Sanity ne le signale.
 *
 * L'empreinte du build est gravée dans le bundle et publiée à côté
 * (`/studio/version.json`) ; on la relit toutes les minutes et au retour sur
 * l'onglet. Différente : un bandeau, et un bouton pour recharger.
 */
const MINE = process.env.NEXT_PUBLIC_BUILD_STAMP ?? '';
const EVERY = 60_000;

export function StudioUpdateNotice() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!MINE || stale) return;
    let live = true;
    const check = () =>
      fetch(`/studio/version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((v: { stamp?: string } | null) => live && v?.stamp && v.stamp !== MINE && setStale(true))
        .catch(() => {});
    const onVisible = () => document.visibilityState === 'visible' && check();
    const timer = window.setInterval(check, EVERY);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    check();
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [stale]);

  if (!stale) return null;
  return (
    // Flottant : le Studio occupe toute la hauteur, un bandeau dans le flux la ferait déborder.
    <Card
      tone="caution"
      padding={3}
      radius={3}
      shadow={3}
      border
      style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 'min(640px, calc(100vw - 32px))', zIndex: 1000 }}
    >
      <Flex align="center" gap={3} wrap="wrap">
        <Text size={1}>
          <WarningOutlineIcon />
        </Text>
        <Text size={1} style={{ flex: 1, minWidth: 240 }}>
          <strong>Le Studio a été mis à jour</strong> depuis l’ouverture de cet onglet. Recharge la page avant de publier : cette
          version peut afficher des erreurs qui n’existent plus, ou en oublier. Ton travail est enregistré au fil de l’eau, rien ne se
          perd.
        </Text>
        <Button text="Recharger" tone="caution" onClick={() => window.location.reload()} />
      </Flex>
    </Card>
  );
}
