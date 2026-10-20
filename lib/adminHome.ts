// What each competition's card on the admin home page says: the session that
// needs attention (the live one, or the next one), where its draw has got
// to, and how many are entered - so an organiser sees what to do next.
import { entryCapacity } from "@/lib/people";
import { nextSession, type PublicCompetition, type PublicSession } from "@/lib/publicCompetitions";

export type DrawState = "not_made" | "made_hidden" | "published";

export type CardSummary = {
  // The live session, or the next one still to play
  focus: PublicSession | null;
  live: boolean;
  drawState: DrawState | null;
  entered: number;
  capacity: number | null;
};

export function drawState(s: Pick<PublicSession, "matchCount" | "draw_published" | "kind">): DrawState {
  if (!s.matchCount) return "not_made";
  // Finals Day fills itself and always shows
  return s.draw_published || s.kind === "finals" ? "published" : "made_hidden";
}

export const DRAW_LABEL: Record<DrawState, string> = {
  not_made: "Draw not made",
  made_hidden: "Draw made, not published",
  published: "Draw published",
};

export function cardSummary(c: PublicCompetition, today: string): CardSummary {
  const live = c.sessions.find((s) => s.status === "live") ?? null;
  const focus = live ?? nextSession(c, today);
  return {
    focus,
    live: Boolean(live),
    drawState: focus ? drawState(focus) : null,
    entered: c.entryCount,
    capacity: entryCapacity(c),
  };
}
