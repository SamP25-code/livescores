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

// One competition (or event) in a list, the same everywhere: the date, the
// name, and underneath the club as a pill - which opens the club's page -
// and one line. The name's link covers the whole row; on the calendar the
// row is a button that lights up its dates instead.
export default function CompetitionRow({
  date,
  title,
  href,
  onSelect,
  selected = false,
  pill,
  line,
  colour,
}: {
  date: string | null;
  title: string;
  href?: string;
  onSelect?: () => void;
  selected?: boolean;
  pill?: { label: string; href: string | null } | null;
  line: ReactNode;
  colour?: string;
}) {
  const pillEl = pill ? (
    pill.href && !onSelect ? (
      <Link href={pill.href} className="info-pill info-pill-club home-row-pill">
        {pill.label}
      </Link>
    ) : (
      <span className="info-pill info-pill-club home-row-pill">{pill.label}</span>
    )
  ) : null;
  const text = (
    <>
      <DateBlock iso={date} colour={colour} />
      <span className="home-row-text">
        {onSelect || !href ? (
          <strong className="home-row-name">{title}</strong>
        ) : (
          <Link href={href} className="home-row-name">
            {title}
          </Link>
        )}
        <span className="home-row-line">
          {pillEl}
          <span>{line}</span>
        </span>
      </span>
    </>
  );
  if (onSelect) {
    return (
      <button type="button" className={`home-row home-row-button ${selected ? "home-row-on" : ""}`} aria-pressed={selected} onClick={onSelect}>
        {text}
      </button>
    );
  }
  return <div className="home-row">{text}</div>;
}
