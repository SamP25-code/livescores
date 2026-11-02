// What a shared link shows (WhatsApp, Facebook): each page's own title and a
// line about it, instead of just the site's name. Worked out on the server
// from a few small lookups - the pages themselves load everything in the
// browser, which link previews never see. Anything that can't be found falls
// back to the site's own title and description.
import type { Metadata } from "next";
import { supabase } from "@/lib/supabaseClient";
import { SITE_NAME } from "@/lib/site";
import { longDate } from "@/lib/competitionSetup";
import { TROPHY_LABEL } from "@/lib/publicCompetitions";

type Share = { title: string; description: string; image?: string | null };

export function shareMetadata(share: Share | null): Metadata {
  if (!share) return {};
  return {
    title: `${share.title} · ${SITE_NAME}`,
    description: share.description,
    openGraph: {
      title: share.title,
      description: share.description,
      siteName: SITE_NAME,
      // Replaces the site's own openGraph, so the general picture is given again
      images: [share.image || "/bowls-background.jpg"],
    },
  };
}

async function safely(fn: () => Promise<Share | null>): Promise<Share | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

type SeriesRow = { name: string; organiser: { name: string; short_name: string; kind: string } | null };

// "/october-singles", "/october-singles-2026", "/blackpool-masters",
// "/blackpool-masters-2027" - the same addresses the page itself understands
export function addressShare(address: string): Promise<Share | null> {
  return safely(async () => {
    const yearMatch = address.match(/^(.+)-(\d{4})$/);
    const tries: [string, number | null][] = [[address, null]];
    if (yearMatch) tries.push([yearMatch[1], Number(yearMatch[2])]);

    // A competition
    for (const [slug, year] of tries) {
      let query = supabase
        .from("competitions")
        .select("year, series:series_id!inner(slug, name, organiser:organiser_id(name, short_name, kind))")
        .eq("series.slug", slug)
        .order("year", { ascending: false })
        .limit(1);
      if (year) query = query.eq("year", year);
      const { data } = await query;
      const c = data?.[0] as unknown as { year: number; series: SeriesRow } | undefined;
      if (c) {
        const by = c.series.organiser;
        const runBy = by ? (by.kind === "event" ? by.name : by.short_name) : null;
        return {
          title: `${c.series.name} ${c.year}`,
          description: `Live scores, the draw and results${runBy ? ` · ${runBy}` : ""}`,
        };
      }
    }

    // An event (the Blackpool Masters)
    for (const [slug, year] of tries) {
      const { data: org } = await supabase.from("organisers").select("id, name").eq("slug", slug).eq("kind", "event").maybeSingle();
      if (!org) continue;
      let query = supabase
        .from("competitions")
        .select("year, series:series_id!inner(organiser_id)")
        .eq("series.organiser_id", org.id)
        .order("year", { ascending: false })
        .limit(1);
      if (year) query = query.eq("year", year);
      const { data } = await query;
      const y = data?.[0]?.year ?? year;
      return {
        title: y ? `${org.name} ${y}` : org.name,
        description: "Its competitions, how to qualify, live scores and news",
      };
    }
    return null;
  });
}

// A session: "October Singles 2026 · Session 3", with its date
export function sessionShare(nightId: string): Promise<Share | null> {
  return safely(async () => {
    const { data } = await supabase
      .from("nights")
      .select("name, kind, session_number, date, competition:competition_id(year, series:series_id(name))")
      .eq("id", nightId)
      .maybeSingle();
    if (!data) return null;
    const n = data as unknown as {
      name: string | null;
      kind: string;
      session_number: number | null;
      date: string | null;
      competition: { year: number; series: { name: string } | null } | null;
    };
    const which =
      n.kind === "qualifier"
        ? `Session ${n.session_number ?? ""}`.trim()
        : (TROPHY_LABEL[n.kind as keyof typeof TROPHY_LABEL] ?? n.name ?? "Session");
    const comp = n.competition?.series ? `${n.competition.series.name} ${n.competition.year}` : null;
    return {
      title: comp ? `${comp} · ${which}` : (n.name ?? which),
      description: [n.date ? longDate(n.date) : null, "Live scores and the draw"].filter(Boolean).join(" · "),
    };
  });
}

// A news post: its headline, the start of its words, and its picture
export function postShare(postId: string): Promise<Share | null> {
  return safely(async () => {
    const { data } = await supabase.from("event_posts").select("title, body, image_url").eq("id", postId).maybeSingle();
    if (!data) return null;
    const body = (data.body ?? "").replace(/\s+/g, " ").trim();
    return {
      title: data.title,
      description: body.length > 160 ? `${body.slice(0, 157).trimEnd()}…` : body || SITE_NAME,
      image: data.image_url,
    };
  });
}

// A player: their name (unless it's been taken off the site)
export function playerShare(personId: string): Promise<Share | null> {
  return safely(async () => {
    const { data } = await supabase.from("people").select("full_name, hidden").eq("id", personId).maybeSingle();
    if (!data || data.hidden) return null;
    return { title: data.full_name, description: "Their matches and results" };
  });
}
