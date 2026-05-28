import type { BlockStyleProps } from 'sanity';

/**
 * Custom block-style components for the Portable Text editor inside Studio.
 *
 * Goal: the editor preview mirrors the *proportional* typography the site
 * actually renders (cf. `components/site/PortableBody.tsx` editorial variant),
 * so editors don't have to imagine the result.
 *
 * Sizes are scaled to fit the Studio's narrower editing column (~640 px) while
 * preserving the relative hierarchy. Weight, leading, tracking and uppercase
 * casing follow the site exactly. Font-family falls through to the system
 * sans-serif because Inter isn't loaded inside the Studio iframe — the
 * proportions are what matter, not the exact glyphs.
 *
 * Reference site sizes (mobile / desktop):
 *   normal  22 / 32   bold
 *   h2      36 / 48   bold uppercase
 *   h3      28 / 40   bold (clearly above body)
 *   h4      24 / 36   bold (subtly above body)
 *
 * Spacing follows the same "headers stick to following paragraph" rhythm as
 * the site: marginTop only on headers, marginBottom only on Normal.
 */

const BASE: React.CSSProperties = {
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
  letterSpacing: '-0.02em',
  color: 'inherit',
};

export function NormalBlock(props: BlockStyleProps) {
  return (
    <p
      style={{
        ...BASE,
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1.34,
        margin: '0 0 1.4em 0',
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
        ...BASE,
        fontSize: 30,
        fontWeight: 800,
        textTransform: 'uppercase',
        lineHeight: 0.95,
        margin: '2.4em 0 0 0',
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
        ...BASE,
        fontSize: 24,
        fontWeight: 800,
        lineHeight: 1.15,
        margin: '1.8em 0 0 0',
      }}
    >
      {props.children}
    </h3>
  );
}

export function H4Block(props: BlockStyleProps) {
  return (
    <h4
      style={{
        ...BASE,
        fontSize: 21,
        fontWeight: 700,
        lineHeight: 1.25,
        margin: '1.2em 0 0 0',
      }}
    >
      {props.children}
    </h4>
  );
}
