import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FramedScroll } from '@/components/site/FramedScroll';
import { MainPadding } from '@/components/site/MainPadding';
import { MobileMenu } from '@/components/site/MobileMenu';
import { CursorInvert } from '@/components/site/CursorInvert';
import { SiteSessionMarker } from '@/components/site/SiteSessionMarker';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Tracks "user has loaded at least one (site) page in this tab" via
          sessionStorage, so the splash on / can distinguish a genuine first
          arrival from any subsequent internal navigation back to /. */}
      <SiteSessionMarker />
      <SiteHeader />
      {/* Mobile menu rendered once for the whole (site) group — works on home and editorial pages alike. */}
      <MobileMenu />
      {/* Desktop-only cursor inversion disc — triggers on elements with `data-cursor-invert`.
          Lives at the layout root (not inside any transformed/isolated container) so the
          mix-blend-mode can blend against everything painted underneath the viewport. */}
      <CursorInvert />
      <FramedScroll>
        <MainPadding>{children}</MainPadding>
        <SiteFooter />
      </FramedScroll>
    </>
  );
}
