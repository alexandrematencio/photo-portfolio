type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function PageShell({ title, subtitle, children }: Props) {
  return (
    <article className="mx-auto max-w-3xl px-4 md:px-8 pt-16 pb-24">
      <header className="mb-12">
        <h1 className="font-black uppercase text-4xl md:text-6xl tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-[var(--color-fg-muted)]">
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </article>
  );
}
