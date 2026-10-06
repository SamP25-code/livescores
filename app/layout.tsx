import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import SentryInit from "@/components/SentryInit";

// A narrow scoreboard-style face for headings, scores and numbers, and a
// plain humanist sans for names and everything else. Both come from the
// Fontsource packages (the same Google fonts, open licence) rather than
// being fetched from Google during the build, so a Google Fonts hiccup can
// never stop the site deploying.
const display = localFont({
  src: [
    { path: "../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff2", weight: "500" },
    { path: "../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2", weight: "700" },
  ],
  style: "normal",
  display: "swap",
  variable: "--font-display",
});

// One variable-weight file covers 400-700.
const body = localFont({
  src: "../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2",
  weight: "200 900",
  style: "normal",
  display: "swap",
  variable: "--font-body",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.VERCEL_URL ?? "localhost:3000"}`),
  title: "Penwortham Singles",
  description: "Live scores from the October Singles at Penwortham Sports & Social Club",
  openGraph: {
    title: "Penwortham Singles",
    description: "Live scores from the October Singles at Penwortham Sports & Social Club",
    images: ["/bowls-background.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <SentryInit />
        {!isSupabaseConfigured && (
          <div
            style={{
              background: "#7a2e2e",
              color: "#fff",
              padding: "10px 16px",
              fontSize: "0.85rem",
              textAlign: "center",
            }}
          >
            Supabase isn&rsquo;t configured for this deployment set NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY for this environment and redeploy.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
