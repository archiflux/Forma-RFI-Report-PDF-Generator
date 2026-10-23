import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";

// Figtree matches the typography used on the Bailey Partnership report cover.
// `variable` exposes it as a CSS custom property so globals.css can compose it
// into --font-sans alongside system fallbacks.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Forma Dashboards",
  description:
    "Read-only dashboards for Issues, RFIs, Forms and Reviews across Autodesk Forma projects.",
  icons: {
    icon: "/icon-colour.png",
    apple: "/icon-colour.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
