import Link from "next/link";
import PlayerName from "@/components/PlayerName";
import { competitionPath, shortDate, type PublicCompetition } from "@/lib/publicCompetitions";

// Winners, newest first, each with a gold trophy badge: the last few, or
// (on the Champions page) everyone in one year
export default function RecentChampions({
  all,
  year,
  limit = 3,
  title = "Recent champions",
}: {
  all: PublicCompetition[];
  year?: number;
  limit?: number;
  title?: string;
}) {
  const recent = all
    .filter((c) => c.champion && (year === undefined || c.year === year))
    .sort((a, b) => (b.champion!.date ?? `${b.year}`).localeCompare(a.champion!.date ?? `${a.year}`))
    .slice(0, limit);
  if (recent.length === 0) return null;

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>{title}</h2>
      </div>
      <div className="card comp-rows">
        {recent.map((c) => (
          <Link key={c.id} href={competitionPath(c, all)} className="champ-row">
            <span className="champ-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path
                  fill="currentColor"
                  d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"
                />
              </svg>
            </span>
            <span className="champ-text">
              <PlayerName name={c.champion!.name} className="champ-name" />
              <span>
                {c.name} {c.year} &middot; {c.organiser.kind === "event" ? c.organiser.name : c.organiser.short_name}
                {c.champion!.date ? ` · ${shortDate(c.champion!.date)}` : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
