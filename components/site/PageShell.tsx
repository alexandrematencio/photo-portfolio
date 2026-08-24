import type { ReactNode } from 'react';
import {
  PAGE_CONTROLS_GAP,
  PAGE_TITLE,
  PAGE_TITLE_GAP,
} from '@/lib/site/typography';

/**
 * LE CADRE D'UNE PAGE — gouttière, titre, écart sous le titre. Composant
 * UNIQUE : toute page qui s'ouvre sur un H1 passe par là, et n'écrit donc ni
 * chaîne de classes de titre, ni padding latéral, ni écart.
 *
 * **Ce qu'il remplace** (2026-08-24, demande Alexandre) : six pages
 * éditoriales portaient la MÊME chaîne de classes de H1 recopiée à la main
 * (`text-[48px] md:text-[64px] font-black uppercase tracking-[-0.04em]
 * leading-none pb-2 md:pb-4 …`), chacune son `paddingLeft: 32` inline, et un
 * `gap-10 md:gap-14` qui donnait 48 px d'écart en mobile là où `/series` en
 * donnait 96. Sept pages, trois mesures différentes, et rien pour le signaler.
 *
 * **Trois zones, pas deux** (2026-08-24) : titre → *commandes* → corps. Une
 * page qui s'ouvre sur un tableau de contrôle plutôt que sur du texte passe
 * `controlBand` ; l'écart sous le titre devient alors `PAGE_CONTROLS_GAP`, et
 * le composant qui rend la bande pose le MÊME écart sous elle. Sans ça, la
 * console entre par la porte `children` et hérite d'une mesure prévue pour une
 * colonne de texte — cf. le commentaire de `PAGE_CONTROLS_GAP`.
 *
 * **Les mesures ne sont pas ici** — elles vivent dans
 * `lib/site/typography.ts` et `app/globals.css`. Ce fichier ne fait que les
 * assembler. Cf. le bloc « CADRE DE PAGE » de `globals.css` pour le
 * raisonnement complet.
 *
 * ⚠️ La gouttière et le corps du titre sont des `var(--page-…)` posées en
 * style INLINE. C'est le seul montage qui tienne les deux bouts : inline pour
 * échapper au reset `* { padding: 0 }`, variable pour changer au point de
 * rupture — un style inline ne connaissant pas les media queries. Ne jamais
 * y substituer un nombre.
 *
 * ⚠️ Ne JAMAIS poser `white-space: nowrap` sur ce titre. Entre 768 et ~885 px
 * de large, « LEGAL NOTICE » et « DIGITAL AGENCY » ne tiennent pas sur une
 * ligne à 96 px : c'est le retour à la ligne qui les empêche de déborder.
 */

/** La colonne de texte éditorial. Mesure historique du site, inchangée. */
const EDITORIAL_WIDTH = 1107;

/**
 * Écart titre → sous-titre. Serré exprès : le sous-titre appartient au bloc de
 * titre, il n'est pas le corps de la page. C'est bien le BLOC entier
 * (titre + sous-titre) que `PAGE_TITLE_GAP` sépare ensuite du contenu.
 */
const SUBTITLE_GAP = 12;

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className={PAGE_TITLE} style={{ fontSize: 'var(--page-title-size)' }}>
      {children}
    </h1>
  );
}

export function PageShell({
  title,
  subtitle,
  children,
  bleed = false,
  controlBand = false,
  width = EDITORIAL_WIDTH,
}: {
  title: ReactNode;
  /** Ligne d'étiquette sous le titre (compteur, résumé). Facultative. */
  subtitle?: ReactNode;
  children: ReactNode;
  /**
   * `true` quand le CORPS de la page va d'un bord à l'autre et porte ses
   * propres gouttières — `/archives` et sa console pleine largeur. Le cadre
   * passe alors sur le seul bloc de titre, qui garde la mesure éditoriale.
   */
  bleed?: boolean;
  /**
   * `true` quand la page ne s'ouvre pas sur du texte mais sur une BANDE DE
   * COMMANDES (le tableau de contrôle d'`/archives`). L'écart sous le titre
   * passe alors de `PAGE_TITLE_GAP` à `PAGE_CONTROLS_GAP`.
   *
   * ⚠️ Ce drapeau ne pose que la MOITIÉ du contrat : l'écart SOUS la bande
   * vit dans le composant qui la rend, parce qu'il y sépare deux éléments
   * internes (console et grille) que `PageShell` ne voit pas — il n'a qu'un
   * enfant. Les deux moitiés lisent le même `PAGE_CONTROLS_GAP` ; en poser
   * une sans l'autre rejoue l'asymétrie 96/40 que la mesure corrige.
   */
  controlBand?: boolean;
  width?: number | false;
}) {
  const maxWidth = width === false ? undefined : width;
  return (
    <article
      // `gap` en style inline plutôt qu'en utility Tailwind : il échappe au
      // reset `* { padding: 0 }` (qui ne parle que de padding et de margin),
      // et une seule valeur suffit aux deux largeurs — rien à rendre
      // responsive, donc rien à confier au CSS.
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: controlBand ? PAGE_CONTROLS_GAP : PAGE_TITLE_GAP,
        paddingInline: bleed ? undefined : 'var(--page-gutter)',
        maxWidth: bleed ? undefined : maxWidth,
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SUBTITLE_GAP,
          paddingInline: bleed ? 'var(--page-gutter)' : undefined,
          maxWidth: bleed ? maxWidth : undefined,
        }}
      >
        <PageTitle>{title}</PageTitle>
        {subtitle}
      </header>
      {children}
    </article>
  );
}
