"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HowToQualify from "@/components/HowToQualify";
import PublicPage from "@/components/PublicPage";
import { SponsorPanel } from "@/components/Sponsors";
import { listPosts, POST_KIND_LABEL, type EventPost } from "@/lib/postsApi";
import {
  PALETTE,
  competitionPath,
  dateRange,
  daysUntil,
  isTrophyDay,
  publicStatus,
  shortDate,
  todayIso,
  type EventRef,
  type PublicCompetition,
} from "@/lib/publicCompetitions";
import { loadPublicQualifying } from "@/lib/publicQualifying";
import { SITE_NAME } from "@/lib/site";
import { usePageBackground } from "@/lib/backgrounds";
import CompetitionRow from "@/components/home/CompetitionRow";
import MonthGroups from "@/components/home/MonthGroups";
import RowLine from "@/components/home/RowLine";

// An event with several competitions (the Blackpool Masters), all on one
// page: how long to go, its days (each opens that competition - the
// Invitation's page lists its qualifying competitions), who's qualified so
// far, adverts and every news post.
export default function EventPage({ event, all }: { event: EventRef; all: PublicCompetition[] }) {
  // The event's own background on its page
  usePageBackground(event.organiser.background_image ?? null);
  const [posts, setPosts] = useState<EventPost[]>([]);
  // Qualifying for the event: places decided so far, and the next final
  const [qualified, setQualified] = useState<{
    done: number;
    total: number;
    next: { name: string; date: string } | null;
  } | null>(null);
  const today = todayIso();
  const comps = [...event.competitions].sort((a, b) =>
    (a.sessions.find((s) => s.date)?.date ?? "9").localeCompare(b.sessions.find((s) => s.date)?.date ?? "9")
  );
  const qualifyingComps = comps.filter((c) => c.entry_method === "qualification");
  const dates = comps.flatMap((c) => c.sessions.map((s) => s.date)).filter((d): d is string => Boolean(d)).sort();
  const firstDate = dates[0] ?? null;

  useEffect(() => {
    document.title = `${event.organiser.name} ${event.year} · ${SITE_NAME}`;
    listPosts(event.organiser.id, event.year)
      // Only what's published and due (Super also sees drafts from the database)
      .then((list) => setPosts(list.filter((p) => p.published && p.show_from <= today)))
      .catch(() => setPosts([]));
    if (qualifyingComps[0]) {
      loadPublicQualifying(qualifyingComps[0].id)
        .then((places) => {
          const next = places
            .filter((p) => !p.wildcard && !p.who && p.finalDate && p.finalDate >= today)
            .sort((a, b) => a.finalDate!.localeCompare(b.finalDate!))[0];
          setQualified({
            done: places.filter((p) => p.who).length,
            total: places.length,
            next: next ? { name: next.name, date: next.finalDate! } : null,
          });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.organiser.id, event.year]);

  // The event's sponsors: everyone sponsoring any of its competitions, once
  const sponsors = comps
    .flatMap((c) => c.sponsors)
    .filter((s, i, list) => list.findIndex((x) => x.name === s.name) === i);
  const adverts = posts.filter((p) => p.kind === "advert");
  const news = posts.filter((p) => p.kind !== "advert");
  const live = comps.some((c) => publicStatus(c, today) === "live");
  const days = firstDate ? daysUntil(today, firstDate) : null;
  const slug = event.organiser.slug ?? "";

  return (
    <PublicPage loading={false} failed={false}>
      <header className="comp-page-head">
        <h1 className="comp-page-title">{event.organiser.name}</h1>
        <p className="comp-page-by">
          {[
            firstDate ? `${dateRange(firstDate, dates[dates.length - 1])} ${event.year}` : "Dates to be confirmed",
            `${comps.length} competition${comps.length === 1 ? "" : "s"}`,
            !live && days !== null && days > 0 ? `${days} day${days === 1 ? "" : "s"} to go` : null,
            !live && days === 0 ? "Today" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <SponsorPanel sponsors={sponsors} />
      </header>

          <div className="event-days">
            {comps.map((c, i) => {
              const day = c.sessions.find((s) => isTrophyDay(s.kind) && s.date) ?? c.sessions.find((s) => s.date);
              const status = publicStatus(c, today);
              return (
                <Link key={c.id} href={competitionPath(c, all)} className={`event-day ${day?.date === today ? "event-day-today" : ""}`}>
                  <span className="event-day-label">{day?.date ? shortDate(day.date).split(" ").slice(0, 2).join(" ") : "TBC"}</span>
                  <span className="cal-trophy event-day-ring" style={{ background: PALETTE[i % PALETTE.length] }}>
                    {day?.date ? Number(day.date.slice(8)) : "?"}
                  </span>
                  <span className="event-day-name">{c.name}</span>
                  {status === "live" && <span className="cal-live">&bull; Live</span>}
                </Link>
              );
            })}
          </div>

          {qualified && qualified.total > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h2>Qualifying</h2>
                {qualifyingComps[0] && (
                  <Link href={competitionPath(qualifyingComps[0], all)} className="link-button event-more">
                    See all
                  </Link>
                )}
              </div>
              <div className="card">
                {qualified.next && (
                  <strong className="event-next-final">
                    Next final: {qualified.next.name} &middot; {shortDate(qualified.next.date)}
                  </strong>
                )}
                <span className="event-places">
                  {qualified.done} of {qualified.total} place{qualified.total === 1 ? "" : "s"} decided
                </span>
                <div className="qualifying-meter" aria-hidden="true">
                  <i style={{ width: `${(qualified.done / qualified.total) * 100}%` }} />
                </div>
              </div>
            </section>
          )}

          {adverts.map((a) => (
            <Advert key={a.id} post={a} />
          ))}

          {news.length > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h2>News</h2>
              </div>
              <PostList posts={news} slug={slug} year={event.year} all={all} />
            </section>
          )}

    </PublicPage>
  );
}

function postHref(slug: string, year: number, all: PublicCompetition[], id: string): string {
  const years = all.filter((c) => c.organiser.slug === slug).map((c) => c.year);
  const base = Math.max(...years, year) === year ? `/${slug}` : `/${slug}-${year}`;
  return `${base}/news/${id}`;
}

function PostList({ posts, slug, year, all }: { posts: EventPost[]; slug: string; year: number; all: PublicCompetition[] }) {
  return (
    <div className="card comp-rows">
      {posts.map((p) => (
        <Link key={p.id} href={postHref(slug, year, all, p.id)} className="event-post">
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image_url} alt="" className="event-post-pic" />
          ) : (
            <span className="event-post-pic event-post-pic-empty" aria-hidden="true" />
          )}
          <span className="event-post-text">
            <span className={`event-post-tag event-post-tag-${p.kind}`}>{POST_KIND_LABEL[p.kind]}</span>
            <strong>{p.title}</strong>
            <span className="hint">{shortDate(p.show_from)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function Advert({ post }: { post: EventPost }) {
  const inner = (
    <>
      {post.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="" className="event-advert-logo" />
      ) : null}
      <span className="event-advert-text">
        <span className="event-advert-label">Advert</span>
        <strong>{post.title}</strong>
        {post.body && <span className="hint">{post.body}</span>}
      </span>
    </>
  );
  return post.link_url ? (
    <a href={post.link_url} target="_blank" rel="noopener noreferrer sponsored" className="event-advert">
      {inner}
    </a>
  ) : (
    <div className="event-advert">{inner}</div>
  );
}
