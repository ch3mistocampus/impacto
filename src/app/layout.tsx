import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/AppHeader";

const sans = Inter({ variable: "--font-sans-src", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display-src", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Impacto",
  description:
    "Recuperación transparente: necesidades verificadas, materiales donados e impacto real. / Transparent recovery: verified needs, donated materials, real impact.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#b4532a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <AppHeader />
          <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
