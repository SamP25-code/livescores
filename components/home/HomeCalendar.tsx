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
import QualifierRow from "@/components/home/QualifierRow";
import type { PublicQualifier } from "@/lib/publicQualifying";

// The month calendar: a dot under a qualifying session's date, the
// competition's colour in a gold ring for a trophy day (Finals Day or a
// single day), today ringed, "LIVE" under tonight. Below it, one row per
// competition in view - tap one to open it; tap a date to see what's on. Days either side of the month are shown faded but still marked.
// Qualifying competitions not run on this site (the Masters') are a dot on
// the day of their final, in one colour for all those for one competition.
export default function HomeCalendar({
  competitions,
  qualifiers = [],
  colours,
  year,
  month,
  onMonth,
  today,
  all,
}: {
  competitions: PublicCompetition[];
  // Each with a date for its final; its colour is under its own id
  qualifiers?: PublicQualifier[];
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
  const monthsWithBowls = new Set([
    ...competitions.flatMap((c) => c.sessions.map((s) => s.date?.slice(0, 7)).filter((d): d is string => Boolean(d))),
    ...qualifiers.map((q) => q.finalDate!.slice(0, 7)),
  ]);
  const weeks = monthGrid(year, month);
  const marks = marksByDay(competitions);
  for (const q of qualifiers) {
    if (!marks.has(q.finalDate!)) marks.set(q.finalDate!, []);
    marks.get(q.finalDate!)!.push({ competitionId: q.id, trophy: false, live: false });
  }
  const nameOf = new Map([...competitions.map((c) => [c.id, c.name] as const), ...qualifiers.map((q) => [q.id, q.name] as const)]);
  // Every session dated in this month (not the faded days either side)
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  type Item = { kind: "session"; competition: PublicCompetition; session: PublicCompetition["sessions"][number] } | { kind: "qualifier"; qualifier: PublicQualifier };
  const dateOf = (x: Item) => (x.kind === "session" ? x.session.date! : x.qualifier.finalDate!);
  const nameOfItem = (x: Item) => (x.kind === "session" ? x.competition.name : x.qualifier.name);
  const monthSessions: Item[] = [
    ...competitions.flatMap((c) =>
      c.sessions.filter((s) => s.date?.startsWith(monthKey)).map((s) => ({ kind: "session" as const, competition: c, session: s }))
    ),
    ...qualifiers.filter((q) => q.finalDate!.startsWith(monthKey)).map((q) => ({ kind: "qualifier" as const, qualifier: q })),
  ].sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || nameOfItem(a).localeCompare(nameOfItem(b)));


  function step(by: number) {
    const d = new Date(Date.UTC(year, month + by, 1));
    go(d.getUTCFullYear(), d.getUTCMonth());
  }

  function go(y: number, m: number) {
    setPicked(null);
    onMonth(y, m);
  }


  const pickedList = picked
    ? [
        ...competitions.flatMap((c) =>
          c.sessions.filter((s) => s.date === picked).map((s) => ({ key: s.id, name: c.name, what: sessionTitle(s) }))
        ),
        ...qualifiers.filter((q) => q.finalDate === picked).map((q) => ({ key: q.id, name: q.name, what: "Qualifier final" })),
      ]
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
            .map((m) => nameOf.get(m.competitionId))
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
          {pickedList.map((x) => (
            <p key={x.key}>
              <strong>{x.name}</strong> &middot; {x.what}
            </p>
          ))}
        </div>
      )}

      {/* Every session in this month, in date order - each competition's
          qualifying sessions as well as its Finals Day */}
      {monthSessions.length > 0 && <p className="cal-rows-head">On in {MONTH_NAMES[month]}</p>}
      {monthSessions.length > 0 && (
        <div className="home-rows cal-rows">
          {monthSessions.map((item) => {
            if (item.kind === "qualifier") {
              const q = item.qualifier;
              return (
                <QualifierRow
                  key={q.id}
                  qualifier={q}
                  all={all}
                  colour={colours.get(q.id)}
                  pill={q.location ? { label: q.location, href: null } : null}
                />
              );
            }
            const { competition: c, session: s } = item;
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
