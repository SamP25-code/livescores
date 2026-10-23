"use client";

import { useState } from "react";
import { matchesSearch } from "@/lib/people";
import {
  competitionPath,
  dateRange,
  eventDates,
  eventPath,
  filterList,
  rowState,
  publicStatus,
  sortForList,
  type ListFilter,
  type PublicCompetition,
} from "@/lib/publicCompetitions";
import CompetitionRow from "@/components/home/CompetitionRow";
import MonthGroups from "@/components/home/MonthGroups";
import RowLine from "@/components/home/RowLine";
import { organiserPill } from "@/components/home/HomeLists";
import LivePill from "@/components/home/LivePill";

// Every competition in the chosen year: live first, then coming up, planned,
// finished. Earlier years are the archive. Tap a row to open it. With a
// search box, typing a club or event narrows the list.
export default function CompetitionList({
  all,
  year,
  years,
  onYear,
  filter,
  onFilter,
  today,
  searchable = false,
  organiserId,
  organiserKind,
  belongs,
  title = "Competitions",
}: {
  all: PublicCompetition[];
  year: number;
  years: number[];
  onYear: (year: number) => void;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  today: string;
  searchable?: boolean;
  organiserId?: string;
  // Only one kind's competitions (the County page)
  organiserKind?: "club" | "event" | "county";
  // Which to show, when it's more than one organiser's (a club's page: the
  // competitions it runs and those played on its green)
  belongs?: (c: PublicCompetition) => boolean;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const thisYear = all.filter(
    (c) =>
      c.year === year &&
      (belongs ? belongs(c) : !organiserId || c.organiser.id === organiserId) &&
      (!organiserKind || c.organiser.kind === organiserKind)
  );
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

  // In date order through the year, a box for each month (as on the home page)
  const dated = rows
    .map((row) => ({
      row,
      date: row.kind === "event" ? (eventDates(row.members)?.from ?? null) : rowState(row.c, today).date,
    }))
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>{title}</h2>
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

      {shown.length === 0 && (
        <p className="quiet-line">{query.trim() ? `Nothing matches “${query.trim()}” in ${year}` : "No competitions yet"}</p>
      )}
      <MonthGroups
        items={dated}
        dateOf={(x) => x.date}
        render={({ row }) => {
          if (row.kind === "event") {
            const members = row.members;
            const dates = eventDates(members);
            const live = members.some((m) => publicStatus(m, today) === "live");
            return (
              <CompetitionRow
                key={`event-${row.c.organiser.id}`}
                date={dates?.from ?? null}
                title={row.c.organiser.name}
                href={eventPath(row.c.organiser.slug!, year, all)}
                line={
                  <>
                    {live && (
                      <>
                        <LivePill />{" "}
                      </>
                    )}
                    Event &middot; {members.length} competition{members.length === 1 ? "" : "s"}
                    {dates ? ` · ${dateRange(dates.from, dates.to)}` : ""}
                  </>
                }
              />
            );
          }
          const c = row.c;
          const state = rowState(c, today);
          return (
            <CompetitionRow
              key={c.id}
              date={state.date}
              title={c.name}
              href={competitionPath(c, all)}
              // A club's own competitions don't need its name on every row
              pill={c.organiser.id === organiserId || organiserKind ? null : organiserPill(c, all)}
              line={<RowLine competition={c} state={state} />}
            />
          );
        }}
      />
    </section>
  );
}

