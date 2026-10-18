"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { createNight } from "@/lib/adminActions";
import { errorMessage } from "@/lib/errors";
import { fetchNightStatuses } from "@/lib/nightStatus";
import { isAnyAdmin, pageRoleFor, useAccess, visibleCompetition } from "@/lib/access";
import Brand from "@/components/Brand";
import { splitNightName } from "@/components/NightNav";
import type { NightStatus } from "@/lib/bracket";
import type { Night } from "@/lib/types";

export default function AdminDashboard() {
  const access = useAccess();
  const [nights, setNights] = useState<Night[]>([]);
  // Competition names for grouping the list (2027 structure); empty on a
  // database not yet moved over, where the list is one group as before.
  const [competitionNames, setCompetitionNames] = useState<Record<string, { title: string; order: number }>>({});
  const [statuses, setStatuses] = useState<Record<string, NightStatus>>({});
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"qualifier" | "finals">("qualifier");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [{ data }, statusesByNight] = await Promise.all([
      supabase.from("nights").select("*").order("created_at", { ascending: true }),
      fetchNightStatuses(),
    ]);
    const all = (data ?? []) as Night[];
    setNights(all);
    setStatuses(statusesByNight);
    if (all.some((n) => n.competition_id)) {
      const { data: comps } = await supabase
        .from("competitions")
        .select("id, year, status, series:series_id(name)")
        .order("year", { ascending: false });
      const rank = { active: 0, planned: 1, archived: 2 } as const;
      setCompetitionNames(
        Object.fromEntries(
          (comps ?? []).map((c) => {
            const series = c.series as unknown as { name: string } | null;
            return [
              c.id,
              {
                title: `${series?.name ?? "Competition"} ${c.year}`,
                order: rank[c.status as keyof typeof rank] * 10000 - c.year,
              },
            ];
          })
        )
      );
    }
  }

  useEffect(() => {
    document.title = "Admin · Penwortham Singles";
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  // Super sees every session; anyone else the competitions they're assigned
  // to. Old nights from before the 2027 move (no competition) show as before.
  const visibleNights =
    access === null
      ? []
      : nights.filter((n) => !n.competition_id || visibleCompetition(access, n.competition_id));
  // Making a night by hand is the old way, before competitions existed; now
  // sessions come from a competition's set-up
  const oldStyle = !nights.some((n) => n.competition_id);
  const canCreateNight = access !== null && oldStyle && pageRoleFor(access, null) === "owner";
  const scorerOnly = access !== null && !isAnyAdmin(access) && (access.roles.size > 0 || access.legacyRole === "scorer");

  // Nights grouped by competition: active first, then planned, then
  // finished; nights not in a competition last. In order within each.
  const groups = (() => {
    const byKey = new Map<string, Night[]>();
    for (const night of visibleNights) {
      const key = night.competition_id ?? "";
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(night);
    }
    return [...byKey.entries()]
      .map(([key, list]) => ({
        key,
        title: key ? competitionNames[key]?.title ?? null : null,
        order: key ? competitionNames[key]?.order ?? 99999 : 999999,
        nights: list.sort((a, b) => (a.session_number ?? a.sort_order) - (b.session_number ?? b.sort_order)),
      }))
      .sort((a, b) => a.order - b.order);
  })();
  const grouped = groups.some((g) => g.title);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    try {
      await createNight(name.trim(), kind);
      setName("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="page page-photo">
      <div className="top-bar">
        <Brand />
      </div>

      {canCreateNight && (
        <>
          <h1>New competition night</h1>
          <form onSubmit={handleCreate} className="card">
            <div className="field">
              <label htmlFor="night-name">Name</label>
              <input
                id="night-name"
                placeholder="Qualifying Night 3"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="night-kind">Type</label>
              <select id="night-kind" value={kind} onChange={(e) => setKind(e.target.value as "qualifier" | "finals")}>
                <option value="qualifier">Qualifying night</option>
                <option value="finals">Finals day</option>
              </select>
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit">Create night</button>
          </form>
        </>
      )}

      <h1>All nights</h1>
      {scorerOnly && <p className="hint">You can score a session once its draw has been published.</p>}
      {access !== null && visibleNights.length === 0 && (
        <p className="empty">
          {canCreateNight
            ? "Nothing set up yet - create your first night above."
            : access.isSuper
              ? "Nothing set up yet - start with a new competition."
              : "You're not assigned to a competition yet - ask its organiser to add you."}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.key || "none"}>
          {grouped && <h2 className="admin-night-group">{group.title ?? "Not in a competition"}</h2>}
          <nav className="night-list">
            {group.nights.map((night) => {
              const status = statuses[night.id] ?? "upcoming";
              const split = splitNightName(night);
              return (
                <Link key={night.id} href={`/admin/night/${night.id}`} className={`night-card night-card-${night.kind}`}>
                  <span className="night-card-name">
                    {split ? (
                      <>
                        <span className="night-card-day">{split.day}</span>
                        <span className="night-card-date">{split.rest}</span>
                      </>
                    ) : (
                      night.name
                    )}
                  </span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {night.kind === "qualifier" && !night.draw_published && (
                      <span className="status-pill status-pill-hidden">Draw hidden</span>
                    )}
                    {status !== "upcoming" && (
                      <span className={`status-pill ${status}`}>
                        {status === "live" && <span className="live-dot" />}
                        {status === "live" ? "Live" : "Finished"}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>
      ))}
    </div>
  );
}
