"use client";

import Link from "next/link";
import NightNav from "@/components/NightNav";
import Brand from "@/components/Brand";
import LiveNowBanner from "@/components/LiveNowBanner";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <div className="top-bar">
        <Brand />
      </div>

      <div className="home-hero">
        <h1>October Singles 2026</h1>
        <p className="hint home-times">
          <strong>Qualifying nights</strong>
          <span>Practice 6:30pm &middot; Start 7pm</span>
        </p>
        <p className="hint home-times">
          <strong>Finals Day</strong>
          <span>Practice 12:30pm &middot; Start 1pm</span>
        </p>
      </div>
      <LiveNowBanner />
      <NightNav variant="home" />

      <nav className="page-footer-nav">
        <Link href="/admin">Log in</Link>
      </nav>
    </div>
  );
}
