import Link from "next/link";
import PlayerName from "@/components/PlayerName";
import {
  competitionPath,
  isTrophyDay,
  organiserPath,
  sessionTimes,
  sessionTitle,
  type PublicCompetition,
  type PublicSession,
} from "@/lib/publicCompetitions";

type Pick = { competition: PublicCompetition; session: PublicSession };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A small calendar-page date: "SAT / 13 / MAR"
function DateBlock({ iso }: { iso: string }) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (
    <span className="home-date" aria-hidden="true">
      <span>{DAY[dow]}</span>
      <strong>{d}</strong>
      <span>{MONTH[m - 1]}</span>
    </span>
  );
}

// One row: the date, the competition's name (the whole row opens it), and
// underneath the club as a pill - which opens the club's page - and the rest
function Row({ pick, all, line }: { pick: Pick; all: PublicCompetition[]; line: React.ReactNode }) {
  const { competition: c, session: s } = pick;
  const club = organiserPath(c, all);
  const who = c.organiser.kind === "event" ? c.organiser.name : c.organiser.short_name;
  const href = s.draw_published || s.status !== "upcoming" ? `/night/${s.id}` : competitionPath(c, all);
  return (
    <div className="home-row">
      <DateBlock iso={s.date!} />
      <span className="home-row-text">
        <Link href={href} className="home-row-name">
          {c.name}
        </Link>
        <span className="home-row-line">
          {club ? (
            <Link href={club} className="info-pill info-pill-club home-row-pill">
              {who}
            </Link>
          ) : (
            <span className="info-pill info-pill-club">{who}</span>
          )}
          <span>{line}</span>
        </span>
      </span>
    </div>
  );
}

// "Qualifying session 1 of 4", so it's clear there are more to come
function sessionLabel({ competition: c, session: s }: Pick): string {
  const qualifying = c.sessions.filter((x) => x.kind === "qualifier").length;
  return s.kind === "qualifier" && qualifying > 1 ? `${sessionTitle(s)} of ${qualifying}` : sessionTitle(s);
}

export function ComingUp({ picks, all }: { picks: Pick[]; all: PublicCompetition[] }) {
  if (picks.length === 0) return null;
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Coming up</h2>
      </div>
      <div className="card home-rows">
        {picks.map((p) => (
          <Row
            key={p.competition.id}
            pick={p}
            all={all}
            line={[sessionLabel(p), sessionTimes(p.session)?.replace(/^.*Start /, "")].filter(Boolean).join(" · ")}
          />
        ))}
      </div>
    </section>
  );
}

export function LatestResults({ picks, all }: { picks: Pick[]; all: PublicCompetition[] }) {
  if (picks.length === 0) return null;
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Latest results</h2>
      </div>
      <div className="card home-rows">
        {picks.map((p) => {
          const champion = isTrophyDay(p.session.kind) ? p.competition.champion : null;
          return (
            <Row
              key={p.competition.id}
              pick={p}
              all={all}
              line={
                champion ? (
                  <>
                    Won by <PlayerName name={champion.name} className="home-row-champion" />
                  </>
                ) : (
                  sessionTitle(p.session)
                )
              }
            />
          );
        })}
      </div>
    </section>
  );
}
