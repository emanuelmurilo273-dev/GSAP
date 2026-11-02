import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SiteHunter AI — Encontre clientes. Crie sites. Venda mais.", template: "%s · SiteHunter AI" },
  description: "Encontre empresas que possivelmente ainda não têm site, gere sites profissionais com IA, publique e prepare propostas comerciais em uma única plataforma.",
};

export const viewport: Viewport = { themeColor: "#04060b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
