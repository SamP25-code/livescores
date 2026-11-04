import CompetitionRow from "@/components/home/CompetitionRow";
import PlayerName from "@/components/PlayerName";
import { competitionPath, type PublicCompetition } from "@/lib/publicCompetitions";
import type { PublicQualifier } from "@/lib/publicQualifying";

// One qualifying competition in a list (a club's page, the calendar): the
// date of its final, what it qualifies for, and its winner once decided -
// opening its results, or the competition it qualifies for until there are
// some
export default function QualifierRow({
  qualifier: q,
  all,
  colour,
  pill = null,
}: {
  qualifier: PublicQualifier;
  all: PublicCompetition[];
  colour?: string;
  pill?: { label: string; href: string | null } | null;
}) {
  const into = all.find((c) => c.id === q.qualifiesFor);
  const source = q.sourceCompetitionId ? all.find((c) => c.id === q.sourceCompetitionId) : undefined;
  const who = source ? (source.champion?.name ?? null) : q.who;
  const href = source
    ? competitionPath(source, all)
    : q.hasResults
      ? `/qualifier/${q.id}`
      : into
        ? competitionPath(into, all)
        : undefined;
  return (
    <CompetitionRow
      date={q.finalDate}
      title={q.name}
      href={href}
      colour={colour}
      pill={pill}
      line={
        <>
          {into ? `Qualifier for ${into.name} ${into.year} · ` : ""}
          {who ? (
            <>
              Won by <PlayerName name={who} className="home-row-champion" />
            </>
          ) : (
            "Winner to be decided"
          )}
        </>
      }
    />
  );
}
