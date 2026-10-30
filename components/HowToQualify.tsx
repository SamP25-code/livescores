"use client";

import { useEffect, useState } from "react";
import PlayerName from "@/components/PlayerName";
import CompetitionRow from "@/components/home/CompetitionRow";
import { loadPublicQualifying, type PublicPlace } from "@/lib/publicQualifying";
import { competitionPath, shortDate, todayIso, type PublicCompetition } from "@/lib/publicCompetitions";
import MonthGroups from "@/components/home/MonthGroups";

// How to get into a competition entered by qualification (the Masters
// Invitation): a bar of its places, filling in as each is won, then each
// qualifying competition as a row - the date of its final, where it's
// played, and its winner once decided - soonest first, so it's clear when
// every place will be in. Then the wildcards, dates to follow.
export default function HowToQualify({ competitionId, all }: { competitionId: string; all: PublicCompetition[] }) {
  const [places, setPlaces] = useState<PublicPlace[] | null>(null);

  useEffect(() => {
    loadPublicQualifying(competitionId)
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, [competitionId]);

  if (places === null) return null;
  if (places.length === 0) {
    return (
      <section className="home-section">
        <div className="home-section-head">
          <h2>Qualifying competitions</h2>
        </div>
        <p className="quiet-line">No qualifying competitions announced yet</p>
      </section>
    );
  }

  const qualifying = places
    .filter((p) => !p.wildcard)
    .sort((a, b) => (a.finalDate ?? "9999").localeCompare(b.finalDate ?? "9999") || a.number - b.number);
  const wildcards = places.filter((p) => p.wildcard).sort((a, b) => a.number - b.number);
  const decided = qualifying.filter((p) => p.who).length;
  const dates = qualifying.map((p) => p.finalDate).filter((d): d is string => Boolean(d));
  const last = qualifying.length > 0 && dates.length === qualifying.length ? dates.sort().at(-1)! : null;
  const today = todayIso();
  const next = qualifying.find((p) => !p.who && p.finalDate && p.finalDate >= today)?.finalDate ?? null;
  const allDecided = decided === qualifying.length;
  const placesLine = allDecided
    ? `All ${qualifying.length} place${qualifying.length === 1 ? "" : "s"} decided`
    : `${decided} of ${qualifying.length} place${qualifying.length === 1 ? "" : "s"} decided`;

  function href(p: PublicPlace): string | undefined {
    if (!p.link) return undefined;
    if ("qualifierId" in p.link) return `/qualifier/${p.link.qualifierId}`;
    const id = p.link.competitionId;
    const comp = all.find((c) => c.id === id);
    return comp ? competitionPath(comp, all) : undefined;
  }

  return (
    <>
      {qualifying.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h2>Qualifying competitions</h2>
          </div>
          <div className="qualify-progress">
            <p className="qualify-progress-head">
              <strong>{placesLine}</strong>
              {!allDecided && next && <span>Next: {shortDate(next)}</span>}
            </p>
            {/* One small segment per place - still clear with 32 */}
            <div className="qualify-bar" role="img" aria-label={placesLine}>
              {qualifying.map((p) => (
                <span key={p.number} className={p.who ? "qualify-bar-won" : undefined} />
              ))}
            </div>
            {!allDecided && last && <p className="qualify-progress-by">All decided by {shortDate(last)}</p>}
          </div>
          <MonthGroups
            items={qualifying}
            dateOf={(p) => p.finalDate}
            render={(p) => (
              <CompetitionRow
                key={p.number}
                date={p.finalDate}
                title={p.name}
                href={href(p)}
                pill={p.location ? { label: p.location, href: p.locationHref } : null}
                line={
                  p.who ? (
                    <>
                      Won by <PlayerName name={p.who} className="home-row-champion" />
                    </>
                  ) : (
                    "Winner to be decided"
                  )
                }
              />
            )}
          />
        </section>
      )}

      {wildcards.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h2>Wildcards</h2>
          </div>
          <div className="card home-rows">
            {wildcards.map((p, i) => (
              <CompetitionRow
                key={p.number}
                date={false}
                title={p.who ?? `Wildcard ${i + 1}`}
                line={[p.who ? "Wildcard" : "Chosen nearer the time", p.wasSource ? `in place of ${p.wasSource}` : null].filter(Boolean).join(" · ")}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
