import Link from "next/link";
import { longDate } from "@/lib/competitionSetup";
import {
  competitionPath,
  daysUntil,
  formatLine,
  sessionTitle,
  timeOfDay,
  type PublicCompetition,
  type PublicSession,
} from "@/lib/publicCompetitions";

// When nothing's live: the next competition (or two, if both start the same
// week) with a countdown, when and where it starts, and whether the draw is out.
export default function NextUp({
  picks,
  all,
  today,
}: {
  picks: { competition: PublicCompetition; session: PublicSession }[];
  all: PublicCompetition[];
  today: string;
}) {
  return (
    <>
      {picks.map(({ competition: c, session: s }) => {
        const days = daysUntil(today, s.date!);
        const pairs = c.team_size === 2;
        return (
          <div key={c.id} className="card home-next">
            <span className="home-next-label">Next up</span>
            <h2 className="home-next-name">{c.name}</h2>
            <p className="home-next-format">{formatLine(c)}</p>
            <div className="home-next-when">
              <span className="home-next-count">
                {days === 0 ? (
                  <strong className="home-next-today">Today</strong>
                ) : (
                  <>
                    <strong>{days}</strong>
                    <span>{days === 1 ? "day" : "days"}</span>
                  </>
                )}
              </span>
              <span className="home-next-details">
                <span>
                  <strong>{longDate(s.date!)}</strong> &middot; {sessionTitle(s)}
                  {timeOfDay(s.start_time) ? ` · ${timeOfDay(s.start_time)}` : ""}
                </span>
                <span>
                  {s.draw_published ? "Draw published" : "Draw to follow"}
                  {c.entryCount > 0 ? ` · ${c.entryCount} ${pairs ? "pairs " : ""}entered` : ""}
                </span>
              </span>
            </div>
            <Link href={s.draw_published ? `/night/${s.id}` : competitionPath(c, all)} className="button home-next-go">
              {s.draw_published ? "See the draw ›" : "See the competition ›"}
            </Link>
          </div>
        );
      })}
    </>
  );
}
