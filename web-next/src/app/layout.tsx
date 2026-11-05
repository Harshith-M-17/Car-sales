import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { APP_NAME } from '@/lib/config';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Used cars from local dealers`, template: `%s · ${APP_NAME}` },
  description: 'Buy used cars directly from trusted local dealers. Compare cars in your city, then call, WhatsApp or visit the dealer.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#4338ca' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
