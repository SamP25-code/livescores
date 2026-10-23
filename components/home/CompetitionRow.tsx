import Link from "next/link";
import type { ReactNode } from "react";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A small calendar-page date: "SAT / 13 / MAR", or "TBC" without one. On the
// calendar page it carries the competition's colour down its left edge.
function DateBlock({ iso, colour }: { iso: string | null; colour?: string }) {
  const style = colour ? { borderLeft: `4px solid ${colour}` } : undefined;
  if (!iso) {
    return (
      <span className="home-date home-date-tbc" style={style} aria-hidden="true">
        <strong>TBC</strong>
      </span>
    );
  }
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (
    <span className="home-date" style={style} aria-hidden="true">
      <span>{DAY[dow]}</span>
      <strong>{d}</strong>
      <span>{MONTH[m - 1]}</span>
    </span>
  );
}

// One row in any list on the site, the same everywhere: the date, the name
// (its link covers the whole row), and underneath a pill - the club, which
// opens the club's page - and one line. `date={false}` leaves the date off
// (a club, a wildcard); `end` puts something on the right (a Map link).
export default function CompetitionRow({
  date,
  title,
  href,
  pill,
  line,
  colour,
  end,
}: {
  date: string | null | false;
  title: string;
  href?: string;
  pill?: { label: string; href: string | null } | null;
  line: ReactNode;
  colour?: string;
  end?: ReactNode;
}) {
  return (
    <div className="home-row">
      {date !== false && <DateBlock iso={date} colour={colour} />}
      <span className="home-row-text">
        {href ? (
          <Link href={href} className="home-row-name">
            {title}
          </Link>
        ) : (
          <strong className="home-row-name">{title}</strong>
        )}
        <span className="home-row-line">
          {pill &&
            (pill.href ? (
              <Link href={pill.href} className="info-pill info-pill-club home-row-pill">
                {pill.label}
              </Link>
            ) : (
              <span className="info-pill info-pill-club home-row-pill">{pill.label}</span>
            ))}
          <span>{line}</span>
        </span>
      </span>
      {end && <span className="home-row-end">{end}</span>}
    </div>
  );
}
