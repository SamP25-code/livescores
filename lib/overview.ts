// The SuperAdmin overview: everything across every competition on one
// screen - what's on now, what's coming up, and what needs doing before it
// can go ahead. Pure; the page loads what it needs.
import { drawState } from "@/lib/adminHome";
import { entryCapacity } from "@/lib/people";
import { daysUntil, publicStatus, type PublicCompetition, type PublicSession } from "@/lib/publicCompetitions";

export type OverviewSession = { competition: PublicCompetition; session: PublicSession };

export type Attention = {
  competition: PublicCompetition;
  session: PublicSession | null;
  // Worst first: "now" (in the next 3 days), "soon" (the next fortnight), "later"
  urgency: "now" | "soon" | "later";
  message: string;
};

export type Overview = {
  live: OverviewSession[];
  comingUp: OverviewSession[];
  attention: Attention[];
};

const URGENCY_ORDER = { now: 0, soon: 1, later: 2 } as const;

export function buildOverview(
  all: PublicCompetition[],
  // Each competition's assigned admins, by competition id
  admins: Map<string, number>,
  today: string,
  days = 14
): Overview {
  const live: OverviewSession[] = [];
  const comingUp: OverviewSession[] = [];
  const attention: Attention[] = [];

  for (const c of all) {
    const status = publicStatus(c, today);
    if (status === "finished") continue;

    for (const s of c.sessions) {
      if (s.status === "live") live.push({ competition: c, session: s });
      else if (s.date && s.status !== "complete" && daysUntil(today, s.date) >= 0 && daysUntil(today, s.date) <= days) {
        comingUp.push({ competition: c, session: s });
      }
    }

    // What needs doing, for the next session still to play
    const next = c.sessions
      .filter((s) => s.date && s.date >= today && s.status === "upcoming")
      .sort((a, b) => a.date!.localeCompare(b.date!))[0];
    const away = next?.date ? daysUntil(today, next.date) : null;
    const urgency: Attention["urgency"] = away === null ? "later" : away <= 3 ? "now" : away <= days ? "soon" : "later";

    if ((admins.get(c.id) ?? 0) === 0) {
      attention.push({ competition: c, session: next ?? null, urgency, message: "No admin assigned" });
    }
    if (!c.sessions.some((s) => s.date)) {
      attention.push({ competition: c, session: null, urgency: "later", message: "Dates to be confirmed" });
    }
    if (!c.venue_id && !c.sessions.some((s) => s.venue_id)) {
      attention.push({ competition: c, session: next ?? null, urgency, message: "Where it's played isn't set" });
    }
    if (next && away !== null && away <= days) {
      const capacity = entryCapacity(c);
      if (capacity && c.entryCount < capacity && next.kind !== "finals") {
        attention.push({ competition: c, session: next, urgency, message: `${c.entryCount} of ${capacity} entered` });
      }
      const draw = drawState(next);
      if (draw === "not_made" && next.kind !== "finals") {
        attention.push({ competition: c, session: next, urgency, message: "Draw not made" });
      } else if (draw === "made_hidden" && away <= 3) {
        attention.push({ competition: c, session: next, urgency, message: "Draw made, not published" });
      }
    }
  }

  const byDate = (a: OverviewSession, b: OverviewSession) =>
    (a.session.date ?? "").localeCompare(b.session.date ?? "") || a.competition.name.localeCompare(b.competition.name);
  live.sort(byDate);
  comingUp.sort(byDate);
  attention.sort(
    (a, b) =>
      URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
      (a.session?.date ?? "9999").localeCompare(b.session?.date ?? "9999") ||
      a.competition.name.localeCompare(b.competition.name)
  );
  return { live, comingUp, attention };
}

// The change log, in words
const ACTION_LABEL: Record<string, string> = {
  draw_made: "Draw made",
  match_time_set: "Match time changed",
  no_show: "Didn't turn up",
  no_show_undone: "Turned up after all",
  postponed: "Postponed",
  postponement_cancelled: "Postponement cancelled",
  replaced: "Player replaced",
  result_corrected: "Result corrected",
  time_slots_set: "Start times set",
  venue_set: "Venue changed",
  entry_added: "Entry added",
  entry_changed: "Entry changed",
  entry_moved: "Entry moved to another session",
  entry_removed: "Entry removed",
  complete: "Match finished",
  reopen: "Match reopened",
  qualified: "Qualified",
  qualifier_results: "Qualifier results entered",
  wildcard_filled: "Wildcard chosen",
  wildcard_set: "Place made a wildcard",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());
}
