import type { Metadata } from "next";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { getBranding, getLanguage } from "@/lib/settings";
import { I18nProvider } from "@/lib/i18n";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const { appName, favicon } = await getBranding();
  return {
    title: {
      default: appName,
      template: `%s · ${appName}`,
    },
    description: "Open-source attendance management system",
    icons: favicon ? { icon: favicon } : undefined,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLanguage();
  return (
    <html
      lang={locale}
      className={cn("font-sans", geist.variable, geistMono.variable)}
    >
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
