import type { Metadata } from "next";
import { Chakra_Petch, Figtree } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";
import { withBase } from "@/lib/base-path";

// Figtree matches the typography used on the Bailey Partnership report cover.
// `variable` exposes it as a CSS custom property so globals.css can compose it
// into --font-sans alongside system fallbacks.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

// Chakra Petch is used only for the "Siteboard" wordmark (font-wordmark).
const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-chakra-petch",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bailey Partnership Siteboard",
  description:
    "Keep your projects in sight. Read-only dashboards for Issues, RFIs, Forms and Reviews across Autodesk Forma projects.",
  // Siteboard "S" mark: favicon.ico for browser tabs, a PNG for browsers
  // that prefer one, and a 180px icon for phone home screens.
  icons: {
    icon: [
      { url: withBase("/favicon.ico"), sizes: "any" },
      { url: withBase("/siteboard-icon.png"), type: "image/png", sizes: "256x256" },
    ],
    apple: withBase("/apple-touch-icon.png"),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${chakraPetch.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
