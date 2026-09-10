import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://metaaprender.com.br"),

  title: "Meta Aprender | Todos pela aprendizagem",

  description:
    "Plataforma educacional focada na aprendizagem das crianças.",

  openGraph: {
    title: "Meta Aprender",
    description: "Todos pela aprendizagem das crianças.",
    url: "https://metaaprender.com.br",
    siteName: "Meta Aprender",

    images: [
      {
        url: "/meta-whatsapp.png",
        width: 1200,
        height: 630,
        alt: "Meta Aprender",
      },
    ],

    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" className="scroll-smooth">
      <body
        className={`${inter.variable} ${oswald.variable} bg-[#0A192F] text-white antialiased overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}