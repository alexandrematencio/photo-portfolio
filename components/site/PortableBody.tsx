import { PortableText, type PortableTextBlock } from '@portabletext/react';

type Props = {
  value?: PortableTextBlock[] | unknown[];
  fallback?: React.ReactNode;
};

export function PortableBody({ value, fallback }: Props) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return <>{fallback}</>;
  }
  return (
    <div className="prose-content">
      <PortableText
        value={value as PortableTextBlock[]}
        components={{
          block: {
            normal: ({ children }) => (
              <p className="mb-5 text-base md:text-lg leading-relaxed text-[var(--color-fg)]">
                {children}
              </p>
            ),
            h2: ({ children }) => (
              <h2 className="mt-12 mb-4 font-bold uppercase text-xl md:text-2xl tracking-tight">
                {children}
              </h2>
            ),
          },
          marks: {
            link: ({ children, value }) => (
              <a
                href={value?.href}
                className="underline underline-offset-4 hover:text-[var(--color-accent)]"
                rel="noopener noreferrer"
                target={value?.href?.startsWith('http') ? '_blank' : undefined}
              >
                {children}
              </a>
            ),
            em: ({ children }) => <em className="font-medium">{children}</em>,
            strong: ({ children }) => (
              <strong className="font-semibold">{children}</strong>
            ),
          },
        }}
      />
    </div>
  );
}
