import type { Metadata, Viewport } from "next";
import { Karla, Source_Serif_4 } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/AppHeader";

const sans = Karla({ variable: "--font-sans-src", subsets: ["latin"] });
const display = Source_Serif_4({
  variable: "--font-display-src",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Impacto",
  description:
    "Recuperación transparente: necesidades verificadas, materiales donados e impacto real. / Transparent recovery: verified needs, donated materials, real impact.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <Suspense fallback={<div aria-hidden className="h-[8.75rem] sm:h-28" />}>
            <AppHeader />
          </Suspense>
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 pb-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
