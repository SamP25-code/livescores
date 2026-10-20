"use client";

import { useState } from "react";
import Link from "next/link";
import { matchesSearch } from "@/lib/people";
import {
  STATUS_LABEL,
  competitionPath,
  dateRange,
  eventDates,
  eventPath,
  datesSummary,
  filterList,
  formatLine,
  publicStatus,
  sortForList,
  type ListFilter,
  type PublicCompetition,
} from "@/lib/publicCompetitions";

// Every competition in the chosen year: live first, then coming up, planned,
// finished. Earlier years are the archive. Beside the calendar, tapping a row
// lights up its dates and "Open" goes to the competition; on its own, a row
// just opens it. With a search box, typing a club or event narrows the list.
export default function CompetitionList({
  all,
  year,
  years,
  onYear,
  filter,
  onFilter,
  colours,
  today,
  highlightId = null,
  onHighlight,
  searchable = false,
}: {
  all: PublicCompetition[];
  year: number;
  years: number[];
  onYear: (year: number) => void;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  colours: Map<string, string>;
  today: string;
  highlightId?: string | null;
  onHighlight?: (id: string | null) => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
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
  const found = (c: PublicCompetition) =>
    !query.trim() ||
    matchesSearch(c.name, query) ||
    matchesSearch(c.organiser.name, query) ||
    matchesSearch(c.organiser.short_name, query);
  const shown = sortForList(filterList(thisYear, filter, today), today).filter(found);
  // A multi-competition event is one row (where its first competition sorts)
  const seenEvents = new Set<string>();
  type Row = { kind: "comp"; c: PublicCompetition } | { kind: "event"; c: PublicCompetition; members: PublicCompetition[] };
  const rows = shown.flatMap((c): Row[] => {
    if (c.organiser.kind !== "event" || !c.organiser.slug) return [{ kind: "comp" as const, c }];
    if (seenEvents.has(c.organiser.id)) return [];
    seenEvents.add(c.organiser.id);
    return [{ kind: "event" as const, c, members: thisYear.filter((x) => x.organiser.id === c.organiser.id) }];
  });
  const rank: Record<string, number> = { live: 0, coming_up: 1, planned: 2, finished: 3 };

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

      {searchable && (
        <input
          type="search"
          className="home-search"
          placeholder="Search by club, event or competition"
          aria-label="Search by club, event or competition"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      <div className="card comp-rows">
        {shown.length === 0 && (
          <p className="hint">{query.trim() ? `Nothing in ${year} matches “${query.trim()}”.` : "Nothing to show here."}</p>
        )}
        {rows.map((row) => {
          if (row.kind === "event") {
            const members = row.members;
            const status = members.map((m) => publicStatus(m, today)).sort((a, b) => rank[a] - rank[b])[0];
            const dates = eventDates(members);
            const colour = colours.get(members.find((m) => colours.has(m.id))?.id ?? "");
            return (
              <Link
                key={`event-${row.c.organiser.id}`}
                href={eventPath(row.c.organiser.slug!, year, all)}
                className="comp-row"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <span className={`comp-bar ${dates ? "" : "comp-bar-dashed"}`} style={colour ? { background: colour } : undefined} />
                <span className="comp-row-text">
                  <span className="comp-row-top">
                    <strong className="comp-row-name">{row.c.organiser.name}</strong>
                    <span className={`comp-pill comp-pill-${status}`}>
                      {status === "live" && <span className="live-dot" />}
                      {STATUS_LABEL[status]}
                    </span>
                  </span>
                  <span className="comp-row-line">
                    Event · {members.length} competition{members.length === 1 ? "" : "s"}
                  </span>
                  <span className="comp-row-line">{dates ? dateRange(dates.from, dates.to) : "Dates to be confirmed"}</span>
                </span>
                <span className="comp-row-open">Open &rsaquo;</span>
              </Link>
            );
          }
          const c = row.c;
          const status = publicStatus(c, today);
          const colour = colours.get(c.id);
          const dated = c.sessions.some((s) => s.date);
          const text = (
            <>
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
            </>
          );
          if (!onHighlight) {
            return (
              <Link key={c.id} href={competitionPath(c, all)} className="comp-row" style={{ color: "inherit", textDecoration: "none" }}>
                {text}
                <span className="comp-row-open">Open &rsaquo;</span>
              </Link>
            );
          }
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
              {text}
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
