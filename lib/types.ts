export type Night = {
  id: string;
  name: string;
  kind: "qualifier" | "finals";
  status: "upcoming" | "live" | "complete";
  sort_order: number;
  created_at: string;
};

export type Player = {
  id: string;
  night_id: string;
  name: string;
  seed: number | null;
  finals_number: number | null;
  qualified_from_player_id: string | null;
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
