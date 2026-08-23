import {
  PortableText,
  type PortableTextBlock,
  type PortableTextReactComponents,
} from '@portabletext/react';
import { asset } from '@/lib/utils/asset';
import { EmailAddressText, ProtectedEmail } from './ProtectedEmail';
import {
  EDITORIAL_BODY,
  EDITORIAL_LINK_DECORATION,
} from '@/lib/site/typography';

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

/**
 * `mailto:local@domaine[?subject=…]` → les props de `ProtectedEmail`, adresse
 * coupée en deux. Renvoie `null` pour tout ce qui n'est pas un mailto exploitable
 * (l'appelant retombe alors sur le rendu de lien normal).
 */
function parseMailto(
  raw: string
): { local: string; domain: string; subject?: string } | null {
  if (!/^mailto:/i.test(raw)) return null;
  const [addressPart, queryPart = ''] = raw.slice('mailto:'.length).split('?');
  let address: string;
  try {
    address = decodeURIComponent(addressPart).trim();
  } catch {
    address = addressPart.trim();
  }
  // Une seule adresse : un `mailto:` multi-destinataires n'a pas de sens ici et
  // ne doit surtout pas partir en clair, donc on le refuse plutôt que de le
  // rendre à moitié.
  const at = address.indexOf('@');
  if (at <= 0 || at === address.length - 1 || address.includes(',')) return null;
  const subject = new URLSearchParams(queryPart).get('subject') ?? undefined;
  return {
    local: address.slice(0, at),
    domain: address.slice(at + 1),
    subject: subject || undefined,
  };
}

// Explicit mark registration. Sanity's renderer looks up `components.marks[key]`
// by direct property access — a Proxy with a `get` trap silently fails in some
// dispatch paths (e.g. when the lib checks `key in marks` first), so we list
// every brand logo as a real own-property here at module load.
// Le style de lien est passé en paramètre, pas figé : la variante éditoriale
// porte le soulignement épais du brand (le même que les pages en dur), la
// variante `default` garde le lien discret des textes courants. Les DEUX
// marks qui produisent un `<a>` (lien normal, lien email protégé) et le jeton
// `@EMAIL` doivent recevoir la MÊME chaîne — sinon deux liens voisins d'un
// même paragraphe ne se soulignent pas pareil.
const DEFAULT_LINK_CLASS =
  'underline underline-offset-4 hover:text-[var(--color-accent)] transition-colors motion-reduce:transition-none';

const makeMarks = (
  linkClassName: string
): Partial<PortableTextReactComponents['marks']> => ({
  link: ({ children, value }) => {
    const raw = (value?.href ?? '').trim();
    // GARDE-FOU ADRESSE EMAIL. Une annotation lien `mailto:` posée dans le
    // Studio arriverait telle quelle dans le HTML exporté — c'est-à-dire
    // l'adresse en clair, servie statiquement, exactement ce que
    // `ProtectedEmail` existe pour éviter. On ne compte donc PAS sur la
    // discipline de l'éditeur : tout `mailto:` est routé vers le lien
    // protégé, qui recolle l'adresse côté navigateur. Le libellé reste
    // celui écrit dans le Studio (« Write to me », l'adresse, n'importe
    // quoi) — c'est la façon d'obtenir un lien email au libellé libre,
    // là où le jeton `@EMAIL` affiche toujours l'adresse.
    const protectedEmail = parseMailto(raw);
    if (protectedEmail) {
      return (
        <ProtectedEmail {...protectedEmail} className={linkClassName}>
          {children}
        </ProtectedEmail>
      );
    }
    // Telegram shorthand: editor types `@username` as the link URL in Studio,
    // we expand it to https://t.me/username. Strips any leading whitespace or
    // accidental extra `@`.
    const isTelegramHandle = /^@[A-Za-z0-9_]{3,}$/.test(raw);
    const href = isTelegramHandle ? `https://t.me/${raw.slice(1)}` : raw;
    const external = href.startsWith('http');
    return (
      <a
        href={href}
        className={linkClassName}
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
    <ProtectedEmail className={linkClassName}>
      <EmailAddressText />
    </ProtectedEmail>
  ),
});

const DEFAULT_MARKS = makeMarks(DEFAULT_LINK_CLASS);
const EDITORIAL_MARKS = makeMarks(EDITORIAL_LINK_DECORATION);

// LISTES. Le Studio propose les boutons puce / numérotée sur ces champs : sans
// rendu déclaré ici, `@portabletext/react` retombait sur des `<ul>/<li>` nus —
// que le reset universel de `globals.css` (`* { margin: 0; padding: 0 }`) et le
// preflight Tailwind vident de leur retrait ET de leur puce. Résultat à l'écran :
// une liste indiscernable d'un paragraphe, dans la police par défaut du site.
// D'où : styles en `style` inline (le reset vit hors `@layer`, il écrase les
// utilities Tailwind de padding — même piège que le footer, CLAUDE.md §7.6), et
// la typo du corps portée par le `<li>`, pas par le `<ul>`.
function makeListComponents(itemClassName: string, gap: string) {
  return {
    list: {
      bullet: ({ children }: { children?: React.ReactNode }) => (
        <ul
          style={{
            marginBottom: gap,
            paddingLeft: '1.1em',
            listStyleType: 'disc',
            listStylePosition: 'outside',
          }}
        >
          {children}
        </ul>
      ),
      number: ({ children }: { children?: React.ReactNode }) => (
        <ol
          style={{
            marginBottom: gap,
            paddingLeft: '1.4em',
            listStyleType: 'decimal',
            listStylePosition: 'outside',
          }}
        >
          {children}
        </ol>
      ),
    },
    listItem: {
      bullet: ({ children }: { children?: React.ReactNode }) => (
        <li className={itemClassName} style={{ marginBottom: '0.4em' }}>
          {children}
        </li>
      ),
      number: ({ children }: { children?: React.ReactNode }) => (
        <li className={itemClassName} style={{ marginBottom: '0.4em' }}>
          {children}
        </li>
      ),
    },
  };
}

const DEFAULT_LISTS = makeListComponents(
  'text-base md:text-lg leading-relaxed text-[var(--color-fg)]',
  '1.5rem'
);
const EDITORIAL_LISTS = makeListComponents(EDITORIAL_BODY, '2rem');

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
  marks: DEFAULT_MARKS,
  ...DEFAULT_LISTS,
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
  marks: EDITORIAL_MARKS,
  ...EDITORIAL_LISTS,
};
