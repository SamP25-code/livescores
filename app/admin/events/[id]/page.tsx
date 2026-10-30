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
import BackgroundPicker from "@/components/BackgroundPicker";
import SponsorFields, { EMPTY_SPONSOR } from "@/components/SponsorFields";
import {
  deleteOrganiser,
  listChoices,
  listEventSponsors,
  moveSeries,
  saveEventSponsors,
  type SponsorInput,
} from "@/lib/competitionsApi";
import type { Organiser, Series } from "@/lib/types";

// An event's page, behind the scenes (Super): its web address, its sponsors
// and its posts for the year - news, qualifier updates and adverts. Its competitions are
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
  // The whole event's sponsors for the year (each competition has its own too)
  const [sponsors, setSponsors] = useState<SponsorInput[]>([EMPTY_SPONSOR]);
  const [savingSponsors, setSavingSponsors] = useState(false);
  // Competitions already set up elsewhere, to bring into this event
  const [others, setOthers] = useState<{ series: Series; organiser: string }[]>([]);
  const [bringIn, setBringIn] = useState("");
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
      const choices = await listChoices();
      const names = new Map(choices.organisers.map((o) => [o.id, o.name]));
      setOthers(
        choices.series
          .filter((s) => s.organiser_id !== id)
          .map((s) => ({ series: s, organiser: names.get(s.organiser_id) ?? "" }))
          .sort((a, b) => a.organiser.localeCompare(b.organiser) || a.series.name.localeCompare(b.series.name))
      );
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
      const saved = await listEventSponsors(id, year);
      setSponsors(
        saved.length ? saved.map((s) => ({ name: s.name, url: s.url ?? "", logo_url: s.logo_url })) : [EMPTY_SPONSOR]
      );
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
        <p className="hint">Only the site admin can change an event&rsquo;s page.</p>
      </div>
    );
  }

  const today = todayIso();

  return (
    <div className="page page-photo">
      <Link href="/admin/events" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Events
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
        {comps.length === 0 && <p className="hint">No competitions yet</p>}
        {comps.map((c) => (
          <Link key={c.id} href={`/admin/competitions/${c.id}`} className="comp-list-row">
            <span className="comp-list-main">
              <strong>{c.name}</strong>
            </span>
            <span className="comp-list-open">Open</span>
          </Link>
        ))}
      </div>
      {comps.length === 0 && years.length === 0 && event && (
        <div className="card">
          <p style={{ marginTop: 0 }}>
            This event has no competitions. If it was made by mistake, it can be removed.
          </p>
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (!confirm(`Remove the event "${event.name}"?`)) return;
              try {
                await deleteOrganiser(event.id);
                window.location.href = "/admin/events";
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            Remove this event
          </button>
        </div>
      )}
      <p>
        <Link href={`/admin/competitions/new?event=${id}`} className="button">
          + Add a competition to the {event?.name ?? "event"}
        </Link>
      </p>

      {event && (
        <div className="card">
          <BackgroundPicker
            id="event-background"
            label="Its page's background (optional)"
            hint="A photo behind the event's page and its competitions' pages, instead of the site's general one."
            value={event.background_image ?? null}
            onChange={async (url) => {
              setError(null);
              const { error: saveError } = await supabase.from("organisers").update({ background_image: url }).eq("id", event.id);
              if (saveError) setError(errorMessage(saveError));
              else {
                setEvent({ ...event, background_image: url });
                setMessage(url ? "Background saved." : "Background removed.");
              }
            }}
          />
        </div>
      )}

      {event && year !== null && (
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSavingSponsors(true);
            try {
              await saveEventSponsors(event.id, year, sponsors);
              setMessage("Sponsors saved.");
              await load();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setSavingSponsors(false);
            }
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Sponsors of the {event.name} {year}
          </h2>
          <p className="hint">
            Shown at the top of the event&rsquo;s page. A competition&rsquo;s own sponsors are set up in its settings.
          </p>
          <SponsorFields id="event-sponsor" sponsors={sponsors} onChange={setSponsors} onError={setError} />
          <button type="submit" disabled={savingSponsors}>
            {savingSponsors ? "Saving…" : "Save sponsors"}
          </button>
        </form>
      )}

      {others.length > 0 && (
        <div className="card">
          <div className="field">
            <label htmlFor="event-bring-in">Or bring in a competition that&rsquo;s already set up</label>
            <select id="event-bring-in" value={bringIn} onChange={(e) => setBringIn(e.target.value)}>
              <option value="">Choose a competition</option>
              {others.map((o) => (
                <option key={o.series.id} value={o.series.id}>
                  {o.series.name} ({o.organiser})
                </option>
              ))}
            </select>
          </div>
          <p className="hint">Every year of it moves into the {event?.name ?? "event"}, with its entries and results.</p>
          <button
            type="button"
            disabled={!bringIn}
            onClick={async () => {
              const chosen = others.find((o) => o.series.id === bringIn);
              if (!chosen || !event) return;
              if (!confirm(`Move ${chosen.series.name} (every year of it) from ${chosen.organiser} into the ${event.name}?`)) return;
              try {
                await moveSeries(chosen.series.id, event.id);
                window.location.reload();
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            Move it into the {event?.name ?? "event"}
          </button>
        </div>
      )}

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

      <div className="card comp-list">
        {posts === null && <p className="hint">Loading&hellip;</p>}
        {posts?.length === 0 && <p className="hint">No posts yet</p>}
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
                  {p.pinned ? "Pinned · " : ""}
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
                    if (!confirm(`Remove "${p.title}"?`)) return;
                    try {
                      await deletePost(p.id);
                      setMessage("Removed.");
                      await load();
                    } catch (err) {
                      setError(errorMessage(err));
                    }
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
