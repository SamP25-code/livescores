"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIsSuper } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { loadPublicCompetitions } from "@/lib/publicData";
import { actionLabel, buildOverview, type Overview } from "@/lib/overview";
import { sessionLabel, sessionTimes, shortDate, todayIso } from "@/lib/publicCompetitions";
import { SITE_NAME } from "@/lib/site";
import { supabase } from "@/lib/supabaseClient";
import LivePill from "@/components/home/LivePill";

type LogRow = { id: string; at: string; action: string; competition: string | null; competitionId: string | null };

// Everything at a glance (Super): what's on now, what needs doing before it
// can go ahead (worst first), the next fortnight, and the latest changes
// anyone has made
export default function OverviewPage() {
  const isSuper = useIsSuper();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Overview · Admin · ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    if (!isSuper) return;
    (async () => {
      const [all, { data: admins, error: adminError }, { data: changes }] = await Promise.all([
        loadPublicCompetitions(),
        supabase.from("assignments").select("competition_id").eq("role", "admin"),
        supabase
          .from("audit_log")
          .select("id, at, action, competition_id, competition:competition_id(year, series:series_id(name))")
          .order("at", { ascending: false })
          .limit(20),
      ]);
      if (adminError) throw adminError;
      const counts = new Map<string, number>();
      for (const a of admins ?? []) counts.set(a.competition_id, (counts.get(a.competition_id) ?? 0) + 1);
      setOverview(buildOverview(all, counts, todayIso()));
      setLog(
        (changes ?? []).map((r) => {
          const c = r.competition as unknown as { year: number; series: { name: string } | null } | null;
          return {
            id: r.id,
            at: r.at,
            action: r.action,
            competition: c ? `${c.series?.name ?? "Competition"} ${c.year}` : null,
            competitionId: r.competition_id,
          };
        })
      );
    })().catch((err) => setError(errorMessage(err)));
  }, [isSuper]);

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <h1>Overview</h1>
        <p className="hint">Only Sam (Super) sees the overview.</p>
      </div>
    );
  }

  return (
    <div className="page page-photo">
      <h1>Overview</h1>
      {error && <p className="error">{error}</p>}
      {!overview && !error && <p className="quiet-line">Loading&hellip;</p>}

      {overview && (
        <>
          <section className="home-section">
            <div className="home-section-head">
              <h2>Live now</h2>
            </div>
            {overview.live.length === 0 ? (
              <p className="quiet-line">Nothing on right now</p>
            ) : (
              <div className="card comp-list">
                {overview.live.map(({ competition: c, session: s }) => (
                  <Link key={s.id} href={`/admin/night/${s.id}`} className="comp-list-row">
                    <span className="comp-list-main">
                      <strong>
                        {c.name} {c.year}
                      </strong>
                      <span className="hint">
                        {sessionLabel(c, s)} &middot; {s.liveCount} match{s.liveCount === 1 ? "" : "es"} live
                      </span>
                    </span>
                    <LivePill />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="home-section">
            <div className="home-section-head">
              <h2>Needs doing</h2>
            </div>
            {overview.attention.length === 0 ? (
              <p className="quiet-line">Nothing - every competition is set</p>
            ) : (
              <div className="card comp-list">
                {overview.attention.map((a, i) => (
                  <Link
                    key={i}
                    href={a.session && a.message.startsWith("Draw") ? `/admin/night/${a.session.id}` : `/admin/competitions/${a.competition.id}`}
                    className={`comp-list-row overview-item overview-item-${a.urgency}`}
                  >
                    <span className="comp-list-main">
                      <strong>{a.message}</strong>
                      <span className="hint">
                        {a.competition.name} {a.competition.year}
                        {a.session?.date ? ` · ${sessionLabel(a.competition, a.session)} ${shortDate(a.session.date)}` : ""}
                      </span>
                    </span>
                    <span className="overview-when">{a.urgency === "now" ? "In 3 days" : a.urgency === "soon" ? "This fortnight" : "Later"}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="home-section">
            <div className="home-section-head">
              <h2>The next fortnight</h2>
            </div>
            {overview.comingUp.length === 0 ? (
              <p className="quiet-line">Nothing in the next two weeks</p>
            ) : (
              <div className="card comp-list">
                {overview.comingUp.map(({ competition: c, session: s }) => (
                  <Link key={s.id} href={`/admin/night/${s.id}`} className="comp-list-row">
                    <span className="comp-list-main">
                      <strong>
                        {shortDate(s.date!)} &middot; {c.name}
                      </strong>
                      <span className="hint">
                        {[sessionLabel(c, s), sessionTimes(s), c.organiser.short_name].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="home-section">
            <div className="home-section-head">
              <h2>Latest changes</h2>
            </div>
            {log.length === 0 ? (
              <p className="quiet-line">No changes yet</p>
            ) : (
              <div className="card comp-list">
                {log.map((r) => (
                  <div key={r.id} className="comp-list-row">
                    <span className="comp-list-main">
                      <strong>{actionLabel(r.action)}</strong>
                      <span className="hint">
                        {r.competition ?? "Set-up"} &middot;{" "}
                        {new Date(r.at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
