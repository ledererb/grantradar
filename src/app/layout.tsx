import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "GrantRadar — Pályázati Támogatásfigyelő Vállalkozásoknak",
    template: "%s | GrantRadar",
  },
  description:
    "Találd meg a vállalkozásod számára elérhető magyar és uniós pályázatokat egyetlen átlátható felületen. Gyors előszűrés, jogosultsági elemzés és határidő-értesítések.",
  keywords: [
    "pályázat",
    "KKV támogatás",
    "GINOP Plusz",
    "DIMOP Plusz",
    "KAP",
    "Széchenyi Terv Plusz",
    "pályázatfigyelő",
    "vállalkozói támogatás",
  ],
  authors: [{ name: "GrantRadar" }],
  openGraph: {
    type: "website",
    locale: "hu_HU",
    url: "https://grantradar.hu",
    siteName: "GrantRadar",
    title: "GrantRadar — Pályázati Támogatásfigyelő Vállalkozásoknak",
    description:
      "Találd meg a vállalkozásod számára elérhető támogatásokat egyszerűen, egyetlen felületen.",
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
    <html lang="hu" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('color-scheme');var m=document.querySelector('meta[name=\"color-scheme\"]');if(m&&(s==='dark'||s==='light'||s==='light dark'))m.content=s;}catch(e){}",
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
