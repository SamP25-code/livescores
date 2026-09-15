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
      </div>
      <LiveNowBanner />
      <NightNav variant="home" />

      <details className="how-it-works">
        <summary>How this works</summary>
        <div className="how-it-works-body">
          <p>
            Four qualifying nights, 16 players each, straight knockout (first to 21). The top 4 from each
            night go through to Finals Day.
          </p>
          <p>Finals Day is those 16 qualifiers playing down to a single winner.</p>
          <p>
            <strong>TBC</strong> means that spot isn&rsquo;t decided yet. <strong>BYE</strong> means that
            match was skipped (an odd number of players that round) and the other side goes through
            automatically.
          </p>
          <p>Scores update live on their own &mdash; no need to refresh the page.</p>
        </div>
      </details>
    </div>
  );
}
