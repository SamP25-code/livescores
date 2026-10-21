"use client";

import { useState } from "react";
import CompetitionRow from "@/components/home/CompetitionRow";
import RowLine from "@/components/home/RowLine";
import { organiserPill } from "@/components/home/HomeLists";
import {
  MONTH_NAMES,
  competitionPath,
  rowState,
  marksByDay,
  monthGrid,
  sessionTitle,
  type PublicCompetition,
} from "@/lib/publicCompetitions";

// The month calendar: a dot under a qualifying session's date, the
// competition's colour in a gold ring for a trophy day (Finals Day or a
// single day), today ringed, "LIVE" under tonight. Below it, one row per
// competition in view - tap one to open it; tap a date to see what's on. Days either side of the month are shown faded but still marked.
export default function HomeCalendar({
  competitions,
  colours,
  year,
  month,
  onMonth,
  today,
  all,
}: {
  competitions: PublicCompetition[];
  colours: Map<string, string>;
  year: number;
  month: number;
  onMonth: (year: number, month: number) => void;
  today: string;
  // Every competition, for each row's link
  all: PublicCompetition[];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const weeks = monthGrid(year, month);
  const marks = marksByDay(competitions);
  const byId = new Map(competitions.map((c) => [c.id, c]));
  const inView = competitions.filter((c) => colours.has(c.id));
  // A competition's first date showing on this month's grid
  const gridDays = new Set(weeks.flat().map((d) => d.iso));
  const firstInMonth = (c: PublicCompetition) =>
    c.sessions.map((s) => s.date).filter((d): d is string => Boolean(d && gridDays.has(d))).sort()[0];

  function step(by: number) {
    const d = new Date(Date.UTC(year, month + by, 1));
    go(d.getUTCFullYear(), d.getUTCMonth());
  }

  function go(y: number, m: number) {
    setPicked(null);
    onMonth(y, m);
  }

  // The years to jump between: every year with a competition, and this one
  const thisYear = Number(today.slice(0, 4));
  const years = [...new Set([thisYear, year, ...competitions.map((c) => c.year)])].sort((a, b) => a - b);

  const pickedList = picked
    ? competitions.flatMap((c) =>
        c.sessions.filter((s) => s.date === picked).map((s) => ({ competition: c, session: s }))
      )
    : [];

  return (
    <div className="card cal">
      {/* The month and the year, each with its own arrows either side and a
          drop-down to jump straight there */}
      <div className="cal-head">
        <span className="cal-head-group">
          <button type="button" className="cal-step" aria-label="Previous month" onClick={() => step(-1)}>
            &lsaquo;
          </button>
          <select aria-label="Month" className="cal-pick" value={month} onChange={(e) => go(year, Number(e.target.value))}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" className="cal-step" aria-label="Next month" onClick={() => step(1)}>
            &rsaquo;
          </button>
        </span>
        <span className="cal-head-group">
          <button type="button" className="cal-step" aria-label="Previous year" onClick={() => go(year - 1, month)}>
            &lsaquo;
          </button>
          <select aria-label="Year" className="cal-pick" value={year} onChange={(e) => go(Number(e.target.value), month)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" className="cal-step" aria-label="Next year" onClick={() => go(year + 1, month)}>
            &rsaquo;
          </button>
        </span>
      </div>

      <div className="cal-grid" role="grid" aria-label={`${MONTH_NAMES[month]} ${year}`}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="cal-weekday" aria-hidden="true">
            {d}
          </span>
        ))}
        {weeks.flat().map((day) => {
          const dayMarks = (marks.get(day.iso) ?? []).filter((m) => colours.has(m.competitionId));
          const trophy = dayMarks.find((m) => m.trophy);
          // Two or more trophy days on one date: the ring is split between
          // their colours, so none of them disappears
          const trophyColours = [...new Set(dayMarks.filter((m) => m.trophy).map((m) => colours.get(m.competitionId)))];
          const dots = dayMarks.filter((m) => !m.trophy).slice(0, 3);
          const live = dayMarks.some((m) => m.live);
          const what = dayMarks
            .map((m) => byId.get(m.competitionId)?.name)
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={day.iso}
              type="button"
              className={`cal-day ${day.inMonth ? "" : "cal-day-out"} ${day.iso === today ? "cal-today" : ""} ${
                picked === day.iso ? "cal-picked" : ""
              }`}
              aria-label={`${day.day} ${MONTH_NAMES[Number(day.iso.slice(5, 7)) - 1]}${what ? `: ${what}` : ""}`}
              onClick={() => setPicked(picked === day.iso || dayMarks.length === 0 ? null : day.iso)}
            >
              {trophy ? (
                <span
                  className="cal-trophy"
                  style={{
                    background:
                      trophyColours.length > 1
                        ? `linear-gradient(90deg, ${trophyColours
                            .map((col, i) => `${col} ${(i * 100) / trophyColours.length}% ${((i + 1) * 100) / trophyColours.length}%`)
                            .join(", ")})`
                        : colours.get(trophy.competitionId),
                  }}
                >
                  {day.day}
                </span>
              ) : (
                <span className="cal-number">{day.day}</span>
              )}
              <span className="cal-dots">
                {dots.map((m, i) => (
                  <span
                    key={i}
                    className="cal-dot"
                    style={{ background: colours.get(m.competitionId) }}
                  />
                ))}
              </span>
              {live && <span className="cal-live">&bull; LIVE</span>}
            </button>
          );
        })}
      </div>

      <div className="cal-key" aria-hidden="true">
        <span>
          <span className="cal-dot cal-key-dot" /> Qualifying session
        </span>
        <span>
          <span className="cal-key-ring" /> Finals Day / one day
        </span>
      </div>

      {picked && pickedList.length > 0 && (
        <div className="cal-picked-list">
          {pickedList.map(({ competition, session }) => (
            <p key={session.id}>
              <strong>{competition.name}</strong> &middot; {sessionTitle(session)}
            </p>
          ))}
        </div>
      )}

      {inView.length > 0 && <p className="cal-rows-head">On in {MONTH_NAMES[month]}</p>}
      {inView.length > 0 && (
        <div className="home-rows cal-rows">
          {inView
            .map((c) => ({ c, state: rowState(c, today) }))
            // In date order, as they come in the month
            .sort((a, b) => (firstInMonth(a.c) ?? "9").localeCompare(firstInMonth(b.c) ?? "9"))
            .map(({ c, state }) => {
            return (
              <CompetitionRow
                key={c.id}
                date={state.date}
                title={c.name}
                href={competitionPath(c, all)}
                colour={colours.get(c.id)}
                pill={organiserPill(c, all)}
                line={<RowLine competition={c} state={state} />}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
