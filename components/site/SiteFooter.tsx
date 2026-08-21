import Link from 'next/link';

/**
 * Exact replication of the footer in resources/alxmtc-footer.pen (full scan).
 * Structure is 5 direct flex children inside main-container, space-between.
 * No grouping of middle items. Glyph is the exact gray asset. Icon paths matched.
 *
 * Gouttières : 32 px de chaque côté — valeur relevée dans le .pen
 * (main-container `padding: [16, 32]`, logo à x=32, « legal notice » finissant
 * à 1728−32) et cohérente avec les 32 px de toutes les autres pages.
 *
 * ⚠️ Padding en style INLINE, pas `px-8` : le reset global `* {padding:0}`
 * d'app/globals.css vit HORS @layer et écrase donc toutes les utilities
 * Tailwind de padding. C'est exactement pourquoi le footer n'avait AUCUNE
 * marge latérale malgré son `px-6`. Corollaire : le padding ne peut pas être
 * responsive (un style inline ne connaît pas les media queries) — d'où une
 * hauteur pilotée par le CONTENU (16 + 38 + 16 = 70 px sur une ligne) plutôt
 * que par une hauteur fixe qu'il faudrait décliner par breakpoint.
 *
 * Sous `md`, la rangée passe en `flex-wrap` : les cinq enfants ne tiennent pas
 * sur 326 px et le footer se faisait couper à droite (le conteneur de scroll
 * est en `overflow-x-hidden` — rien ne le signalait, le contenu disparaissait
 * simplement). L'ordre et la structure « 5 enfants directs » du .pen sont
 * conservés : c'est le retour à la ligne qui gère l'étroitesse.
 */
export function SiteFooter() {
  return (
    <footer
      className="w-full shrink-0 md:h-[70px] bg-[#151312] text-[#888888]"
      data-site-footer
    >
      {/* Le fond sombre file jusqu'aux bords ; seul le contenu est en retrait.
          70 px verrouillés au-dessus de `md` (16 + 38 + 16, la hauteur du
          main-container du .pen) : /series calcule la hauteur de sa scène à
          partir de ce nombre pour tenir pile dans l'écran — un footer dont la
          hauteur dériverait avec le contenu ferait dériver la page avec lui. */}
      <div
        className="md:flex md:h-full md:items-center"
        style={{
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <div className="flex w-full flex-wrap items-center gap-x-8 gap-y-4 md:flex-nowrap md:justify-between lg:gap-x-32">
        {/* Child 1: logo (exact glyph asset + vertical texts, gap 24) */}
        <Link
          href="/"
          className="flex items-center gap-6 shrink-0"
          aria-label="A. Matencio — home"
        >
          <img
            src="/img/logos/glyph-alxmtnc-gray.svg"
            width={32}
            height={30}
            alt=""
            className="block"
          />
          <div className="flex flex-col justify-center leading-none">
            <div className="text-[16px] font-bold tracking-[-0.02em]">
              ALEXANDRE MATENCIO
            </div>
            <div className="text-[12px] tracking-[-0.015em]">
              ©2006 / All Right Reserved
            </div>
          </div>
        </Link>

        {/* Child 2: PHOTOGRAPHY (direct sibling, per pen) */}
        <Link
          href="/archives"
          className="text-[16px] font-bold tracking-[-0.02em] hover:text-white transition-colors motion-reduce:transition-none"
        >
          PHOTOGRAPHY
        </Link>

        {/* Child 3: DIGITAL AGENCY (direct sibling, per pen) */}
        <Link
          href="/about/digital-agency"
          className="text-[16px] font-bold tracking-[-0.02em] hover:text-white transition-colors motion-reduce:transition-none"
        >
          DIGITAL AGENCY
        </Link>

        {/* Child 4: CONTACT (direct sibling, per pen) */}
        <Link
          href="/contact"
          className="text-[16px] font-bold tracking-[-0.02em] hover:text-white transition-colors motion-reduce:transition-none"
        >
          CONTACT
        </Link>

        {/* Child 5: legal notice (icon + LEGAL NOTICE, gap 8 inside, exact pen icon structure) */}
        <Link
          href="/legal"
          className="flex items-center gap-2 shrink-0 hover:text-white transition-colors motion-reduce:transition-none"
        >
          <span className="inline-flex items-center p-[1px] pr-[3px]">
            <svg
              width="10"
              height="14"
              viewBox="0 0 10 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="text-[#888888]"
            >
              {/* Vertical line - matches pen */}
              <path d="M1 0.5v13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              {/* Flag shape - matches pen path geometry */}
              <path
                d="M9 7 L1 7 L1 1 L9 1 L6 3.5 L9 7"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-[16px] font-bold tracking-[-0.02em]">
            LEGAL NOTICE
          </span>
        </Link>
      </div>
      </div>
    </footer>
  );
}
