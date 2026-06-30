import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "GrantRadar — Magyar és EU Pályázatfigyelő",
    template: "%s | GrantRadar",
  },
  description:
    "Fedezze fel a legfrissebb magyar és európai pályázatokat KKV-k számára. AI-alapú elemzések, szemantikus keresés, automatikus értesítések.",
  keywords: [
    "pályázat",
    "KKV",
    "GINOP",
    "EU pályázat",
    "Széchenyi Terv",
    "pályázatfigyelő",
    "grant",
    "SME funding",
    "Horizon Europe",
  ],
  authors: [{ name: "GrantRadar" }],
  openGraph: {
    type: "website",
    locale: "hu_HU",
    url: "https://grantradar.hu",
    siteName: "GrantRadar",
    title: "GrantRadar — Magyar és EU Pályázatfigyelő",
    description:
      "AI-alapú pályázatfigyelő platform KKV-k számára. Naponta frissülő adatbázis, szemantikus keresés, személyre szabott értesítések.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
