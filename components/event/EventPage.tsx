"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HowToQualify from "@/components/HowToQualify";
import PublicFooter from "@/components/PublicFooter";
import { SponsorPanel } from "@/components/Sponsors";
import { longDate } from "@/lib/competitionSetup";
import { listPosts, POST_KIND_LABEL, type EventPost } from "@/lib/postsApi";
import {
  PALETTE,
  competitionPath,
  dateRange,
  daysUntil,
  whatItIs,
  isTrophyDay,
  publicStatus,
  shortDate,
  todayIso,
  type EventRef,
  type PublicCompetition,
} from "@/lib/publicCompetitions";
import { loadPublicQualifying } from "@/lib/publicQualifying";
import { SITE_NAME } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import StatusLabel from "@/components/home/StatusLabel";

type Tab = "overview" | "competitions" | "qualifying" | "news";
const TABS: Record<Tab, string> = { overview: "Overview", competitions: "Competitions", qualifying: "Qualifying", news: "News" };

function tabFromHash(): Tab {
  const h = typeof window === "undefined" ? "" : window.location.hash.replace("#", "");
  return (Object.keys(TABS) as Tab[]).includes(h as Tab) ? (h as Tab) : "overview";
}

// An event with several competitions (the Blackpool Masters): Overview -
// how long to go, the days, who's qualified, adverts and the latest news -
// then its Competitions, Qualifying (how to qualify) and News.
export default function EventPage({ event, all }: { event: EventRef; all: PublicCompetition[] }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [posts, setPosts] = useState<EventPost[]>([]);
  const [qualified, setQualified] = useState<{ done: number; total: number } | null>(null);
  const today = todayIso();
  const comps = [...event.competitions].sort((a, b) =>
    (a.sessions.find((s) => s.date)?.date ?? "9").localeCompare(b.sessions.find((s) => s.date)?.date ?? "9")
  );
  const qualifyingComps = comps.filter((c) => c.entry_method === "qualification");
  const dates = comps.flatMap((c) => c.sessions.map((s) => s.date)).filter((d): d is string => Boolean(d)).sort();
  const firstDate = dates[0] ?? null;

  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = `${event.organiser.name} ${event.year} · ${SITE_NAME}`;
    listPosts(event.organiser.id, event.year)
      // Only what's published and due (Super also sees drafts from the database)
      .then((list) => setPosts(list.filter((p) => p.published && p.show_from <= today)))
      .catch(() => setPosts([]));
    if (qualifyingComps[0]) {
      loadPublicQualifying(qualifyingComps[0].id)
        .then((places) => setQualified({ done: places.filter((p) => p.who).length, total: places.length }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.organiser.id, event.year]);

  function show(next: Tab) {
    setTab(next);
    history.replaceState(null, "", next === "overview" ? window.location.pathname : `#${next}`);
    window.scrollTo({ top: 0 });
  }

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
    <div className="page page-photo event-page">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader compact />
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

      <div className="comp-tabs event-tabs" role="tablist">
        {(Object.keys(TABS) as Tab[])
          .filter((t) => t !== "qualifying" || qualifyingComps.length > 0)
          .map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`comp-tab ${tab === t ? "comp-tab-on" : ""}`} onClick={() => show(t)}>
              {TABS[t]}
            </button>
          ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Its days, like a competition's sessions: one row each */}
          <div className="card comp-schedule">
            {comps.map((c) => {
              const day = c.sessions.find((s) => isTrophyDay(s.kind) && s.date) ?? c.sessions.find((s) => s.date);
              const status = publicStatus(c, today);
              return (
                <Link key={c.id} href={competitionPath(c, all)} className={`comp-schedule-row ${status === "live" ? "comp-schedule-live" : ""}`}>
                  <span className="comp-schedule-main">
                    <span className="comp-schedule-line">
                      <strong>{day?.date ? shortDate(day.date) : "Date TBC"}</strong> &middot; {c.name}
                    </span>
                  </span>
                  {status === "live" ? (
                    <StatusLabel status="live" />
                  ) : (
                    <span className="comp-schedule-open" aria-hidden="true">
                      &rsaquo;
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {qualified && qualified.total > 0 && (
            <section className="home-section">
              <div className="home-section-head">
                <h2>Who&rsquo;s qualified</h2>
                <button type="button" className="link-button event-more" onClick={() => show("qualifying")}>
                  See all
                </button>
              </div>
              <div className="card">
                <strong>
                  {qualified.done} of {qualified.total} places decided
                </strong>
                <div className="qualifying-meter" aria-hidden="true">
                  <i style={{ width: `${(qualified.done / qualified.total) * 100}%`, background: "var(--green-deep)" }} />
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
                <button type="button" className="link-button event-more" onClick={() => show("news")}>
                  All news
                </button>
              </div>
              <PostList posts={news.slice(0, 2)} slug={slug} year={event.year} all={all} />
            </section>
          )}
        </>
      )}

      {tab === "competitions" && (
        <div className="card comp-rows">
          {comps.map((c) => {
            const status = publicStatus(c, today);
            const day = c.sessions.find((s) => s.date);
            return (
              <Link key={c.id} href={competitionPath(c, all)} className="comp-row" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="comp-bar" style={{ background: PALETTE[comps.indexOf(c) % PALETTE.length] }} />
                <span className="comp-row-text">
                  <span className="comp-row-top">
                    <strong className="comp-row-name">{c.name}</strong>
                    <StatusLabel status={status} />
                  </span>
                  <span className="comp-row-line">
                    {c.champion ? (
                      <>
                        Champion <strong>{c.champion.name}</strong>
                      </>
                    ) : (
                      `${whatItIs(c)} · ${day?.date ? longDate(day.date) : "Date to be confirmed"}`
                    )}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {tab === "qualifying" &&
        qualifyingComps.map((c) => (
          <div key={c.id}>
            {qualifyingComps.length > 1 && <h2 className="comp-list-year">{c.name}</h2>}
            <HowToQualify competitionId={c.id} all={all} />
          </div>
        ))}

      {tab === "news" && (
        <>
          {news.length === 0 && <p className="night-header-hint">No news yet.</p>}
          <PostList posts={news} slug={slug} year={event.year} all={all} />
          {adverts.map((a) => (
            <Advert key={a.id} post={a} />
          ))}
        </>
      )}

      <PublicFooter />
    </div>
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
