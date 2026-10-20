"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { clubs } from "@/lib/siteMenu";
import PublicPage from "@/components/PublicPage";

// Every club with a competition on the site, A to Z
export default function ClubsPage() {
  const { competitions, failed } = usePublicCompetitions();
  const list = useMemo(() => clubs(competitions ?? []), [competitions]);

  return (
    <PublicPage title="Clubs" loading={competitions === null} failed={failed}>
      {competitions !== null && (
        <div className="card comp-rows">
          {list.length === 0 && <p className="hint">No clubs yet.</p>}
          {list.map((club) => (
            <Link key={club.id} href={club.href} className="comp-row" style={{ color: "inherit", textDecoration: "none" }}>
              <span className="comp-row-text">
                <strong className="comp-row-name">{club.name}</strong>
                <span className="comp-row-line">
                  {club.count} competition{club.count === 1 ? "" : "s"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </PublicPage>
  );
}
