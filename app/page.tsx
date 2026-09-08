"use client";

import Link from "next/link";
import NightNav from "@/components/NightNav";

// This page is entirely client-rendered (it fetches from Supabase in the
// browser), so there's nothing worth statically prerendering at build time -
// and prerendering it would run the Supabase client during the build, which
// fails the whole build if env vars aren't configured for that environment.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="page">
      <div className="top-bar">
        <span className="brand">Bowls Live</span>
        <nav>
          <Link href="/admin">Admin</Link>
        </nav>
      </div>

      <h1>Results</h1>
      <p className="hint">Pick a night below to see its live scores.</p>
      <NightNav variant="home" />
    </div>
  );
}
