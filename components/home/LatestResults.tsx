import Link from "next/link";
import PlayerName from "@/components/PlayerName";
import { longDate } from "@/lib/competitionSetup";
import { isTrophyDay, sessionTitle, type PublicCompetition, type PublicSession } from "@/lib/publicCompetitions";
import CompetitionPills from "@/components/home/CompetitionPills";

// The top of the home page when nothing's live and nothing has a date coming
// up: the most recently finished session, and its champion if it decided one
export default function LatestResults({ all, today }: { all: PublicCompetition[]; today: string }) {
  let latest: { competition: PublicCompetition; session: PublicSession } | null = null;
  for (const c of all) {
    for (const s of c.sessions) {
      if (s.status !== "complete" || !s.date || s.date > today) continue;
      if (!latest || s.date > latest.session.date!) latest = { competition: c, session: s };
    }
  }
  if (!latest) return null;
  const { competition: c, session: s } = latest;
  const champion = isTrophyDay(s.kind) && c.champion ? c.champion : null;

  return (
    <div className="card home-next">
      <span className="home-next-label">Latest results</span>
      <h2 className="home-next-name">
        {c.name} {c.year}
      </h2>
      <CompetitionPills competition={c} all={all} />
      <p className="home-next-format">
        {sessionTitle(s)} &middot; {longDate(s.date!)}
      </p>
      {champion && (
        <p className="latest-champion">
          <span>Champion</span>
          <PlayerName name={champion.name} className="latest-champion-name" />
        </p>
      )}
      <Link href={`/night/${s.id}`} className="button home-next-go">
        See the results
      </Link>
    </div>
  );
}
