import Link from 'next/link';
import { ChevronRight, Mail, Send } from 'lucide-react';

const YEAR = new Date().getFullYear();
const EMAIL = 'amatencio@pm.me';
const HANDLE = '@BaronMuster';

const SITE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/flat-gallery', label: 'Flat gallery' },
  { href: '/contact', label: 'Contact' },
  { href: '/hire-me', label: 'Hire me' },
];

const INFO_LINKS = [
  { href: '/legal', label: 'Legal Notice' },
  { href: '/privacy', label: 'Privacy Policy' },
];

/**
 * Footer global — templates.pen frame "footer" (AiN8Y) / main-container (RxljR).
 *
 *   footer (bg #151312, full-bleed)
 *   └── main-container (HORIZONTAL, gap 32, justify space-between, alignItems
 *                       center, padding [32,128], width 1078)
 *       ├── logo-block (vertical, gap 16)
 *       │     ├── logo-glyph 64×60
 *       │     └── text-content (vertical, gap 8)
 *       │           ├── signature
 *       │           │   ├── "A. Matencio" 16/700
 *       │           │   └── "Author Photography" 12/700
 *       │           └── description italic 12 normal
 *       │
 *       ├── contact-block (vertical, gap 32)
 *       │     ├── "Studio based in Villejuif, 94" 16/700
 *       │     └── social-media (vertical, gap 4)
 *       │           ├── email   (Mail icon + amatencio@pm.me italic/700)
 *       │           ├── telegram (Send icon + @BaronMuster italic/700)
 *       │           └── "Typically responds within 72 hours" 16/normal
 *       │
 *       └── footer-nav-block (horizontal, gap 56, justify end, h-full)
 *             ├── left-nav-column (Site + 5 items)
 *             └── right-nav-column-container (vertical, gap 128, space-between, h-full)
 *                   ├── right-nav-column (Information + 2 items)
 *                   └── copyright pushed bottom
 */
export function SiteFooter() {
  return (
    <footer className="bg-[#151312] text-[#888888] flex justify-center">
      <div
        className="w-full max-w-[1080px] flex flex-col md:flex-row md:items-start md:justify-between gap-12 md:gap-8 px-6 md:px-32"
        style={{ paddingTop: 64, paddingBottom: 64 }}
      >
        {/* ─── COL 1 — logo-block (vertical, gap 16) ─── */}
        <div className="flex flex-col gap-4">
          {/* logo-glyph 64×60 */}
          <img
            src="/img/logos/glyph-alxmtnc-gray.svg"
            alt=""
            width={64}
            height={60}
            className="block"
          />
          {/* text-content — vertical, gap 8 */}
          <div className="flex flex-col gap-2">
            {/* signature — vertical, no gap */}
            <div>
              <div className="text-[16px] font-bold tracking-[-0.02em] text-[#888888]">
                A. Matencio
              </div>
              <div className="text-[12px] font-bold tracking-[-0.02em] text-[#888888]">
                Author Photography
              </div>
            </div>
            {/* description — italic, normal weight, 12px */}
            <p className="text-[12px] italic font-normal tracking-[-0.02em] text-[#5a5a5a] leading-snug whitespace-pre-line">
              {`Street photography
Landscape/Cityscape
Portraits`}
            </p>
          </div>
        </div>

        {/* ─── COL 2 — contact-block (vertical, gap 32) ─── */}
        <div className="flex flex-col gap-8">
          {/* studio location */}
          <p className="text-[16px] font-bold tracking-[-0.02em] text-[#888888]">
            Studio based in Villejuif, 94
          </p>

          {/* social-media (vertical, gap 4) */}
          <div className="flex flex-col gap-1">
            {/* email — horizontal, gap 8, items-center */}
            <div className="flex items-center gap-2">
              <Mail size={12} strokeWidth={1.5} className="text-[#5a5a5a] shrink-0" />
              <a
                href={`mailto:${EMAIL}`}
                className="text-[16px] italic font-bold tracking-[-0.02em] text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
              >
                {EMAIL}
              </a>
            </div>
            {/* telegram — horizontal, gap 8, items-center */}
            <div className="flex items-center gap-2">
              <Send size={12} strokeWidth={1.5} className="text-[#5a5a5a] shrink-0" />
              <a
                href="https://t.me/BaronMuster"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[16px] italic font-bold tracking-[-0.02em] text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
              >
                {HANDLE}
              </a>
            </div>
            {/* details — response time */}
            <p className="text-[16px] font-normal tracking-[-0.02em] text-[#5a5a5a]">
              Typically responds within 72 hours
            </p>
          </div>
        </div>

        {/* ─── COL 3 — footer-nav-block (horizontal, gap 56, justify end, h-full) ─── */}
        <div className="flex flex-row justify-end items-stretch self-stretch gap-14">
          {/* left-nav-column — Site */}
          <nav aria-labelledby="footer-site" className="flex flex-col gap-4">
            <h2 id="footer-site" className="text-[16px] font-bold tracking-[-0.02em] text-[#888888]">
              Site
            </h2>
            <ul className="flex flex-col gap-3">
              {SITE_LINKS.map((link) => (
                <li key={link.href} className="flex items-center gap-1">
                  <ChevronRight size={10} strokeWidth={2} className="text-[#5a5a5a] shrink-0" />
                  <Link
                    href={link.href}
                    className="text-[12px] font-bold tracking-[-0.02em] leading-none text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* right-nav-column-container — vertical, gap 128 + justify space-between, h-full */}
          <div className="flex flex-col justify-between self-stretch gap-32">
            {/* right-nav-column — Information */}
            <nav aria-labelledby="footer-info" className="flex flex-col gap-4">
              <h2 id="footer-info" className="text-[16px] font-bold tracking-[-0.02em] text-[#888888]">
                Information
              </h2>
              <ul className="flex flex-col gap-3">
                {INFO_LINKS.map((link) => (
                  <li key={link.href} className="flex items-center gap-1">
                    <ChevronRight size={10} strokeWidth={2} className="text-[#5a5a5a] shrink-0" />
                    <Link
                      href={link.href}
                      className="text-[12px] font-bold tracking-[-0.02em] leading-none text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* copyright — pushed to bottom via justify-between */}
            <p className="text-[12px] font-bold tracking-[-0.02em] text-[#5a5a5a]">
              ©{YEAR} / All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
