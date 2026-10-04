import { EDITORIAL_LEAD } from '@/lib/site/typography';

/**
 * Phrase d'auteur de la home — au-dessus de « Selected Works », sous le hero.
 *
 * Pourquoi : la home est faite d'images et de listes ; aucune phrase ne dit qui,
 * où, quoi. C'est la première chose qu'un moteur (et un galeriste pressé) lit.
 * Le texte vient du Studio (`siteSettings.homeIntro`, CLAUDE.md §8.5) ; vide,
 * le composant ne rend RIEN — la page reste exactement ce qu'elle était.
 *
 * Mêmes bornes que la galerie (1920 de plafond, calé à gauche, 32 px de
 * gouttière) pour tomber sur le bord gauche des photos et du lettrage. Registre
 * du chapô, pas un nouveau cran : « silence visuel » (§3.1). Padding en style
 * INLINE — le reset `* { padding: 0 }` avale les utilities (§7.6).
 */
export function HomeIntro({ text }: { text?: string }) {
  const value = text?.trim();
  if (!value) return null;
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1920,
        paddingInline: 32,
        paddingTop: '12vh',
      }}
    >
      <p className={EDITORIAL_LEAD} style={{ maxWidth: 880 }}>
        {value}
      </p>
    </div>
  );
}
