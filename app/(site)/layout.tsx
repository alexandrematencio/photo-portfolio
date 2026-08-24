import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FramedScroll } from '@/components/site/FramedScroll';
import { MainPadding } from '@/components/site/MainPadding';
import { MobileMenu } from '@/components/site/MobileMenu';
import { TopBarAutoHide } from '@/components/site/TopBarAutoHide';
import { CursorInvert } from '@/components/site/CursorInvert';
import { EmailHoneypot } from '@/components/site/EmailHoneypot';
import { SiteSessionMarker } from '@/components/site/SiteSessionMarker';
import { PhotoGuard } from '@/components/site/PhotoGuard';

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
      {/* Clic droit + glisser-déposer neutralisés sur les images du site
          (jamais dans /studio, hors de ce groupe de routes). Ralentisseur et
          signal, PAS une protection — cf. le commentaire du composant. */}
      <PhotoGuard />
      <SiteHeader />
      {/* Mobile menu rendered once for the whole (site) group — works on home and editorial pages alike. */}
      <MobileMenu />
      {/* Mode « scroll-triggered » de la barre du haut mobile : cache glyph +
          MENU au défilement descendant sur toutes les pages sauf la home
          (cf. lib/site/top-bar.ts). Ne rend rien. */}
      <TopBarAutoHide />
      {/* Desktop-only cursor inversion disc — triggers on elements with `data-cursor-invert`.
          Lives at the layout root (not inside any transformed/isolated container) so the
          mix-blend-mode can blend against everything painted underneath the viewport. */}
      <CursorInvert />
      {/* Honeypot mailto:trap-* — invisible aux humains, scrapé par les bots HTML naïfs.
          Couple ça à un filtre ProtonMail "To: contient 'trap-' → trash" pour anti-spam auto. */}
      <EmailHoneypot />
      {/* Le footer est passé À PART, pas en second enfant : FramedScroll le
          pose HORS de la colonne min-h-full, donc juste sous l'horizon plutôt
          qu'épinglé au bas de l'écran sur les pages courtes. */}
      <FramedScroll footer={<SiteFooter />}>
        <MainPadding>{children}</MainPadding>
      </FramedScroll>
    </>
  );
}
