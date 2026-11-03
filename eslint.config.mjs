// ESLint 9, flat config. `next lint` a disparu de Next 16 : on appelle eslint directement.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'out/**', 'dist/**', 'node_modules/**', 'next-env.d.ts', 'public/**'],
  },
  {
    rules: {
      // Export statique + `images.unoptimized` : <Image> n'optimise rien ici,
      // le CDN Sanity redimensionne (lib/sanity/image). <img> est le bon outil.
      '@next/next/no-img-element': 'off',
      // `const { a: _a, ...rest } = x` : retirer une clé est voulu.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // Règles React Compiler (eslint-plugin-react-hooks 7). Le compilateur n'est
      // pas activé : ce ne sont pas des bugs, mais une dette à résorber au fil
      // des retouches (audit 2026-11, 1.1 / 1.6). Visibles, non bloquantes.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/globals': 'warn',
    },
  },
];

export default config;
