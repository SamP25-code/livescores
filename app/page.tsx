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
        <p className="hint">Qualifying nights: practice from 6:30pm, play starts at 7pm.</p>
        <p className="hint">Finals Day: practice from 12:30pm, play starts at 1pm.</p>
        <p className="hint">Four go through from each night to Finals Day.</p>
      </div>
      <LiveNowBanner />
      <NightNav variant="home" />

      <nav className="page-footer-nav">
        <Link href="/admin">Log in</Link>
      </nav>
    </div>
  );
}
