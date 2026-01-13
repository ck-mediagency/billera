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
      <body className={ibmArabic.className}>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
