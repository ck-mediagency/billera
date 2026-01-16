import "./globals.css";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import AuthGate from "@/components/AuthGate";

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#ffffff" />

        {/* iOS PWA Support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Money App" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>

      <body className={ibmArabic.className}>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
