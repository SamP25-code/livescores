import { supabase } from "@/lib/supabaseClient";

// An open public page tells the database it's still being watched once a
// minute - halved from twice a minute to keep Supabase's free-plan log
// allowance in hand. Each ping lands near the middle of a minute rather than
// on a plain 60-second timer, which drifts and would now and then put two
// pings in one minute and none in the next (a false dip on the chart).
const MINUTE_MS = 60_000;

// Milliseconds from `now` until this viewer's next ping: the next time the
// clock reaches `offsetMs` past a minute. Each phone has its own offset
// (15-45s) so pings are spread out and stay well clear of the minute edges.
export function msUntilNextPing(now: number, offsetMs: number): number {
  const intoMinute = now % MINUTE_MS;
  const wait = offsetMs - intoMinute;
  return wait > 0 ? wait : wait + MINUTE_MS;
}

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

  // Counted straight away for the minute they arrive, then once a minute.
  ping();
  const offsetMs = 15_000 + Math.floor(Math.random() * 30_000);
  let timer: ReturnType<typeof setTimeout>;
  function scheduleNext() {
    timer = setTimeout(() => {
      ping();
      scheduleNext();
    }, msUntilNextPing(Date.now(), offsetMs));
  }
  scheduleNext();
  return () => clearTimeout(timer);
}

export type ViewerCount = { minute: string; viewers: number };

export async function fetchViewerLog(
  nightId: string
): Promise<{ counts: ViewerCount[]; uniqueViewers: number }> {
  const [counts, { data: totals, error: totalsError }] = await Promise.all([
    fetchAllCounts(nightId),
    supabase.from("viewer_totals").select("unique_viewers").eq("night_id", nightId).maybeSingle(),
  ]);
  if (totalsError) throw totalsError;
  return { counts: busiestDay(counts), uniqueViewers: totals?.unique_viewers ?? 0 };
}

const PAGE_SIZE = 1000;

// The database hands back at most 1000 rows per request, so read the whole
// log a page at a time rather than silently getting only part of it.
async function fetchAllCounts(nightId: string): Promise<ViewerCount[]> {
  const all: ViewerCount[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("viewer_counts")
      .select("minute, viewers")
      .eq("night_id", nightId)
      .order("minute")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

// Only the minutes on the day the page was busiest, oldest first - the
// night it was actually played, not a later day someone looked back at it.
export function busiestDay(counts: ViewerCount[]): ViewerCount[] {
  if (counts.length === 0) return [];
  const dayOf = (c: ViewerCount) => new Date(c.minute).toDateString();
  const totals = new Map<string, number>();
  for (const c of counts) totals.set(dayOf(c), (totals.get(dayOf(c)) ?? 0) + c.viewers);
  const busiest = [...totals.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  return counts
    .filter((c) => dayOf(c) === busiest)
    .sort((a, b) => new Date(a.minute).getTime() - new Date(b.minute).getTime());
}

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
