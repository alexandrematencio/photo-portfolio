import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FramedScroll } from '@/components/site/FramedScroll';
import { MainPadding } from '@/components/site/MainPadding';

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <FramedScroll>
        <MainPadding>{children}</MainPadding>
        <SiteFooter />
      </FramedScroll>
    </>
  );
}
