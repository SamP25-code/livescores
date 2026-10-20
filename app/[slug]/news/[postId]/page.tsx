"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import PlayerName from "@/components/PlayerName";
import PublicFooter from "@/components/PublicFooter";
import { Advert } from "@/components/event/EventPage";
import { longDate } from "@/lib/competitionSetup";
import { getPost, listPosts, POST_KIND_LABEL, type EventPost } from "@/lib/postsApi";
import { todayIso } from "@/lib/publicCompetitions";
import { loadQualifierResults, type QualifierResults } from "@/lib/publicQualifying";
import { SITE_NAME } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

// One post on an event's page: picture, headline, date and words; for a
// qualifier update, who qualified and a link to the results; an advert
// underneath; and a way to share it.
export default function PostPage({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = use(params);
  const [post, setPost] = useState<EventPost | null | undefined>(undefined);
  const [advert, setAdvert] = useState<EventPost | null>(null);
  const [qualifier, setQualifier] = useState<QualifierResults | null>(null);
  const [shared, setShared] = useState(false);
  const today = todayIso();

  useEffect(() => {
    (async () => {
      const p = await getPost(postId);
      // Drafts and posts not yet due aren't shown
      if (!p || !p.published || p.show_from > today) {
        setPost(null);
        return;
      }
      setPost(p);
      document.title = `${p.title} · ${SITE_NAME}`;
      const others = await listPosts(p.organiser_id, p.year);
      setAdvert(others.find((o) => o.kind === "advert" && o.published && o.show_from <= today) ?? null);
      if (p.qualifier_event_id) setQualifier(await loadQualifierResults(p.qualifier_event_id));
    })().catch(() => setPost(null));
  }, [postId, today]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: post?.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
      }
    } catch {
      // Cancelled
    }
  }

  const back = `/${slug}#news`;

  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader compact />
      <Link href={back} className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> News
      </Link>
      {post === undefined && <p className="night-header-hint">Loading&hellip;</p>}
      {post === null && <p className="night-header-hint">This post isn&rsquo;t available.</p>}
      {post && (
        <article className="card event-article">
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.image_url} alt="" className="event-article-image" />
          )}
          <span className={`event-post-tag event-post-tag-${post.kind}`}>{POST_KIND_LABEL[post.kind]}</span>
          <h1 className="event-article-title">{post.title}</h1>
          <p className="hint">{longDate(post.show_from)}</p>
          {(post.body ?? "")
            .split(/\n\s*\n/)
            .filter((para) => para.trim())
            .map((para, i) => (
              <p key={i}>{para.trim()}</p>
            ))}
          {qualifier?.winner && (
            <div className="event-qualified">
              <span className="event-advert-label">Qualified</span>
              <PlayerName name={qualifier.winner} className="event-qualified-name" />
              {qualifier.qualifiesFor && <span className="hint">{qualifier.qualifiesFor.title}</span>}
            </div>
          )}
          {post.qualifier_event_id && (
            <p>
              <Link href={`/qualifier/${post.qualifier_event_id}`}>See the full {qualifier?.name ?? ""} results ›</Link>
            </p>
          )}
          {post.link_url && (
            <p>
              <a href={post.link_url} target="_blank" rel="noopener noreferrer">
                Read more ›
              </a>
            </p>
          )}
        </article>
      )}
      {post && advert && <Advert post={advert} />}
      {post && (
        <button type="button" className="secondary event-share" onClick={share}>
          {shared ? "Link copied" : "Share this post"}
        </button>
      )}
      <PublicFooter />
    </div>
  );
}
