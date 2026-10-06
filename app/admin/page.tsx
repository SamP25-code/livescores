"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { createNight } from "@/lib/adminActions";
import { errorMessage } from "@/lib/errors";
import { fetchNightStatuses } from "@/lib/nightStatus";
import { useAdminRole } from "@/lib/auth";
import Brand from "@/components/Brand";
import { splitNightName } from "@/components/NightNav";
import type { NightStatus } from "@/lib/bracket";
import type { Night } from "@/lib/types";

export default function AdminDashboard() {
  const role = useAdminRole();
  const [nights, setNights] = useState<Night[]>([]);
  const [statuses, setStatuses] = useState<Record<string, NightStatus>>({});
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"qualifier" | "finals">("qualifier");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [{ data }, statusesByNight] = await Promise.all([
      supabase.from("nights").select("*").order("created_at", { ascending: true }),
      fetchNightStatuses(),
    ]);
    setNights(data ?? []);
    setStatuses(statusesByNight);
  }

  useEffect(() => {
    document.title = "Admin · Penwortham Singles";
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  const visibleNights = role === null ? [] : nights;

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

      {role === "owner" && (
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
      {role === "scorer" && (
        <p className="hint">You can score a night once its draw has been published.</p>
      )}
      {visibleNights.length === 0 && (
        <p className="empty">
          {role === "scorer" ? "Nothing set up yet." : "Nothing set up yet — create your first night above."}
        </p>
      )}
      <nav className="night-list">
        {visibleNights.map((night) => {
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
    </div>
  );
}
