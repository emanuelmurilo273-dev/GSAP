import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_NAME } from '@/components/Logo';
import { RiskBanner } from '@/components/ui';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: { default: `${APP_NAME} · mesa de 6 agentes para cripto`, template: `%s · ${APP_NAME}` },
  description: 'Robô de criptomoedas com mesa de 6 agentes operando 24h na SUA conta da corretora. Não custodial, chave sem saque, stop em toda ordem.',
  openGraph: { title: `${APP_NAME} · mesa de 6 agentes para cripto`, description: 'Opera na sua corretora, 24h, com stop em toda ordem. Nunca guardamos seu dinheiro.', type: 'website', locale: 'pt_BR' },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#05070a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-bg focus:px-3 focus:py-2">Pular para o conteúdo</a>
        <div id="conteudo">{children}</div>
        <RiskBanner />
      </body>
    </html>
  );
}
