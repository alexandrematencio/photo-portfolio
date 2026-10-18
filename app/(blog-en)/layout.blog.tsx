import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { BlogShell, blogLayoutMetadata, blogViewport } from '@/components/journal/BlogShell';

/**
 * Layout RACINE du journal en anglais — un par langue, pour que
 * `<html lang>` dise la vérité à chaque page (components/journal/BlogShell.tsx).
 */
export const metadata: Metadata = blogLayoutMetadata('en');
export const viewport: Viewport = blogViewport;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <BlogShell lang="en">{children}</BlogShell>;
}
