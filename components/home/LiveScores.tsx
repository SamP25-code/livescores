"use client";

import Link from "next/link";
import PlayerName from "@/components/PlayerName";
import type { LiveMatch } from "@/lib/publicData";
import { sessionTitle, type PublicCompetition } from "@/lib/publicCompetitions";

const MAX_SHOWN = 4;

// When something's being played: a banner per live session, then the scores
// themselves - both names (whoever's ahead in bold), big scores, and which
// competition and round - capped at four so a busy Finals Day stays short.
export default function LiveScores({
  matches,
  competitions,
}: {
  matches: LiveMatch[];
  competitions: PublicCompetition[];
}) {
  const byComp = new Map(competitions.map((c) => [c.id, c]));
  const liveSessions = competitions.flatMap((c) =>
    c.sessions.filter((s) => s.status === "live").map((s) => ({ competition: c, session: s }))
  );
  const several = new Set(matches.map((m) => m.competitionId)).size > 1;
  const shown = matches.slice(0, MAX_SHOWN);

  return (
    <>
      {liveSessions.map(({ competition, session }) => (
        <Link key={session.id} href={`/night/${session.id}`} className="home-live-banner">
          <span className="live-dot" />
          <span>
            <strong>
              {competition.name} &middot;{" "}
              {competition.organiser.kind === "event" ? competition.organiser.name : competition.organiser.short_name}
            </strong>
            <span>
              {sessionTitle(session)} &middot; {session.liveCount} match{session.liveCount === 1 ? "" : "es"} live
            </span>
          </span>
        </Link>
      ))}

      {shown.length > 0 && (
        <div className="card home-live">
          <div className="home-live-head">
            <h2>Live scores</h2>
            <span>updating live</span>
          </div>
          {shown.map((m) => {
            const aAhead = m.scoreA > m.scoreB;
            const bAhead = m.scoreB > m.scoreA;
            const comp = byComp.get(m.competitionId);
            return (
              <Link key={m.id} href={`/night/${m.nightId}`} className="home-live-match">
                <span className={`home-live-line ${aAhead ? "home-live-ahead" : ""}`}>
                  <PlayerName name={m.nameA} />
                  <span className="home-live-score">{m.scoreA}</span>
                </span>
                <span className={`home-live-line ${bAhead ? "home-live-ahead" : ""}`}>
                  <PlayerName name={m.nameB} />
                  <span className="home-live-score">{m.scoreB}</span>
                </span>
                <span className="home-live-where">
                  {several || !comp ? `${comp?.name ?? "Competition"} · ` : ""}
                  {m.roundName}
                </span>
              </Link>
            );
          })}
          <Link href={`/night/${shown[0].nightId}`} className="home-live-all">
            {matches.length > MAX_SHOWN ? `See all ${matches.length} live scores` : "See the full draw"}
          </Link>
        </div>
      )}
    </>
  );
}
