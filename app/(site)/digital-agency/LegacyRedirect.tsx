'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirection client pour une page déplacée — avec repli cliquable sans JS. */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return (
    <p
      className="text-[17px] font-bold tracking-[-0.02em] text-[var(--color-fg)]"
      style={{ paddingLeft: 32, paddingRight: 32 }}
    >
      This page has moved to{' '}
      <Link href={to} className="underline underline-offset-4">
        {to}
      </Link>
      .
    </p>
  );
}
