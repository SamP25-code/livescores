export type Night = {
  id: string;
  name: string;
  kind: "qualifier" | "finals" | "single_day" | "final";
  status: "upcoming" | "live" | "complete";
  sort_order: number;
  draw_published: boolean;
  created_at: string;
  // 2027 structure (supabase/migrations/2027_01) - empty on databases that
  // haven't been moved over yet
  competition_id?: string | null;
  session_number?: number | null;
  date?: string | null;
  start_time?: string | null;
  venue_id?: string | null;
  postponed?: boolean;
  postponed_reason?: string | null;
  original_date?: string | null;
};

export type Organiser = {
  id: string;
  name: string;
  short_name: string;
  kind: "club" | "event";
  background_image: string | null;
  created_at: string;
};

export type Venue = {
  id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  notes: string | null;
  created_at: string;
};

export type Series = {
  id: string;
  organiser_id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type CompetitionSponsor = {
  id: string;
  competition_id: string;
  position: number;
  name: string;
  url: string | null;
  created_at: string;
};

export type Competition = {
  id: string;
  series_id: string;
  year: number;
  status: "planned" | "active" | "archived";
  format: "qualifying_and_finals" | "single_day" | "final_only";
  team_size: 1 | 2;
  entry_method: "open" | "qualification" | "on_the_night";
  label: string | null;
  target_score: 21 | 31;
  scoring_style: "live" | "results";
  draw_size: number | null;
  qualifying_nights: number | null;
  entries_per_night: number | null;
  qualifiers_per_night: number | null;
  draw_method: "in_advance" | "on_the_day";
  structure_locked: boolean;
  sponsor_name: string | null;
  sponsor_url: string | null;
  venue_id: string | null;
  colour: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  night_id: string;
  name: string;
  seed: number | null;
  finals_number: number | null;
  qualified_from_player_id: string | null;
  sort_order: number;
  is_bye: boolean;
  created_at: string;
};

export type MatchRow = {
  id: string;
  night_id: string;
  round: number;
  slot: number;
  player_a_id: string | null;
  player_b_id: string | null;
  score_a: number;
  score_b: number;
  target_score: number;
  status: "upcoming" | "live" | "complete";
  winner_id: string | null;
  next_match_id: string | null;
  next_match_slot: "a" | "b" | null;
  updated_at: string;
};

export type MatchEvent = {
  id: string;
  match_id: string;
  night_id: string;
  event_type: "score" | "complete" | "reopen" | "no_show";
  score_a: number;
  score_b: number;
  status: "upcoming" | "live" | "complete";
  created_at: string;
};
