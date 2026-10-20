import Link from "next/link";
import { organiserPath, whatItIs, type PublicCompetition } from "@/lib/publicCompetitions";

// Who runs it and what it is, for someone new to the site: the club (or
// event) as a pill - tap it for all their competitions - then singles or
// doubles, and its label if it has one ("Ladies", "Over 60s")
export default function CompetitionPills({ competition: c, all }: { competition: PublicCompetition; all: PublicCompetition[] }) {
  const href = organiserPath(c, all);
  const who = c.organiser.kind === "event" ? c.organiser.name : c.organiser.short_name;
  return (
    <p className="info-pills">
      {href ? (
        <Link href={href} className="info-pill info-pill-club">
          {who}
        </Link>
      ) : (
        <span className="info-pill info-pill-club">{who}</span>
      )}
      <span className="info-pills-text">{whatItIs(c)}</span>
    </p>
  );
}
