import { STATE_DOT_SIZE } from '@/components/site/StateDot';

/**
 * La couleur d'une thématique (champ « Couleur » du Studio, 2026-10-21) : un
 * CARRÉ posé devant son nom. Carré et pas disque : le disque est le voyant
 * d'état (`StateDot`, brand book §4.3) — une couleur choisie librement, orange
 * compris, ne doit jamais se lire comme « actif ». Le nom reste gris : la
 * couleur repère, elle n'écrit pas (aucun contraste garanti sur un hex libre).
 *
 * Le liseré prend la couleur du texte à 25 % : un jaune pâle tient sur le
 * papier, un bleu nuit sur la ligne inversée de l'index.
 */
export function TagSwatch({ color }: { color: string | null }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: STATE_DOT_SIZE + 1,
        height: STATE_DOT_SIZE + 1,
        backgroundColor: color,
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, currentColor 25%, transparent)',
      }}
    />
  );
}
