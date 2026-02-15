import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Instrument_Sans, Inter, Manrope } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Ch26",
  description: "RAG retrieval system playground",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={[
          manrope.variable,
          instrumentSans.variable,
          fraunces.variable,
          plexMono.variable,
          inter.variable,
          "min-h-dvh",
          "font-sans",
          "antialiased",
          "leading-[1.45]",
          "text-foreground",
          "bg-[linear-gradient(to_bottom,var(--ch26-shell-from),var(--ch26-shell-to))]",
          "selection:bg-[color-mix(in_srgb,var(--accent)_28%,transparent)]",
          "selection:text-foreground",
          "[text-rendering:optimizeLegibility]",
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}
