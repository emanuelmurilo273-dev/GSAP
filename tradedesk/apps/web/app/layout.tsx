import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_NAME, RiskBanner } from '@/components/ui';

export const metadata: Metadata = {
  title: `${APP_NAME} · mesa de trading automática`,
  description: 'Robô de criptomoedas com mesa de 6 agentes operando 24h na SUA conta da corretora. Nunca guardamos seu dinheiro.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#050a07' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RiskBanner />
      </body>
    </html>
  );
}
