import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FramedScroll } from '@/components/site/FramedScroll';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <FramedScroll>
        <main id="main">{children}</main>
        <SiteFooter />
      </FramedScroll>
    </>
  );
}
