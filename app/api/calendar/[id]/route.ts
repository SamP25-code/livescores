import { supabase } from "@/lib/supabaseClient";
import { loadPublicCompetitions } from "@/lib/publicData";
import { competitionPath } from "@/lib/publicCompetitions";
import { buildIcs, calendarSessions, londonToday } from "@/lib/calendar";
import type { Venue } from "@/lib/types";

export const dynamic = "force-dynamic";

// "Add to calendar": /api/calendar/<competition id> is every session still
// to come; ?session=<id> is just that one. A link rather than a download
// made in the page, so an iPhone opens it straight in Calendar.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");

  const all = await loadPublicCompetitions();
  const c = all.find((x) => x.id === id);
  if (!c) return new Response("Competition not found", { status: 404 });

  const sessions = sessionId
    ? c.sessions.filter((s) => s.id === sessionId && s.date)
    : calendarSessions(c, londonToday());
  if (sessions.length === 0) return new Response("No dates to add yet", { status: 404 });

  const venueIds = [...new Set([c.venue_id, ...sessions.map((s) => s.venue_id)].filter((v): v is string => Boolean(v)))];
  const { data } = venueIds.length
    ? await supabase.from("venues").select("*").in("id", venueIds)
    : { data: [] as Venue[] };

  const ics = buildIcs({
    competition: c,
    sessions,
    venues: (data ?? []) as Venue[],
    pageUrl: `${url.origin}${competitionPath(c, all)}`,
    // The same on every address (www or not, previews), so adding a session
    // again updates it rather than doubling it
    host: "crowngreenlive.co.uk",
  });
  const name = `${c.slug}-${c.year}`.replace(/[^a-z0-9-]/gi, "");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${name}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
