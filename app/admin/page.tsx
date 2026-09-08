"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { createNight } from "@/lib/adminActions";
import type { Night } from "@/lib/types";

export default function AdminDashboard() {
  const [nights, setNights] = useState<Night[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"qualifier" | "finals">("qualifier");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase.from("nights").select("*").order("created_at", { ascending: true });
    setNights(data ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    try {
      await createNight(name.trim(), kind);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="page">
      <div className="top-bar">
        <span className="brand">Bowls Live &middot; Admin</span>
        <nav>
          <Link href="/">Public site</Link>
          <a href="#" onClick={() => supabase.auth.signOut()}>
            Sign out
          </a>
        </nav>
      </div>

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

      <h1>All nights</h1>
      {nights.length === 0 && <p className="empty">Nothing set up yet &mdash; create your first night above.</p>}
      {nights.map((night) => (
        <Link key={night.id} href={`/admin/night/${night.id}`} style={{ textDecoration: "none" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "var(--ink)" }}>{night.name}</strong>
              <span className={`status-pill ${night.status}`}>{night.status}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
