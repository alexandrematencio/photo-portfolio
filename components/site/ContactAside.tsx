import Link from 'next/link';
import { PortableBody } from './PortableBody';
import { ProtectedEmail } from './ProtectedEmail';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * L'encart Contact de /about (2026-10-17) : Contact a quitté le menu, il doit
 * rester à portée de main là où on vient lire qui est l'auteur. Le texte est
 * celui de la page /contact (`contactBlocks`), pas une copie — un Publish dans
 * le Studio change les deux à la fois.
 *
 * Mise en page portée par /about : colonne de droite collante au-dessus de
 * `lg`, où le texte, calé à gauche sur sa mesure, laisse la place ; bloc
 * d'en-tête sous le titre en dessous, avant la bio. Le texte passe en variante
 * `default` (16/18) : l'encart accompagne la bio, il ne doit pas parler aussi
 * fort qu'elle. L'écart entre ses paragraphes vit dans `globals.css`
 * (`[data-contact-aside]`) — le reset avale les marges Tailwind de la variante.
 */
export function ContactAside({ blocks, className }: { blocks: unknown[]; className?: string }) {
  return (
    <aside
      aria-labelledby="contact-aside-title"
      data-contact-aside
      className={cn('flex flex-col', className)}
      style={{ borderTop: '2px solid var(--color-fg)', paddingTop: 14, gap: 18 }}
    >
      <Link
        id="contact-aside-title"
        href="/contact"
        className={cn(MICRO_LABEL, 'group flex items-center justify-between text-[var(--color-fg)]')}
      >
        Contact
        <span
          aria-hidden
          className="text-[var(--color-fg-muted)] transition-[translate,color] duration-200 ease-out group-hover:translate-x-[3px] group-hover:text-[var(--color-fg)] motion-reduce:transition-none"
        >
          →
        </span>
      </Link>
      <PortableBody
        value={blocks}
        fallback={
          <ProtectedEmail className="underline underline-offset-4">Write to me</ProtectedEmail>
        }
      />
    </aside>
  );
}
