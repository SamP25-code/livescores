import { supabase } from "@/lib/supabaseClient";
import { firstRoundPairs, getWinnerSide, isMatchComplete, totalRounds } from "@/lib/bracket";
import type { MatchRow, Player } from "@/lib/types";

export async function createNight(name: string, kind: "qualifier" | "finals") {
  const { data, error } = await supabase
    .from("nights")
    .insert({ name, kind })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addPlayer(nightId: string, name: string) {
  const { data, error } = await supabase
    .from("players")
    .insert({ night_id: nightId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(playerId: string) {
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) throw error;
}

/**
 * Builds the bracket for a night, pairing round 1 straight from the order
 * players were added in (player 1 v player 2, player 3 v player 4, ...) -
 * that order IS the draw, so get the names in the right order first.
 *
 * Qualifying nights always play exactly 2 rounds (e.g. 16 -> 8 -> 4 winners,
 * who then advance to finals day - see the "qualifiers" section on the admin
 * page). Finals day plays a full knockout down to a single winner.
 *
 * Only call this once per night (it throws if matches already exist).
 */
export async function generateBracket(
  nightId: string,
  players: Player[],
  kind: "qualifier" | "finals",
  targetScore = 21
) {
  const playerCount = players.length;
  if (playerCount < 2 || (playerCount & (playerCount - 1)) !== 0) {
    throw new Error("Number of players must be a power of two (2, 4, 8, 16, 32...).");
  }
  if (kind === "finals" && players.some((p) => p.seed == null)) {
    throw new Error("Every finals-day player needs a number before the draw can be generated.");
  }

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("night_id", nightId);
  if (count && count > 0) {
    throw new Error("This night already has a bracket. Reset it first if you need to redo it.");
  }

  const rounds = kind === "qualifier" ? 2 : totalRounds(playerCount);
  let previousRoundIds: string[] = [];

  for (let round = 1; round <= rounds; round++) {
    const numMatches = playerCount / Math.pow(2, round);

    const rows =
      round === 1
        ? firstRoundPairs(playerCount).map(([i, j], slot) => ({
            night_id: nightId,
            round,
            slot,
            target_score: targetScore,
            player_a_id: players[i].id,
            player_b_id: players[j].id,
          }))
        : Array.from({ length: numMatches }, (_, slot) => ({
            night_id: nightId,
            round,
            slot,
            target_score: targetScore,
          }));

    const { data, error } = await supabase.from("matches").insert(rows).select();
    if (error) throw error;

    // Sort by slot so index math below lines up with insertion order.
    const sorted = [...data].sort((a, b) => a.slot - b.slot);
    const currentIds = sorted.map((m) => m.id);

    if (previousRoundIds.length > 0) {
      // Match `slot` in the previous round feeds into match floor(slot/2) here,
      // as side 'a' if it was an even slot, 'b' if odd.
      await Promise.all(
        previousRoundIds.map((matchId, slot) =>
          supabase
            .from("matches")
            .update({
              next_match_id: currentIds[Math.floor(slot / 2)],
              next_match_slot: slot % 2 === 0 ? "a" : "b",
            })
            .eq("id", matchId)
        )
      );
    }

    previousRoundIds = currentIds;
  }
}

/**
 * Adjust one side's score by `delta`, never below zero. Marks the match
 * "live" the first time a score moves off 0-0.
 */
export async function adjustScore(match: MatchRow, side: "a" | "b", delta: number) {
  const field = side === "a" ? "score_a" : "score_b";
  const nextValue = Math.max(0, (side === "a" ? match.score_a : match.score_b) + delta);
  const { error } = await supabase
    .from("matches")
    .update({ [field]: nextValue, status: match.status === "upcoming" ? "live" : match.status })
    .eq("id", match.id);
  if (error) throw error;
}

/**
 * Marks a match complete, records the winner, and - if it feeds into a later
 * round - drops the winner straight into that match's slot.
 */
export async function completeMatch(match: MatchRow) {
  if (!isMatchComplete(match)) {
    throw new Error("Neither player has reached the target score yet.");
  }
  const side = getWinnerSide(match);
  const winnerId = side === "a" ? match.player_a_id : match.player_b_id;

  const { error } = await supabase
    .from("matches")
    .update({ status: "complete", winner_id: winnerId })
    .eq("id", match.id);
  if (error) throw error;

  if (match.next_match_id && match.next_match_slot && winnerId) {
    const field = match.next_match_slot === "a" ? "player_a_id" : "player_b_id";
    const { data: nextMatch } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match.next_match_id)
      .single();
    const otherField = match.next_match_slot === "a" ? "player_b_id" : "player_a_id";
    const bothFilled = nextMatch && (nextMatch as MatchRow)[otherField as keyof MatchRow];
    await supabase
      .from("matches")
      .update({ [field]: winnerId, status: bothFilled ? "live" : "upcoming" })
      .eq("id", match.next_match_id);
  }
}

/**
 * Records the number a qualifier drew for finals day, and keeps the finals
 * day night's player list in sync: their name is placed at that exact draw
 * position there (creating it if needed, moving it if the number is
 * corrected without losing their existing row, removing it if the number is
 * cleared). Assumes a single night with kind 'finals' exists - create one
 * via /admin or supabase/seed.sql.
 */
export async function setFinalsNumber(player: Player, finalsNumber: number | null) {
  const { error } = await supabase
    .from("players")
    .update({ finals_number: finalsNumber })
    .eq("id", player.id);
  if (error) throw error;

  const { data: finalsNight } = await supabase
    .from("nights")
    .select("id")
    .eq("kind", "finals")
    .limit(1)
    .maybeSingle();
  if (!finalsNight) return;

  const { data: existing } = await supabase
    .from("players")
    .select("*")
    .eq("night_id", finalsNight.id)
    .eq("qualified_from_player_id", player.id)
    .maybeSingle();

  if (finalsNumber == null) {
    if (existing) await supabase.from("players").delete().eq("id", existing.id);
    return;
  }

  await vacateSeed(finalsNight.id, finalsNumber, existing?.id ?? null);

  if (existing) {
    const { error: updateError } = await supabase
      .from("players")
      .update({ seed: finalsNumber, name: player.name })
      .eq("id", existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from("players").insert({
      night_id: finalsNight.id,
      name: player.name,
      seed: finalsNumber,
      qualified_from_player_id: player.id,
    });
    if (insertError) throw insertError;
  }
}

/**
 * Moves a player already sitting on finals day to a different draw
 * position (or unsets their position with `null`), directly from finals
 * day's own player list. If they originally qualified from another night,
 * that night's record of their number is kept in sync too.
 */
export async function setFinalsPlayerSeed(player: Player, seed: number | null) {
  if (seed != null) {
    await vacateSeed(player.night_id, seed, player.id);
  }
  const { error } = await supabase.from("players").update({ seed }).eq("id", player.id);
  if (error) throw error;

  if (player.qualified_from_player_id) {
    await supabase.from("players").update({ finals_number: seed }).eq("id", player.qualified_from_player_id);
  }
}

/** Clears whoever else currently holds `seed` on this night, if anyone. */
async function vacateSeed(nightId: string, seed: number, exceptPlayerId: string | null) {
  let query = supabase.from("players").update({ seed: null }).eq("night_id", nightId).eq("seed", seed);
  if (exceptPlayerId) query = query.neq("id", exceptPlayerId);
  await query;
}

/**
 * Fetches the single finals-day night and its current player list, for
 * showing draw-position availability on a qualifying night's page. Returns
 * null if no finals night has been set up yet.
 */
export async function getFinalsRoster(): Promise<{ nightId: string; players: Player[] } | null> {
  const { data: finalsNight } = await supabase
    .from("nights")
    .select("id")
    .eq("kind", "finals")
    .limit(1)
    .maybeSingle();
  if (!finalsNight) return null;

  const { data: players } = await supabase.from("players").select("*").eq("night_id", finalsNight.id);
  return { nightId: finalsNight.id, players: players ?? [] };
}

export async function resetBracket(nightId: string) {
  const { error } = await supabase.from("matches").delete().eq("night_id", nightId);
  if (error) throw error;
}
