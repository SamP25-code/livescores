"use client";

import Link from "next/link";
import {
  STATUS_LABEL,
  competitionPath,
  datesSummary,
  filterList,
  formatLine,
  publicStatus,
  sortForList,
  type ListFilter,
  type PublicCompetition,
} from "@/lib/publicCompetitions";

// Every competition in the chosen year: live first, then coming up, planned,
// finished. Tap a row to light up its dates on the calendar; "Open" goes to
// the competition. Earlier years are the archive.
export default function CompetitionList({
  all,
  year,
  years,
  onYear,
  filter,
  onFilter,
  colours,
  today,
  highlightId,
  onHighlight,
}: {
  all: PublicCompetition[];
  year: number;
  years: number[];
  onYear: (year: number) => void;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  colours: Map<string, string>;
  today: string;
  highlightId: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const thisYear = all.filter((c) => c.year === year);
  const labels = [...new Set(thisYear.map((c) => c.label).filter((l): l is string => Boolean(l)))];
  const filters: { key: ListFilter; text: string }[] = [
    { key: "all", text: "All" },
    { key: "live", text: "Live now" },
    { key: "coming_up", text: "Coming up" },
    { key: "finished", text: "Finished" },
    ...(thisYear.some((c) => c.team_size === 1) ? [{ key: "singles" as ListFilter, text: "Singles" }] : []),
    ...(thisYear.some((c) => c.team_size === 2) ? [{ key: "doubles" as ListFilter, text: "Doubles" }] : []),
    ...labels.map((l) => ({ key: `label:${l}` as ListFilter, text: l })),
  ];
  const shown = sortForList(filterList(thisYear, filter, today), today);

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Competitions</h2>
        {years.length > 1 && (
          <select aria-label="Year" className="home-year" value={year} onChange={(e) => onYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="home-filters" role="group" aria-label="Show">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`home-filter ${filter === f.key ? "home-filter-on" : ""}`}
            aria-pressed={filter === f.key}
            onClick={() => onFilter(f.key)}
          >
            {f.text}
          </button>
        ))}
      </div>

      <div className="card comp-rows">
        {shown.length === 0 && <p className="hint">Nothing to show here.</p>}
        {shown.map((c) => {
          const status = publicStatus(c, today);
          const colour = colours.get(c.id);
          const dated = c.sessions.some((s) => s.date);
          return (
            <div
              key={c.id}
              className={`comp-row ${highlightId === c.id ? "comp-row-on" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={highlightId === c.id}
              aria-label={`Show ${c.name}'s dates on the calendar`}
              onClick={() => onHighlight(highlightId === c.id ? null : c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onHighlight(highlightId === c.id ? null : c.id);
                }
              }}
            >
              <span
                className={`comp-bar ${dated ? "" : "comp-bar-dashed"}`}
                style={colour ? { background: colour } : undefined}
              />
              <span className="comp-row-text">
                <span className="comp-row-top">
                  <strong className="comp-row-name">{c.name}</strong>
                  <span className={`comp-pill comp-pill-${status}`}>
                    {status === "live" && <span className="live-dot" />}
                    {STATUS_LABEL[status]}
                  </span>
                </span>
                <span className="comp-row-line">
                  {status === "finished" && c.champion ? (
                    <>
                      {c.organiser.kind === "event" ? "Event" : c.organiser.short_name} &middot; Champion{" "}
                      <strong>{c.champion.name}</strong>
                    </>
                  ) : (
                    formatLine(c)
                  )}
                </span>
                <span className="comp-row-line">{datesSummary(c.sessions)}</span>
              </span>
              <Link
                href={competitionPath(c, all)}
                className="comp-row-open"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open ${c.name}`}
              >
                Open &rsaquo;
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
