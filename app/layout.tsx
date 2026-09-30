import type { Metadata, Viewport } from "next";
import { Zilla_Slab, Inter } from "next/font/google";
import "./globals.css";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import SentryInit from "@/components/SentryInit";

const display = Zilla_Slab({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
