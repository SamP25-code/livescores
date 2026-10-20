"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useIsSuper } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { POST_KIND_LABEL, deletePost, listPosts, savePost, type EventPost } from "@/lib/postsApi";
import { shortDate, todayIso } from "@/lib/publicCompetitions";
import { SITE_NAME } from "@/lib/site";
import { supabase } from "@/lib/supabaseClient";
import PostForm from "@/components/PostForm";
import type { Organiser } from "@/lib/types";

// An event's page, behind the scenes (Super): its web address, and its posts
// for the year - news, qualifier updates and adverts. Its competitions are
// set up as usual; this is the page that brings them together.
export default function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isSuper = useIsSuper();
  const [event, setEvent] = useState<(Organiser & { slug?: string | null }) | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [posts, setPosts] = useState<EventPost[] | null>(null);
  const [qualifiers, setQualifiers] = useState<{ id: string; name: string }[]>([]);
  // This year's competitions in the event
  const [comps, setComps] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // post id, or "new"
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuper) return;
    (async () => {
      const [{ data: org }, { data: comps }] = await Promise.all([
        supabase.from("organisers").select("*").eq("id", id).single(),
        supabase.from("competitions").select("id, year, series:series_id!inner(organiser_id)").eq("series.organiser_id", id),
      ]);
      setEvent(org as Organiser | null);
      const ys = [...new Set((comps ?? []).map((c) => c.year as number))].sort((a, b) => b - a);
      setYears(ys);
      const thisYear = Number(todayIso().slice(0, 4));
      setYear(ys.includes(thisYear) ? thisYear : (ys[0] ?? thisYear));
    })().catch((err) => setError(errorMessage(err)));
  }, [id, isSuper]);

  async function load() {
    if (year === null) return;
    try {
      setPosts(await listPosts(id, year));
      const { data: comps } = await supabase
        .from("competitions")
        .select("id, series:series_id!inner(organiser_id, name)")
        .eq("series.organiser_id", id)
        .eq("year", year);
      setComps(
        (comps ?? []).map((c) => ({ id: c.id, name: (c.series as unknown as { name: string }).name }))
      );
      const ids = (comps ?? []).map((c) => c.id);
      const { data: q } = ids.length
        ? await supabase.from("qualifier_events").select("id, name").in("competition_id", ids).order("name")
        : { data: [] };
      setQualifiers(q ?? []);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    document.title = `${event?.name ?? "Event"} · Admin · ${SITE_NAME}`;
  }, [event]);

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <p className="hint">Only Sam (Super) can change an event&rsquo;s page.</p>
      </div>
    );
  }

  const today = todayIso();

  return (
    <div className="page page-photo">
      <Link href="/admin/competitions" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Competitions
      </Link>
      <h1>{event?.name ?? "Loading…"}</h1>
      {event?.slug && (
        <p className="hint">
          Its page: <Link href={`/${event.slug}`}>/{event.slug}</Link>
          {year ? ` · /${event.slug}-${year}` : ""}
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {message && !error && <p className="hint">{message}</p>}

      <h2>Competitions{year ? ` ${year}` : ""}</h2>
      <div className="card comp-list">
        {comps.length === 0 && <p className="hint">None yet.</p>}
        {comps.map((c) => (
          <Link key={c.id} href={`/admin/competitions/${c.id}`} className="comp-list-row">
            <span className="comp-list-main">
              <strong>{c.name}</strong>
            </span>
            <span className="comp-list-open">Open ›</span>
          </Link>
        ))}
      </div>
      <p>
        <Link href={`/admin/competitions/new?event=${id}`} className="button">
          + Add a competition to the {event?.name ?? "event"}
        </Link>
      </p>

      <div className="comp-list-head">
        <h2>Posts</h2>
        {years.length > 1 && year !== null && (
          <select aria-label="Year" className="home-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {editing === "new" && event && year !== null ? (
        <PostForm
          organiserId={event.id}
          year={year}
          qualifiers={qualifiers}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            await savePost(null, input);
            setEditing(null);
            setMessage(input.published ? "Published." : "Saved as a draft.");
            await load();
          }}
        />
      ) : (
        <button type="button" onClick={() => setEditing("new")} disabled={year === null}>
          + Add a post
        </button>
      )}

      <div className="card comp-list" style={{ marginTop: 12 }}>
        {posts === null && <p className="hint">Loading&hellip;</p>}
        {posts?.length === 0 && <p className="hint">No posts yet.</p>}
        {posts?.map((p) =>
          editing === p.id && event && year !== null ? (
            <PostForm
              key={p.id}
              organiserId={event.id}
              year={year}
              initial={p}
              qualifiers={qualifiers}
              onCancel={() => setEditing(null)}
              onSave={async (input) => {
                await savePost(p.id, input);
                setEditing(null);
                setMessage("Saved.");
                await load();
              }}
            />
          ) : (
            <div key={p.id} className="comp-list-row">
              <span className="comp-list-main">
                <strong>
                  {p.pinned ? "📌 " : ""}
                  {p.title}
                </strong>
                <span className="hint">
                  {POST_KIND_LABEL[p.kind]} ·{" "}
                  {!p.published ? "Draft" : p.show_from > today ? `Shows from ${shortDate(p.show_from)}` : `Published ${shortDate(p.show_from)}`}
                </span>
              </span>
              <span className="entries-actions">
                <button type="button" className="link-button" onClick={() => setEditing(p.id)}>
                  Change
                </button>
                <button
                  type="button"
                  className="link-button comp-form-remove"
                  onClick={async () => {
                    if (!confirm(`Delete "${p.title}"?`)) return;
                    try {
                      await deletePost(p.id);
                      setMessage("Deleted.");
                      await load();
                    } catch (err) {
                      setError(errorMessage(err));
                    }
                  }}
                >
                  Delete
                </button>
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
