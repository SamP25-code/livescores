"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlayerName from "@/components/PlayerName";
import { loadPublicQualifying, type PublicPlace } from "@/lib/publicQualifying";
import { competitionPath, shortDate, todayIso, type PublicCompetition } from "@/lib/publicCompetitions";

// "How to qualify" for a competition entered by qualification: every place,
// the competition whose winner fills it (each opening its results), and
// who's qualified so far. It doubles as a list of those competitions.
export default function HowToQualify({ competitionId, all }: { competitionId: string; all: PublicCompetition[] }) {
  const [places, setPlaces] = useState<PublicPlace[] | null>(null);
  const today = todayIso();

  useEffect(() => {
    loadPublicQualifying(competitionId)
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, [competitionId]);

  if (places === null) return <p className="hint">Loading&hellip;</p>;
  if (places.length === 0) return null;

  const qualified = places.filter((p) => p.who && !p.wildcard).length;
  const wildcards = places.filter((p) => p.who && p.wildcard).length;
  const open = places.length - qualified - wildcards;

  return (
    <section className="how-to-qualify">
      <div className="card">
        <strong className="qualifying-total">How to qualify</strong>
        <p className="hint" style={{ margin: "2px 0 0" }}>
          Win one of these competitions to earn a place. The rest are wildcards, chosen nearer the time.
        </p>
        <div className="qualifying-meter" aria-hidden="true">
          <i style={{ width: `${(qualified / places.length) * 100}%`, background: "var(--green-deep)" }} />
          <i style={{ width: `${(wildcards / places.length) * 100}%`, background: "var(--gold)" }} />
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {qualified} qualified · {wildcards} wildcard{wildcards === 1 ? "" : "s"} · {open} to be decided
        </p>
      </div>
      <div className="card comp-list">
        {places.map((p) => {
          const comp = p.link && "competitionId" in p.link ? all.find((c) => c.id === (p.link as { competitionId: string }).competitionId) : null;
          const href = comp
            ? competitionPath(comp, all)
            : p.link && "qualifierId" in p.link
              ? `/qualifier/${p.link.qualifierId}`
              : null;
          const pill = p.who
            ? { cls: "comp-pill-finished", text: "Qualified" }
            : p.finalDate && p.finalDate >= today
              ? { cls: "comp-pill-coming_up", text: shortDate(p.finalDate) }
              : null;
          return (
            <div key={p.number} className="qualifying-place qualifying-place-row">
              <span className={`qualifying-num qualifying-num-${p.wildcard ? "wild" : p.who ? "done" : "open"}`}>{p.number}</span>
              <span className="comp-list-main">
                <span className="hint">
                  {href ? <Link href={href}>{p.source}</Link> : p.source}
                  {p.wasSource ? ` (was: ${p.wasSource})` : ""}
                </span>
                {p.who ? (
                  <PlayerName name={p.who} className="how-to-qualify-who" />
                ) : (
                  <em className="hint">{p.wildcard ? "Chosen nearer the time" : "To be decided"}</em>
                )}
              </span>
              {pill && <span className={`comp-pill ${pill.cls}`}>{pill.text}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
