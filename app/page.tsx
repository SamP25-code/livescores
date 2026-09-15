"use client";

import Link from "next/link";
import NightNav from "@/components/NightNav";
import Brand from "@/components/Brand";
import LiveNowBanner from "@/components/LiveNowBanner";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="page">
      <div className="top-bar">
        <Brand />
        <nav>
          <Link href="/admin">Log in</Link>
        </nav>
      </div>

      <div className="home-hero">
        <h1>Results</h1>
        <p className="hint">Pick a night below to see its live scores.</p>
        <p className="hint">The draw and results update automatically &mdash; no need to refresh the page.</p>
      </div>
      <LiveNowBanner />
      <NightNav variant="home" />
    </div>
  );
}
