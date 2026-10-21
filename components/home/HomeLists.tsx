import PlayerName from "@/components/PlayerName";
import CompetitionRow from "@/components/home/CompetitionRow";
import {
  competitionPath,
  isTrophyDay,
  organiserPath,
  sessionLabel,
  sessionTimes,
  sessionTitle,
  type PublicCompetition,
  type PublicSession,
} from "@/lib/publicCompetitions";

type Pick = { competition: PublicCompetition; session: PublicSession };

// Who runs it, as the pill under its name
export function organiserPill(c: PublicCompetition, all: PublicCompetition[]) {
  return { label: c.organiser.kind === "event" ? c.organiser.name : c.organiser.short_name, href: organiserPath(c, all) };
}

function sessionHref({ competition: c, session: s }: Pick, all: PublicCompetition[]): string {
  return s.draw_published || s.status !== "upcoming" ? `/night/${s.id}` : competitionPath(c, all);
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// What's coming up, a box for each month with the month above it
export function ComingUp({ picks, all }: { picks: Pick[]; all: PublicCompetition[] }) {
  if (picks.length === 0) return null;
  const thisYear = new Date().getFullYear();
  const months: { key: string; label: string; picks: Pick[] }[] = [];
  for (const p of picks) {
    const key = p.session.date!.slice(0, 7);
    let month = months.find((m) => m.key === key);
    if (!month) {
      const [y, m] = key.split("-").map(Number);
      month = { key, label: `${MONTH_NAMES[m - 1]}${y !== thisYear ? ` ${y}` : ""}`, picks: [] };
      months.push(month);
    }
    month.picks.push(p);
  }
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Coming up</h2>
      </div>
      {months.map((m) => (
        <div key={m.key} className="home-month">
          <p className="home-month-label">{m.label}</p>
          <div className="card home-rows">
            {m.picks.map((p) => (
              <CompetitionRow
                key={p.competition.id}
                date={p.session.date}
                title={p.competition.name}
                href={sessionHref(p, all)}
                pill={organiserPill(p.competition, all)}
                line={[sessionLabel(p.competition, p.session), sessionTimes(p.session)?.replace(/^.*Start /, "")].filter(Boolean).join(" · ")}
              />
            ))}
          </div>
        </div>
      ))}
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
            <CompetitionRow
              key={p.competition.id}
              date={p.session.date}
              title={p.competition.name}
              href={sessionHref(p, all)}
              pill={organiserPill(p.competition, all)}
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
