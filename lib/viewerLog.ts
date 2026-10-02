import { supabase } from "@/lib/supabaseClient";

// How often an open public page tells the database it's still being watched.
// Twice a minute so every minute gets at least one ping even if a timer runs
// late; the database keeps one row per viewer per minute regardless.
export const PING_INTERVAL_MS = 30_000;

const VIEWER_ID_KEY = "bowls-viewer-id";

// One id per phone/browser, kept between visits so a viewer who refreshes
// or comes back later still counts once. Falls back to a fresh id per page
// load if storage is blocked (private browsing).
function viewerId(): string {
  try {
    const existing = localStorage.getItem(VIEWER_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VIEWER_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// Starts pinging for a night's public page and returns a function that
// stops it. Failures are ignored - the log is a nice-to-have and must never
// get in the way of the scores.
export function startViewerPings(nightId: string): () => void {
  const id = viewerId();

  // Through log_viewer() rather than an insert on the table - see schema.sql.
  function ping() {
    supabase
      .rpc("log_viewer", { p_night_id: nightId, p_viewer_id: id })
      .then(
        () => {},
        () => {}
      );
  }

  ping();
  const timer = setInterval(ping, PING_INTERVAL_MS);
  return () => clearInterval(timer);
}

export type ViewerCount = { minute: string; viewers: number };

export async function fetchViewerLog(
  nightId: string
): Promise<{ counts: ViewerCount[]; uniqueViewers: number }> {
  const [{ data: counts, error: countsError }, { data: totals, error: totalsError }] = await Promise.all([
    supabase.from("viewer_counts").select("minute, viewers").eq("night_id", nightId).order("minute"),
    supabase.from("viewer_totals").select("unique_viewers").eq("night_id", nightId).maybeSingle(),
  ]);
  if (countsError) throw countsError;
  if (totalsError) throw totalsError;
  return { counts: counts ?? [], uniqueViewers: totals?.unique_viewers ?? 0 };
}

const MINUTE_MS = 60_000;

export type ViewerPoint = { time: number; viewers: number };

// One point per minute from the first ping to the last, with the quiet
// minutes in between filled in as 0 rather than skipped - otherwise a gap
// where nobody was watching would be drawn as a straight line between the
// minutes either side.
export function buildViewerSeries(counts: ViewerCount[]): ViewerPoint[] {
  if (counts.length === 0) return [];
  const byMinute = new Map(counts.map((c) => [new Date(c.minute).getTime(), c.viewers]));
  const times = [...byMinute.keys()];
  const first = Math.min(...times);
  const last = Math.max(...times);
  const series: ViewerPoint[] = [];
  for (let t = first; t <= last; t += MINUTE_MS) {
    series.push({ time: t, viewers: byMinute.get(t) ?? 0 });
  }
  return series;
}

// The busiest minute - the earliest one if the peak was hit more than once.
export function peakOf(series: ViewerPoint[]): ViewerPoint | null {
  let peak: ViewerPoint | null = null;
  for (const point of series) {
    if (!peak || point.viewers > peak.viewers) peak = point;
  }
  return peak;
}

// The point for the minute containing `time`, clamped to the log's range.
export function pointAt(series: ViewerPoint[], time: number): ViewerPoint | null {
  if (series.length === 0) return null;
  const index = Math.floor((time - series[0].time) / MINUTE_MS);
  return series[Math.max(0, Math.min(series.length - 1, index))];
}
