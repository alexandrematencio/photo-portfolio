import { Fragment, type ReactNode } from 'react';
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
 * Le RAIL du journal (2026-10-18, demande Alexandre) : le bouton Back et le
 * sélecteur de langue, glissés à GAUCHE de l'article et collés sous le menu
 * au défilement — le retour reste à portée de main. Deux rails de même
 * largeur, le second vide : la colonne reste centrée.
 *
 * Dès 1280 px seulement (`xl`) : en dessous, la marge ne loge pas un bouton
 * sans écraser la colonne de notes (seuil 1100, Notes.tsx). Le rail
 * redevient alors une rangée au-dessus du titre, dans le flux.
 */
const RAIL_WIDTH = 176;
/** Sous le menu : le conteneur de défilement commence déjà sous la nav-bar (FramedScroll). */
const RAIL_STICKY_TOP = 24;
/**
 * Avec un sommaire (2026-10-22), le bloc du rail ne prend plus la largeur du
 * bouton Back mais une largeur FIXE : les intertitres ont besoin de place, et
 * tout le bloc — Back, drapeaux, barre, sommaire — garde un seul bord gauche
 * et un seul bord droit. Les 28 px laissés à gauche logent le voyant du
 * sommaire, suspendu dans la marge.
 */
const RAIL_CONTENTS_WIDTH = RAIL_WIDTH - 28;
/** De part et d'autre de chaque filet du rail : le même air partout, aucun bloc ne colle à son voisin. */
const RAIL_SECTION_GAP = 16;
/** Écart drapeau → chevron (4) + chevron (14) dans `LanguageSwitch` : ce qui dépasse sous les drapeaux. */
const FLAG_CHEVRON_HANG = 18;

/**
 * Écart titre → sous-titre. Serré exprès : le sous-titre appartient au bloc de
 * titre, il n'est pas le corps de la page. C'est bien le BLOC entier
 * (titre + sous-titre) que `PAGE_TITLE_GAP` sépare ensuite du contenu.
 */
const SUBTITLE_GAP = 12;

export function PageTitle({
  children,
  size = 'var(--page-title-size)',
}: {
  children: ReactNode;
  /** Expression CSS du corps — jamais un nombre (cf. ⚠️ plus haut). Défaut : le corps unique du site. */
  size?: string;
}) {
  return (
    <h1 className={PAGE_TITLE} style={{ fontSize: size }}>
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
  titleSize,
  centered = false,
  back,
  language,
  progress,
  contents,
}: {
  title: ReactNode;
  /** Lien de retour (journal : `BackLink`) — dans le rail. Facultatif. */
  back?: ReactNode;
  /** Sélecteur de langue (journal : `LanguageSwitch`) — sous le retour, dans le rail. */
  language?: ReactNode;
  /**
   * Avancement de lecture (journal : `ReadingProgress`), sous ses deux formes :
   * `rail` sous les drapeaux dès `xl`, `top` collée en tête du défilement en
   * dessous. L'article prend alors `data-reading` — c'est lui qu'elles mesurent.
   */
  progress?: { rail: ReactNode; top: ReactNode };
  /** Sommaire (journal : `TableOfContents`) — sous l'avancement, dans le rail dès `xl` seulement. */
  contents?: ReactNode;
  /**
   * Corps du titre quand ce n'est pas un MOT de page mais une PHRASE — un
   * titre d'article du journal fait douze mots, et au corps unique il
   * remplissait neuf lignes d'un téléphone. Toujours dérivé de
   * `--page-title-size`, jamais un nombre.
   */
  titleSize?: string;
  /**
   * `true` : la colonne (même largeur) est centrée dans la fenêtre au lieu
   * d'être calée à gauche. Réservé au journal (demande Alexandre,
   * 2026-10-17) — une exception assumée à la colonne de 1107 alignée à
   * gauche du brand book §10.2, qui reste la règle des autres pages.
   * `marginInline` en style inline : le reset `* { margin: 0 }` avale les
   * utilities.
   */
  centered?: boolean;
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
  const hasRail = Boolean(back || language);
  const page = (
    <article
      data-reading={progress ? '' : undefined}
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
        marginInline: centered && !bleed ? 'auto' : undefined,
        width: centered && !bleed ? '100%' : undefined,
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
        {/* Sous `xl`, le rail est une rangée au-dessus du titre. 12 + le
            `gap` de 12 : il se détache du titre sans s'en éloigner. */}
        {hasRail && (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 xl:hidden" style={{ marginBottom: 12 }}>
            {back}
            {language}
          </div>
        )}
        <PageTitle size={titleSize}>{title}</PageTitle>
        {subtitle}
      </header>
      {children}
    </article>
  );

  if (!hasRail) return page;
  return (
    <div className="relative">
      {/* Sous `xl`, l'avancement est une ligne pleine largeur collée en haut du
          défilement. Elle remonte de l'air haut de <main> pour partir du bord
          du conteneur, et le lui rend dessous : le flux ne bouge pas. */}
      {progress && (
        <div
          className="sticky top-0 z-20 xl:hidden"
          style={{ marginTop: 'calc(-1 * var(--page-air-top))', marginBottom: 'calc(var(--page-air-top) - 3px)' }}
        >
          {progress.top}
        </div>
      )}
      <div
        className="xl:grid"
        style={{ gridTemplateColumns: `${RAIL_WIDTH}px minmax(0, ${maxWidth ?? EDITORIAL_WIDTH}px) ${RAIL_WIDTH}px`, justifyContent: 'center' }}
      >
        {/* La cellule court sur toute la hauteur de l'article : c'est elle qui
            borne le collant. Le rail se cale sur son bord DROIT, contre la
            gouttière de l'article. Le bloc prend la largeur de son élément le
            plus large — le bouton Back — et tout le reste s'y justifie, bord à
            bord (2026-10-22) : drapeaux répartis, barre d'avancement étirée. */}
        <div className="hidden xl:block">
          {/* Plafonné à la hauteur du conteneur de défilement (sous la
              nav-bar, `top-16` de FramedScroll) : un long sommaire défile
              dans sa propre boîte au lieu de passer sous le bas de l'écran. */}
          <div
            className="sticky flex flex-col items-end"
            style={{ top: RAIL_STICKY_TOP, maxHeight: contents ? `calc(100dvh - 4rem - ${RAIL_STICKY_TOP * 2}px)` : undefined }}
          >
            {/* Un bloc par fonction — retour, langue, avancement, sommaire —
                séparés d'un filet CLAIR à égale distance des deux voisins
                (2026-10-25). Le noir est réservé au souligné de « Sommaire » :
                il ancre le bloc principal, les petits blocs de contrôle se
                distinguent déjà par leur forme. */}
            <div className="flex min-h-0 flex-col" style={{ width: contents ? RAIL_CONTENTS_WIDTH : undefined, gap: RAIL_SECTION_GAP }}>
              {[
                back,
                // Le chevron de la langue courante pend dans l'air du dessous :
                // l'écart filet → drapeaux et drapeaux → filet est le même, le
                // chevron seul s'approche du filet bas (voulu, 2026-10-25).
                language && <div style={{ marginBottom: -FLAG_CHEVRON_HANG }}>{language}</div>,
                progress?.rail,
                contents && <div className="flex min-h-0 flex-col">{contents}</div>,
              ]
                .filter(Boolean)
                .flatMap((block, i) => [
                  i > 0 && <div key={`rule-${i}`} aria-hidden className="shrink-0 self-stretch" style={{ height: 1, backgroundColor: 'var(--color-line)' }} />,
                  <Fragment key={i}>{block}</Fragment>,
                ])}
            </div>
          </div>
        </div>
        {page}
      </div>
    </div>
  );
}
