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

// Chakra Petch (Holdpoint's display face): page titles, stat numbers and the
// SITEBOARD wordmark only, never body text.
const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra-petch",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bailey Partnership Siteboard",
  description:
    "Keep your projects in sight. Read-only dashboards for Issues, RFIs, Forms and Reviews across Autodesk Forma projects.",
  // Siteboard mark (Holdpoint family: diamond outline, board of tiles):
  // SVG and ICO for browser tabs, PNGs for others, 180px for phone home screens.
  icons: {
    icon: [
      { url: withBase("/favicon.ico"), sizes: "any" },
      { url: withBase("/siteboard-mark.svg"), type: "image/svg+xml" },
      { url: withBase("/siteboard-icon.png"), type: "image/png", sizes: "512x512" },
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
