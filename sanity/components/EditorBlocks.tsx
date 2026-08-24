import type { BlockStyleProps } from 'sanity';

/**
 * Rendu des styles de bloc DANS l'éditeur Portable Text du Studio.
 *
 * But : que l'éditeur montre la hiérarchie PROPORTIONNELLE que le site rend
 * vraiment (`components/site/PortableBody.tsx`, variante éditoriale), pour que
 * le rédacteur n'ait pas à l'imaginer. Sans ces composants, Sanity affiche
 * h2/h3/h4 à des tailles qui n'ont aucun rapport avec le site.
 *
 * ── Ce que le site rend (mobile / desktop), refonte du 2026-08-24 ───────────
 *   chapô    21 / 28   700   ← POSITIONNEL, pas un style (voir plus bas)
 *   normal   17 / 20   500     corps courant
 *   annexe   15 / 17   500     registre pratique
 *   h2       36 / 48   700   capitales
 *   h3       19 / 24   700
 *   h4       11 / 11   700   capitales — l'étiquette du site (`MICRO_LABEL`)
 *
 * ⚠️ **Le chapô ne peut pas être montré ici, et c'est une limite assumée.**
 * Sur le site, le premier paragraphe d'une page est promu en chapô par sa
 * POSITION (28 px / 700, pleine colonne) ; il n'y a pas de style à choisir.
 * `BlockStyleProps` n'expose pas l'index du bloc dans le document, donc
 * l'éditeur affiche ce premier paragraphe comme n'importe quel « Normal ». Le
 * rappel est écrit dans la description du champ (`editorialBodyDescription`,
 * siteSettings.ts) — si un jour l'API expose l'index, c'est ici qu'il faudra
 * rebrancher la distinction.
 *
 * ── Échelle du Studio ──────────────────────────────────────────────────────
 * Les tailles sont réduites pour tenir dans la colonne d'édition (~640 px),
 * les RAPPORTS sont préservés. Deux écarts assumés :
 *  - le corps courant est à 0,8 du site (16 pour 20) et non à 0,65 comme les
 *    titres : sous 15 px, on n'édite plus confortablement ;
 *  - le h4 reste à 11 px, sa taille RÉELLE. Le descendre à 9 le rendrait
 *    illisible dans un champ de saisie pour aucun gain de fidélité.
 * Les marges sont en `em` : elles suivent donc la taille de chaque cran, comme
 * sur le site, sans avoir à retranscrire les pixels de `RHYTHM`.
 *
 * La famille retombe sur le sans-serif système : Inter n'est pas chargée dans
 * l'iframe du Studio. Ce sont les proportions qui comptent, pas les glyphes.
 */

const BASE: React.CSSProperties = {
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
  color: 'inherit',
};

/** Titres : interlettrage resserré, comme sur le site (brand book §5.4). */
const TITLE: React.CSSProperties = { ...BASE, letterSpacing: '-0.02em' };

/**
 * Corps : AUCUN interlettrage. Le `-0.02em` est un réglage de grand corps ; le
 * garder sur du 16 px en graisse 500 refermerait les contreformes. C'est le
 * même arbitrage que sur le site — cf. `EDITORIAL_BODY`.
 */
const COPY: React.CSSProperties = { ...BASE, letterSpacing: 'normal' };

export function NormalBlock(props: BlockStyleProps) {
  return (
    <p
      style={{
        ...COPY,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.55,
        margin: '0 0 1.2em 0',
      }}
    >
      {props.children}
    </p>
  );
}

/**
 * ANNEXE — le registre pratique (délai de réponse, listes de matériel,
 * mentions). Ajouté le 2026-08-24 : c'est le SEUL des trois corps que
 * l'éditeur déclare lui-même. Avant lui, « Studio in Villejuif, travel across
 * France and worldwide » se lisait au volume exact de la bio.
 */
export function AnnexBlock(props: BlockStyleProps) {
  return (
    <p
      style={{
        ...COPY,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.5,
        margin: '0 0 0.95em 0',
      }}
    >
      {props.children}
    </p>
  );
}

export function H2Block(props: BlockStyleProps) {
  return (
    <h2
      style={{
        ...TITLE,
        fontSize: 36,
        fontWeight: 700,
        textTransform: 'uppercase',
        lineHeight: 0.95,
        margin: '1.33em 0 0.5em 0',
      }}
    >
      {props.children}
    </h2>
  );
}

export function H3Block(props: BlockStyleProps) {
  return (
    <h3
      style={{
        ...TITLE,
        fontSize: 19,
        fontWeight: 700,
        lineHeight: 1.25,
        margin: '1.67em 0 0.33em 0',
      }}
    >
      {props.children}
    </h3>
  );
}

/**
 * H4 — descendu de 21 px à 11 le 2026-08-24, en même temps que le site. Ce
 * n'est plus un titre dimensionné mais l'ÉTIQUETTE du site : 11 px, capitales,
 * gras. L'ancien h4 tenait à 11 % du h3, soit un cran déclaré dans le Studio
 * et invisible à l'écran.
 */
export function H4Block(props: BlockStyleProps) {
  return (
    <h4
      style={{
        ...BASE,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'normal',
        lineHeight: 1.2,
        margin: '2.9em 0 1.09em 0',
      }}
    >
      {props.children}
    </h4>
  );
}
