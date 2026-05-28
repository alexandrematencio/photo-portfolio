import Link from 'next/link';
import { ChevronRight, Mail, Send } from 'lucide-react';
import { asset } from '@/lib/utils/asset';

const YEAR = new Date().getFullYear();
const EMAIL = 'amatencio@pm.me';
const HANDLE = '@BaronMuster';

const SITE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/archives', label: 'Archives' },
  { href: '/contact', label: 'Contact' },
  { href: '/digital-agency', label: 'Digital Agency' },
  { href: '/socials', label: 'Socials' },
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
  const copyright = `©${YEAR} / All Rights Reserved`;
  return (
    <footer className="bg-[#151312] text-[#888888] flex justify-center">
      {/* Mobile: vertical stack, left-aligned, 32px horizontal margin, 32px bottom padding,
          64px top padding. Desktop: 3-column row, 128px horizontal padding, 64px top/bottom.
          Padding handled via .site-footer-container in globals.css — Tailwind utilities for
          padding were occasionally missed by Turbopack's hot-reload, raw CSS is reliable. */}
      <div
        className="site-footer-container w-full max-w-[1080px] flex flex-col md:flex-row md:items-start md:justify-between gap-12 md:gap-8"
      >
        {/* ─── COL 1 — logo-block (vertical, gap 16) ─── */}
        <div className="flex flex-col gap-4">
          {/* logo-glyph 64×60 */}
          <img
            src={asset('/img/logos/glyph-alxmtnc-gray.svg')}
            alt=""
            width={64}
            height={60}
            className="block"
          />
          {/* text-content — vertical, gap 8 */}
          <div className="flex flex-col gap-2">
            {/* signature — vertical, no gap. Level 1: name in black 900. Level 4: subtitle normal. */}
            <div>
              <div className="text-[16px] font-black tracking-[-0.02em] text-[#888888]">
                A. Matencio
              </div>
              <div className="text-[12px] font-normal tracking-[-0.02em] text-[#888888]">
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
          {/* studio location — Level 2 section label (uppercase + tracking-wide). */}
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#888888]">
            Studio based in Villejuif, 94
          </p>

          {/* social-media (vertical, gap 4) */}
          <div className="flex flex-col gap-1">
            {/* email — horizontal, gap 8, items-center */}
            <div className="flex items-center gap-2">
              <Mail size={12} strokeWidth={1.5} className="text-[#5a5a5a] shrink-0" />
              <a
                href={`mailto:${EMAIL}`}
                className="text-[16px] italic font-medium tracking-[-0.02em] text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
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
                className="text-[16px] italic font-medium tracking-[-0.02em] text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
              >
                {HANDLE}
              </a>
            </div>
            {/* details — response time. Level 4 fine print: smaller + normal weight. */}
            <p className="text-[12px] font-normal tracking-[-0.02em] text-[#5a5a5a]">
              Typically responds within 72 hours
            </p>
          </div>
        </div>

        {/* ─── COL 3 — footer-nav-block.
            Mobile: stacks vertically (Site nav above Information nav, both left-aligned).
            Desktop: horizontal row, navs side-by-side, copyright pushed to bottom-right. */}
        <div className="flex flex-col md:flex-row md:justify-end md:items-stretch md:self-stretch gap-8 md:gap-14">
          {/* left-nav-column — Site */}
          <nav aria-labelledby="footer-site" className="flex flex-col gap-4">
            {/* Level 2 section label: bold + uppercase + tracking-wide. */}
            <h2 id="footer-site" className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#888888]">
              Site
            </h2>
            <ul className="flex flex-col gap-3">
              {SITE_LINKS.map((link) => (
                <li key={link.href} className="flex items-center gap-1">
                  <ChevronRight size={10} strokeWidth={2} className="text-[#5a5a5a] shrink-0" />
                  {/* Level 3 clickable: medium weight, readable but quiet. */}
                  <Link
                    href={link.href}
                    className="text-[12px] font-medium tracking-[-0.02em] leading-none text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* right-nav-column-container.
              Mobile: simple vertical stack (Information nav only — copyright moved out).
              Desktop: justify-between + self-stretch to push copyright to the bottom-right corner. */}
          <div className="flex flex-col md:justify-between md:self-stretch gap-8 md:gap-32">
            {/* right-nav-column — Information */}
            <nav aria-labelledby="footer-info" className="flex flex-col gap-4">
              {/* Level 2 section label: bold + uppercase + tracking-wide. */}
              <h2 id="footer-info" className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#888888]">
                Information
              </h2>
              <ul className="flex flex-col gap-3">
                {INFO_LINKS.map((link) => (
                  <li key={link.href} className="flex items-center gap-1">
                    <ChevronRight size={10} strokeWidth={2} className="text-[#5a5a5a] shrink-0" />
                    {/* Level 3 clickable: medium weight. */}
                    <Link
                      href={link.href}
                      className="text-[12px] font-medium tracking-[-0.02em] leading-none text-[#888888] hover:text-white transition-colors motion-reduce:transition-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Copyright — DESKTOP only. Pushed to bottom-right via justify-between + self-stretch.
                On mobile, see the separate centered copyright at the very bottom of the footer. */}
            <p className="hidden md:block text-[12px] font-normal tracking-[-0.02em] text-[#5a5a5a]">
              {copyright}
            </p>
          </div>
        </div>

        {/* Copyright — MOBILE only. Centered, locked to bottom of footer (pb-8 = 32px on the
            parent container). Hidden on desktop where the inline copyright above takes over. */}
        <p className="md:hidden text-center text-[12px] font-normal tracking-[-0.02em] text-[#5a5a5a]">
          {copyright}
        </p>
      </div>
    </footer>
  );
}
