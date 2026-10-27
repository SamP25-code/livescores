"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIsSuper } from "@/lib/auth";
import { listChoices, listCompetitions, type CompetitionWithSeries } from "@/lib/competitionsApi";
import { longDate, settingsSummary } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";
import { SITE_NAME } from "@/lib/site";
import { supabase } from "@/lib/supabaseClient";
import type { Organiser } from "@/lib/types";

// Everything about each event (the Blackpool Masters) in one place: its
// competitions, adding another, its posts, and its public page. Super only.
export default function EventsPage() {
  const isSuper = useIsSuper();
  const [events, setEvents] = useState<Organiser[] | null>(null);
  const [comps, setComps] = useState<CompetitionWithSeries[]>([]);
  const [firstDates, setFirstDates] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Events · Admin · ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    if (!isSuper) return;
    (async () => {
      const [choices, all] = await Promise.all([listChoices(), listCompetitions()]);
      const evs = choices.organisers.filter((o) => o.kind === "event");
      const mine = all.filter((c) => evs.some((e) => e.id === c.series.organiser_id));
      setEvents(evs);
      setComps(mine);
      // Each competition's day, to put them in order
      if (mine.length) {
        const { data: nights } = await supabase
          .from("nights")
          .select("competition_id, date")
          .in("competition_id", mine.map((c) => c.id))
          .not("date", "is", null)
          .order("date");
        const dates = new Map<string, string>();
        for (const n of nights ?? []) if (!dates.has(n.competition_id)) dates.set(n.competition_id, n.date);
        setFirstDates(dates);
      }
    })().catch((err) => setError(errorMessage(err)));
  }, [isSuper]);

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <h1>Events</h1>
        <p className="hint">Only the site admin can set up events.</p>
      </div>
    );
  }

  return (
    <div className="page page-photo">
      <div className="comp-list-head">
        <h1>Events</h1>
        <Link href="/admin/competitions/new?kind=event" className="button">
          + New event
        </Link>
      </div>
      <p className="hint">
        An event is several competitions under one name, with a page of its own for news, qualifier updates and adverts.
      </p>
      {error && <p className="error">{error}</p>}
      {events === null && !error && <p className="quiet-line">Loading&hellip;</p>}
      {events?.length === 0 && (
        <div className="card">
          <p className="hint hint-flush">
            No events yet. <strong>New event</strong> sets one up with its first competition.
          </p>
        </div>
      )}

      {events?.map((e) => {
        const theirs = comps.filter((c) => c.series.organiser_id === e.id);
        const years = [...new Set(theirs.map((c) => c.year))].sort((a, b) => b - a);
        const latest = years[0];
        const shown = theirs
          .filter((c) => c.year === latest)
          .sort((a, b) => (firstDates.get(a.id) ?? "9").localeCompare(firstDates.get(b.id) ?? "9"));
        return (
          <article key={e.id} className="card event-admin-card">
            <div className="admin-card-top">
              <h2 className="admin-card-name">
                {e.name}
                {latest ? ` ${latest}` : ""}
              </h2>
            </div>
            {e.slug && (
              <p className="admin-card-line">
                Its page: <Link href={`/${e.slug}`}>/{e.slug}</Link>
              </p>
            )}
            <div className="comp-list">
              {shown.length === 0 && <p className="hint">No competitions yet</p>}
              {shown.map((c) => (
                <Link key={c.id} href={`/admin/competitions/${c.id}`} className="comp-list-row">
                  <span className="comp-list-main">
                    <strong>{c.series.name}</strong>
                    <span className="hint">
                      {firstDates.get(c.id) ? `${longDate(firstDates.get(c.id)!)} · ` : ""}
                      {settingsSummary(c)}
                    </span>
                  </span>
                  <span className="comp-list-open">Open</span>
                </Link>
              ))}
            </div>
            <div className="admin-card-actions">
              <Link href={`/admin/competitions/new?event=${e.id}`} className="button">
                + Add a competition
              </Link>
              <Link href={`/admin/events/${e.id}`} className="button secondary">
                Posts and page
              </Link>
              {e.slug && (
                <Link href={`/${e.slug}`} className="link-button admin-card-more">
                  View its page
                </Link>
              )}
            </div>
            {years.length > 1 && <p className="hint">Earlier years: {years.slice(1).join(", ")}</p>}
          </article>
        );
      })}
    </div>
  );
}
