import type { NextConfig } from 'next';

// Next writes rewrites and headers into the build, so set API_ORIGIN when running `next build`.
const API_ORIGIN = (process.env.API_ORIGIN ?? 'http://localhost:4000').replace(/\/+$/, '');

// Static pages can't carry a per-request nonce, so inline scripts stay allowed. Scripts from other
// sites don't, which matters because the login is kept in local storage.
const isDev = process.env.NODE_ENV === 'development';
const contentSecurityPolicy = [
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  // Lets the browser call the API through this site. For local development; see the README.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
