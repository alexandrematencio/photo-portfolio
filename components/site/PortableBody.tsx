import {
  PortableText,
  type PortableTextBlock,
  type PortableTextReactComponents,
} from '@portabletext/react';
import { asset } from '@/lib/utils/asset';
import { EmailAddressText, ProtectedEmail } from './ProtectedEmail';
import { EDITORIAL_BODY } from '@/lib/site/typography';

type Variant = 'default' | 'editorial';

// Brand tokens that get auto-swapped for inline graphics in CMS-driven
// editorial bodies. Only the FIRST occurrence per body becomes the logo —
// subsequent mentions stay as plain text (so e.g. "AAXLO.com" deeper in the
// page reads as text, not as a logo glued to ".com"). The editor types the
// literal token in Studio; the site replaces that one substring with its SVG.
// The original text is preserved in the DOM via `.sr-only` so screen readers
// and search engines still index it. If `href` is set, the logo is wrapped in
// a link (external, new-tab) with no underline / no link-color decoration.
const BRAND_LOGOS = {
  AAXLO: {
    src: '/img/logos/axxlo-logo.svg',
    alt: 'AAXLO',
    href: 'https://www.aaxlo.com/',
  },
} as const;
type BrandLogoKey = keyof typeof BRAND_LOGOS;
const BRAND_LOGO_KEYS = Object.keys(BRAND_LOGOS) as BrandLogoKey[];
// Non-global regex on purpose: avoids `lastIndex` carry-over between successive
// .test() calls (which silently makes the second span miss a token at offset 0).
// `String.prototype.split` with a capturing group still returns all matches +
// the surrounding parts even without the `g` flag.
/**
 * Jeton email : l'éditeur tape littéralement `@EMAIL` dans Studio, le site le
 * remplace par un lien ProtectedEmail affichant l'adresse assemblée côté
 * client. L'adresse ne doit JAMAIS être tapée dans le contenu CMS : le
 * portable text est sérialisé dans le HTML exporté (flight payload), elle y
 * serait en clair pour les scrapers. Contrairement aux logos (première
 * occurrence seule), CHAQUE occurrence du jeton est remplacée.
 */
const EMAIL_TOKEN = '@EMAIL';
const EMAIL_MARK = 'protectedEmailToken';

const TOKEN_REGEX = new RegExp(
  `(${[...BRAND_LOGO_KEYS, EMAIL_TOKEN].join('|')})`
);

/**
 * Walks the Portable Text value and, for any span containing a BRAND_LOGOS key,
 * splits the span so the token sits in its own child carrying a synthetic
 * `brandLogo:<KEY>` mark. The mark renderer registered below then swaps it for
 * an inline SVG sized to the text. Non-block / non-span content passes through
 * untouched.
 */
function injectBrandLogoMarks(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  // Walks the document in order; the first time a given brand token is seen,
  // it's promoted to a logo mark. Subsequent occurrences stay as plain text.
  const consumed = new Set<BrandLogoKey>();
  return value.map((rawBlock) => {
    const block = rawBlock as
      | { _type?: string; children?: unknown[]; _key?: string }
      | undefined;
    if (!block || block._type !== 'block' || !Array.isArray(block.children)) {
      return rawBlock;
    }
    const newChildren: unknown[] = [];
    for (const rawChild of block.children) {
      const child = rawChild as
        | { _type?: string; text?: string; marks?: string[]; _key?: string }
        | undefined;
      const hasToken =
        BRAND_LOGO_KEYS.some(
          (k) => !consumed.has(k) && child?.text?.includes(k)
        ) || Boolean(child?.text?.includes(EMAIL_TOKEN));
      if (
        !child ||
        child._type !== 'span' ||
        typeof child.text !== 'string' ||
        !hasToken
      ) {
        newChildren.push(rawChild);
        continue;
      }
      const parts = child.text.split(TOKEN_REGEX);
      const baseKey = child._key ?? Math.random().toString(36).slice(2);
      const baseMarks = child.marks ?? [];
      parts.forEach((part, i) => {
        if (!part) return;
        const asLogo = BRAND_LOGO_KEYS.includes(part as BrandLogoKey)
          ? (part as BrandLogoKey)
          : null;
        const replaceLogo = asLogo !== null && !consumed.has(asLogo);
        if (replaceLogo) consumed.add(asLogo);
        const isEmail = part === EMAIL_TOKEN;
        newChildren.push({
          ...child,
          _key: `${baseKey}-${i}`,
          text: part,
          marks: replaceLogo
            ? [...baseMarks, brandLogoMarkKey(asLogo)]
            : isEmail
              ? [...baseMarks, EMAIL_MARK]
              : baseMarks,
        });
      });
    }
    return { ...block, children: newChildren };
  });
}

const brandLogoMarkKey = (key: BrandLogoKey) => `brandLogo_${key}`;

function renderBrandLogoMark(
  key: string,
  children: React.ReactNode
): React.ReactNode {
  const logo = BRAND_LOGOS[key as BrandLogoKey] as
    | { src: string; alt: string; href?: string }
    | undefined;
  if (!logo) return <>{children}</>;
  // 1cap aligns the logo height to the cap-height of the surrounding text;
  // 0.78em is the cross-browser fallback (Inter cap-height ≈ 0.72em, bumped
  // slightly so the logo doesn't look anaemic next to bold caps).
  const wrapperStyle: React.CSSProperties = {
    height: '1cap',
    minHeight: '0.78em',
    verticalAlign: '-0.05em',
  };
  const wrapperClass = 'inline-flex items-center align-baseline';
  const inner = (
    <>
      <span className="sr-only">{children}</span>
      <img
        src={asset(logo.src)}
        alt=""
        aria-hidden
        className="h-full w-auto"
        draggable={false}
      />
    </>
  );
  // When the brand declares an `href`, wrap the SVG in a plain `<a>` — no
  // underline, no accent-color, no hover affordance beyond the cursor. The
  // SVG itself stays visually identical to the unlinked render.
  if (logo.href) {
    return (
      <a
        href={logo.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={logo.alt}
        className={`${wrapperClass} no-underline text-current hover:opacity-80 transition-opacity motion-reduce:transition-none`}
        style={wrapperStyle}
      >
        {inner}
      </a>
    );
  }
  return (
    <span className={wrapperClass} style={wrapperStyle}>
      {inner}
    </span>
  );
}

type Props = {
  value?: PortableTextBlock[] | unknown[];
  /** Rendered when value is null / undefined / empty. */
  fallback?: React.ReactNode;
  /**
   * `default` — moderate body type for journal-style pages.
   * `editorial` — bold/large brand typography matching the About / Contact /
   * Digital-Agency layouts. Required for full-page Sanity-driven editorial bodies.
   */
  variant?: Variant;
};

/**
 * Renders a Sanity Portable Text body. Use this everywhere an editable page
 * needs rich text from `siteSettings` (aboutBody, contactBody, digitalAgencyBody) or
 * any future block-content schema field — never hard-code editable copy in
 * a React component (cf. CLAUDE.md §8.5).
 */
export function PortableBody({ value, fallback, variant = 'default' }: Props) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return <>{fallback}</>;
  }

  const components =
    variant === 'editorial' ? EDITORIAL_COMPONENTS : DEFAULT_COMPONENTS;

  const processedValue = injectBrandLogoMarks(value);

  return (
    <div className="prose-content">
      <PortableText
        value={processedValue as PortableTextBlock[]}
        components={components}
      />
    </div>
  );
}

// Explicit mark registration. Sanity's renderer looks up `components.marks[key]`
// by direct property access — a Proxy with a `get` trap silently fails in some
// dispatch paths (e.g. when the lib checks `key in marks` first), so we list
// every brand logo as a real own-property here at module load.
const SHARED_MARKS: Partial<PortableTextReactComponents['marks']> = {
  link: ({ children, value }) => {
    const raw = (value?.href ?? '').trim();
    // Telegram shorthand: editor types `@username` as the link URL in Studio,
    // we expand it to https://t.me/username. Strips any leading whitespace or
    // accidental extra `@`.
    const isTelegramHandle = /^@[A-Za-z0-9_]{3,}$/.test(raw);
    const href = isTelegramHandle ? `https://t.me/${raw.slice(1)}` : raw;
    const external = href.startsWith('http');
    return (
      <a
        href={href}
        className="underline underline-offset-4 hover:text-[var(--color-accent)]"
        rel={external ? 'noopener noreferrer' : undefined}
        target={external ? '_blank' : undefined}
      >
        {children}
      </a>
    );
  },
  // Brand book §10 forbids italic site-wide. Map `em` to a heavier weight
  // (the agreed substitute for emphasis) so editors can mark emphasis in
  // Studio without breaking the typographic rule.
  em: ({ children }) => <span className="font-bold">{children}</span>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  ...Object.fromEntries(
    BRAND_LOGO_KEYS.map((key) => [
      brandLogoMarkKey(key),
      ({ children }: { children: React.ReactNode }) =>
        renderBrandLogoMark(key, children),
    ])
  ),
  // Le texte du span est le jeton `@EMAIL` lui-même : on ne le rend PAS
  // (children ignorés) — il est remplacé par le lien protégé, dont le libellé
  // (l'adresse) est assemblé côté client (cf. ProtectedEmail.tsx).
  [EMAIL_MARK]: () => (
    <ProtectedEmail className="underline underline-offset-4 hover:text-[var(--color-accent)] transition-colors motion-reduce:transition-none">
      <EmailAddressText />
    </ProtectedEmail>
  ),
};

// Notes for editors:
// • Hard return in Studio's PT editor = NEW block = full paragraph gap (mb-10).
// • Shift+Enter = soft break = `\n` inside the same block. `whitespace-pre-line`
//   preserves it as a single line break (tighter than a paragraph gap).
// Both cases now render with visible separation; before, soft breaks collapsed
// to a single space and made the whole bio read as one wall of text.
const DEFAULT_COMPONENTS: Partial<PortableTextReactComponents> = {
  block: {
    normal: ({ children }) => (
      <p className="mb-6 last:mb-0 text-base md:text-lg leading-relaxed text-[var(--color-fg)] whitespace-pre-line">
        {children}
      </p>
    ),
    h2: ({ children }) => (
      <h2 className="mt-12 mb-4 font-bold uppercase text-xl md:text-2xl tracking-tight">
        {children}
      </h2>
    ),
  },
  marks: SHARED_MARKS,
};

// Spacing values are applied via inline `style` (specificity 1,0,0,0) to
// override the universal reset `* { margin: 0 }` from `globals.css`. Tailwind
// utilities like `mb-10` *should* win on specificity, but with Tailwind v4 +
// Turbopack the cascade ordering can occasionally bury them under preflight
// resets — inline styles eliminate that risk for this critical layout.
//
// Rhythm contract (mirrors the hardcoded Contact / About pages):
// • Body (P): marginBottom 2rem (32 px = gap-8 used across the hardcoded layouts).
// • Headers (H2/H3/H4): marginTop only — they "stick" to the following block.
//   Big air above (3.5 / 2.5 / 1.5 rem) signals the start of a section.
// • First block: marginTop suppressed so the body opens flush under the page H1.
// Sizes follow the brand hierarchy: H2 dominates, H3 clearly above body,
// H4 only subtly above. Matches the visual scale of /contact and /about.
const EDITORIAL_COMPONENTS: Partial<PortableTextReactComponents> = {
  block: {
    normal: ({ children, index }) => (
      <p
        className={`${EDITORIAL_BODY} whitespace-pre-line`}
        style={{ marginBottom: '2rem' }}
        data-block-index={index}
      >
        {children}
      </p>
    ),
    h2: ({ children, index }) => (
      <h2
        className="text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]"
        style={{
          marginTop: index === 0 ? 0 : '3.5rem',
          marginBottom: 0,
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children, index }) => (
      <h3
        className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-fg)]"
        style={{
          marginTop: index === 0 ? 0 : '2.5rem',
          marginBottom: 0,
        }}
      >
        {children}
      </h3>
    ),
    h4: ({ children, index }) => (
      <h4
        className="text-[24px] md:text-[36px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--color-fg)]"
        style={{
          marginTop: index === 0 ? 0 : '1.5rem',
          marginBottom: 0,
        }}
      >
        {children}
      </h4>
    ),
  },
  marks: SHARED_MARKS,
};
