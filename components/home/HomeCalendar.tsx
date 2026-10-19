"use client";

import { useState } from "react";
import {
  MONTH_NAMES,
  datesSummary,
  marksByDay,
  monthGrid,
  sessionTitle,
  type PublicCompetition,
} from "@/lib/publicCompetitions";

// The month calendar: a dot under a qualifying session's date, the
// competition's colour in a gold ring for a trophy day (Finals Day or a
// single day), today ringed, "LIVE" under tonight. Below it, one row per
// competition in view - tap one to light up its dates; tap a date to see
// what's on. Days either side of the month are shown faded but still marked.
export default function HomeCalendar({
  competitions,
  colours,
  year,
  month,
  onMonth,
  today,
  highlightId,
  onHighlight,
}: {
  competitions: PublicCompetition[];
  colours: Map<string, string>;
  year: number;
  month: number;
  onMonth: (year: number, month: number) => void;
  today: string;
  highlightId: string | null;
  onHighlight: (id: string | null) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const weeks = monthGrid(year, month);
  const marks = marksByDay(competitions);
  const byId = new Map(competitions.map((c) => [c.id, c]));
  const inView = competitions.filter((c) => colours.has(c.id));

  function step(by: number) {
    const d = new Date(Date.UTC(year, month + by, 1));
    setPicked(null);
    onMonth(d.getUTCFullYear(), d.getUTCMonth());
  }

  const pickedList = picked
    ? competitions.flatMap((c) =>
        c.sessions.filter((s) => s.date === picked).map((s) => ({ competition: c, session: s }))
      )
    : [];

  return (
    <div className="card cal">
      <div className="cal-head">
        <button type="button" className="cal-step" aria-label="Previous month" onClick={() => step(-1)}>
          &lsaquo;
        </button>
        <h3 className="cal-title">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button type="button" className="cal-step" aria-label="Next month" onClick={() => step(1)}>
          &rsaquo;
        </button>
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
          const dots = dayMarks.filter((m) => !m.trophy).slice(0, 3);
          const live = dayMarks.some((m) => m.live);
          const faded = (id: string) => highlightId !== null && id !== highlightId;
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
                  className={`cal-trophy ${faded(trophy.competitionId) ? "cal-faded" : ""}`}
                  style={{ background: colours.get(trophy.competitionId) }}
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
                    className={`cal-dot ${faded(m.competitionId) ? "cal-faded" : ""}`}
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
          <span className="cal-key-ring" /> Finals Day / single day
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

      {inView.length > 0 && (
        <div className="cal-rows">
          {inView.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cal-row ${highlightId === c.id ? "cal-row-on" : ""}`}
              aria-pressed={highlightId === c.id}
              onClick={() => onHighlight(highlightId === c.id ? null : c.id)}
            >
              <span className="comp-bar" style={{ background: colours.get(c.id) }} />
              <span className="cal-row-text">
                <strong>{c.name}</strong>
                <span>{c.organiser.kind === "event" ? "Event" : c.organiser.short_name}</span>
                <span>{datesSummary(c.sessions)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
