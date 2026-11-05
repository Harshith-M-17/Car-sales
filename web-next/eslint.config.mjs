import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The API already resizes every photo to WebP and serves it with long cache headers;
      // next/image would process each one a second time.
      '@next/next/no-img-element': 'off',
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'next/link', message: 'Use @/components/Link, which turns off automatic prefetching.' }] },
      ],
    },
  },
  { files: ['src/components/Link.tsx'], rules: { 'no-restricted-imports': 'off' } },
];

export default config;
