// Qualifying for a competition entered by qualification (the Blackpool
// Masters Invitation 32): its places, each filled by the winner of a
// qualifying competition or as a wildcard. The rules, without the database.

export type ResultsDepth = "winner" | "final" | "semis" | "quarters" | "last16";

export const DEPTH_LABEL: Record<ResultsDepth, string> = {
  winner: "Just the winner (no scores)",
  final: "Just the final",
  semis: "Semi-finals and final",
  quarters: "Quarter-finals onwards",
  last16: "Last 16 onwards",
};

// Stage numbers: 1 is the final, 2 the semi-finals, 3 the quarter-finals, 4 the last 16
export const STAGE_LABEL: Record<number, string> = { 1: "Final", 2: "Semi-finals", 3: "Quarter-finals", 4: "Last 16" };

export type QualifierEvent = {
  id: string;
  competition_id: string;
  name: string;
  location: string | null;
  // The club it's played at, from Clubs (migration 2027_19)
  venue_id?: string | null;
  final_date: string | null;
  source_competition_id: string | null;
  results_depth: ResultsDepth;
  winner_person_id: string | null;
};

export type QualifierMatch = {
  stage: number;
  slot: number;
  person_a_id: string | null;
  person_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
};

export type Place = {
  id: string;
  competition_id: string;
  place_number: number;
  source: "winner_of" | "runner_up_of" | "typed_in" | "wildcard";
  source_label: string;
  qualifier_event_id: string | null;
  entry_id: string | null;
  original_source_label: string | null;
  flagged: string | null;
};

// The rounds to enter, earliest first: semi-finals then final, and so on
export function stagesFor(depth: ResultsDepth): number[] {
  return { winner: [], final: [1], semis: [2, 1], quarters: [3, 2, 1], last16: [4, 3, 2, 1] }[depth];
}

export function matchesInStage(stage: number): number {
  return 2 ** (stage - 1);
}

// Who won a match, if its result is in
export function matchWinner(m: QualifierMatch): string | null {
  if (!m.person_a_id || !m.person_b_id || m.score_a == null || m.score_b == null || m.score_a === m.score_b) return null;
  return m.score_a > m.score_b ? m.person_a_id : m.person_b_id;
}

// Who won the qualifying competition (not one run on this site - that's its champion)
export function eventWinner(e: Pick<QualifierEvent, "results_depth" | "winner_person_id">, matches: QualifierMatch[]): string | null {
  if (e.results_depth === "winner") return e.winner_person_id;
  const final = matches.find((m) => m.stage === 1 && m.slot === 0);
  return final ? matchWinner(final) : null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

// "Winner · Fylde Classic · Kirkham · Sat 5 Jun"
export function sourceLabel(e: Pick<QualifierEvent, "name" | "location" | "final_date">): string {
  return ["Winner", e.name.trim(), e.location?.trim() || null, e.final_date ? shortDay(e.final_date) : null]
    .filter(Boolean)
    .join(" · ");
}

// Problems with results before they're saved
export function resultsProblem(depth: ResultsDepth, matches: QualifierMatch[], winnerPersonId: string | null): string | null {
  if (depth === "winner") return winnerPersonId ? null : "Choose who won.";
  for (const stage of stagesFor(depth)) {
    for (let slot = 0; slot < matchesInStage(stage); slot++) {
      const m = matches.find((x) => x.stage === stage && x.slot === slot);
      const name =
        stage === 1
          ? "the final"
          : stage === 4
            ? `last 16 match ${slot + 1}`
            : `${STAGE_LABEL[stage].toLowerCase().replace(/s$/, "")} ${slot + 1}`;
      if (!m || !m.person_a_id || !m.person_b_id) {
        // Earlier rounds can be left empty; the final can't
        if (stage === 1) return "Enter both players in the final.";
        continue;
      }
      if (m.person_a_id === m.person_b_id) return `The same person is on both sides in ${name}.`;
      if (m.score_a == null || m.score_b == null) return `Enter both scores in ${name}.`;
      if (m.score_a === m.score_b) return `Scores can't be level in ${name}.`;
    }
  }
  return null;
}

// Someone can only take one place: if they've already qualified through
// another, this one is flagged for the admin rather than filled (agreed
// 2026-10-16 - the first qualification counts; the admin decides the rest)
export function duplicateOf(personId: string, place: Pick<Place, "id">, filled: { placeId: string; placeNumber: number; personId: string }[]): number | null {
  const other = filled.find((f) => f.personId === personId && f.placeId !== place.id);
  return other ? other.placeNumber : null;
}

export type PlaceView = { state: "qualified" | "wildcard_filled" | "to_decide" | "wildcard_open" | "flagged"; label: string };

// How a place reads in the list
export function placeView(p: Pick<Place, "source" | "entry_id" | "flagged">): PlaceView {
  if (p.flagged) return { state: "flagged", label: p.flagged };
  if (p.source === "wildcard") return p.entry_id ? { state: "wildcard_filled", label: "Qualified" } : { state: "wildcard_open", label: "Chosen nearer the time" };
  return p.entry_id ? { state: "qualified", label: "Qualified" } : { state: "to_decide", label: "To be decided" };
}
