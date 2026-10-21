import PlayerLinks from "@/components/PlayerLinks";
import CompetitionRow from "@/components/home/CompetitionRow";
import MonthGroups from "@/components/home/MonthGroups";
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

// What's coming up, a box for each month with the month above it
export function ComingUp({ picks, all }: { picks: Pick[]; all: PublicCompetition[] }) {
  if (picks.length === 0) return null;
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Coming up</h2>
      </div>
      <MonthGroups
        items={picks}
        dateOf={(p) => p.session.date}
        render={(p) => (
          <CompetitionRow
            key={p.competition.id}
            date={p.session.date}
            title={p.competition.name}
            href={sessionHref(p, all)}
            pill={organiserPill(p.competition, all)}
            line={[sessionLabel(p.competition, p.session), sessionTimes(p.session)?.replace(/^.*Start /, "")].filter(Boolean).join(" · ")}
          />
        )}
      />
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
      <MonthGroups
        items={picks}
        dateOf={(p) => p.session.date}
        render={(p) => {
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
                    Won by <PlayerLinks name={champion.name} ids={champion.winnerIds} className="home-row-champion" />
                  </>
                ) : (
                  sessionTitle(p.session)
                )
              }
            />
          );
        }}
      />
    </section>
  );
}
