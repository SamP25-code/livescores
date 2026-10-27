"use client";

import { useState } from "react";
import CompetitionRow from "@/components/home/CompetitionRow";
import PlayerLinks from "@/components/PlayerLinks";
import {
  MONTH_NAMES,
  isTrophyDay,
  sessionLabel,
  marksByDay,
  monthGrid,
  sessionTitle,
  type PublicCompetition,
  startTime,
  sessionPath,
  organiserPill,
} from "@/lib/publicCompetitions";
import LivePill from "@/components/home/LivePill";

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
  // The month chooser: open or not, and the year it's showing
  const [choosing, setChoosing] = useState(false);
  const [pickYear, setPickYear] = useState(year);
  // Months with a session in them, for the dots in the chooser
  const monthsWithBowls = new Set(competitions.flatMap((c) => c.sessions.map((s) => s.date?.slice(0, 7)).filter((d): d is string => Boolean(d))));
  const weeks = monthGrid(year, month);
  const marks = marksByDay(competitions);
  const byId = new Map(competitions.map((c) => [c.id, c]));
  // Every session dated in this month (not the faded days either side)
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthSessions = competitions
    .flatMap((c) => c.sessions.filter((s) => s.date?.startsWith(monthKey)).map((s) => ({ competition: c, session: s })))
    .sort((a, b) => a.session.date!.localeCompare(b.session.date!) || a.competition.name.localeCompare(b.competition.name));


  function step(by: number) {
    const d = new Date(Date.UTC(year, month + by, 1));
    go(d.getUTCFullYear(), d.getUTCMonth());
  }

  function go(y: number, m: number) {
    setPicked(null);
    onMonth(y, m);
  }


  const pickedList = picked
    ? competitions.flatMap((c) =>
        c.sessions.filter((s) => s.date === picked).map((s) => ({ competition: c, session: s }))
      )
    : [];

  return (
    <div className="card cal">
      {/* ‹ October 2026 ›: the arrows step a month; tapping the title opens
          a year with its twelve months, to jump straight to any of them */}
      <div className="cal-head">
        <button type="button" className="cal-step" aria-label="Previous month" onClick={() => step(-1)}>
          &lsaquo;
        </button>
        <button
          type="button"
          className="cal-title-button"
          aria-expanded={choosing}
          onClick={() => {
            setPickYear(year);
            setChoosing((v) => !v);
          }}
        >
          {MONTH_NAMES[month]} {year}
          <span className="cal-title-caret" aria-hidden="true">
            &#9662;
          </span>
        </button>
        <button type="button" className="cal-step" aria-label="Next month" onClick={() => step(1)}>
          &rsaquo;
        </button>
      </div>

      {choosing && (
        <div className="cal-chooser">
          <div className="cal-chooser-year">
            <button type="button" className="cal-step" aria-label="Previous year" onClick={() => setPickYear(pickYear - 1)}>
              &lsaquo;
            </button>
            <strong>{pickYear}</strong>
            <button type="button" className="cal-step" aria-label="Next year" onClick={() => setPickYear(pickYear + 1)}>
              &rsaquo;
            </button>
          </div>
          <div className="cal-chooser-months">
            {MONTH_NAMES.map((name, i) => {
              const key = `${pickYear}-${String(i + 1).padStart(2, "0")}`;
              const on = monthsWithBowls.has(key);
              return (
                <button
                  key={name}
                  type="button"
                  className={`cal-chooser-month ${pickYear === year && i === month ? "cal-chooser-month-on" : ""}`}
                  aria-current={pickYear === year && i === month ? "date" : undefined}
                  aria-label={`${name} ${pickYear}${on ? " - has competitions" : ""}`}
                  onClick={() => {
                    setChoosing(false);
                    go(pickYear, i);
                  }}
                >
                  {name.slice(0, 3)}
                  {on && <span className="cal-dot cal-chooser-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="cal-grid" role="group" aria-label={`${MONTH_NAMES[month]} ${year}`}>
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
              {live && <span className="cal-live">&bull; Live</span>}
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

      {/* Every session in this month, in date order - each competition's
          qualifying sessions as well as its Finals Day */}
      {monthSessions.length > 0 && <p className="cal-rows-head">On in {MONTH_NAMES[month]}</p>}
      {monthSessions.length > 0 && (
        <div className="home-rows cal-rows">
          {monthSessions.map(({ competition: c, session: s }) => {
            const won = s.status === "complete" && isTrophyDay(s.kind) && c.champion;
            const start = startTime(s);
            return (
              <CompetitionRow
                key={s.id}
                date={s.date}
                title={c.name}
                href={sessionPath(c, s, all)}
                colour={colours.get(c.id)}
                pill={organiserPill(c, all)}
                line={
                  s.status === "live" ? (
                    <>
                      <LivePill />{" "}
                      {sessionLabel(c, s)}
                    </>
                  ) : won ? (
                    <>
                      Won by <PlayerLinks name={c.champion!.name} ids={c.champion!.winnerIds} className="home-row-champion" />
                    </>
                  ) : (
                    [sessionLabel(c, s), s.status === "complete" ? "played" : start].filter(Boolean).join(" · ")
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
