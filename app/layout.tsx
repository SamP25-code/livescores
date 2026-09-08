import type { Metadata } from "next";
import { Zilla_Slab, Inter } from "next/font/google";
import "./globals.css";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

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

export const metadata: Metadata = {
  title: "Bowls Live",
  description: "Live knockout results",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
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
            Supabase isn&rsquo;t configured for this deployment &mdash; set NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY for this environment and redeploy.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
