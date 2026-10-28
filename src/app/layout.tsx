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
  icons: {
    icon: withBase("/icon-colour.png"),
    apple: withBase("/icon-colour.png"),
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
