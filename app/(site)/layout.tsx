import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FramedScroll } from '@/components/site/FramedScroll';
import { MainPadding } from '@/components/site/MainPadding';
import { MobileMenu } from '@/components/site/MobileMenu';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      {/* Mobile menu rendered once for the whole (site) group — works on home and editorial pages alike. */}
      <MobileMenu />
      <FramedScroll>
        <MainPadding>{children}</MainPadding>
        <SiteFooter />
      </FramedScroll>
    </>
  );
}
