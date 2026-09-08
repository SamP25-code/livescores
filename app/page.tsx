"use client";

import Link from "next/link";
import NightNav from "@/components/NightNav";

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
      <NightNav />
    </div>
  );
}
