import { supabase } from "@/lib/supabaseClient";
import {
  buildByeSlots,
  buildFinalsSlots,
  firstRoundPairs,
  getWinnerSide,
  isMatchComplete,
  roundOneSlotForSeed,
  totalRounds,
} from "@/lib/bracket";
import type { MatchRow, Player } from "@/lib/types";

/** New nights go to the back of the display order - they default to 0 otherwise, jumping ahead of every existing night. */
export async function createNight(name: string, kind: "qualifier" | "finals") {
  const { data: last } = await supabase
    .from("nights")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (last?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("nights")
    .insert({ name, kind, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) throw error;

  // Finals day's draw size is fixed (16) regardless of who's qualified so
  // far, so its bracket can exist from the start - every slot blank until a
  // qualifier is given that number. See ensureFinalsBracketGenerated for the
  // equivalent backfill on a finals night that already existed before this.
  if (kind === "finals") {
    await generateBracket(data.id, [], "finals");
  }

  return data;
}

/** New players go to the back of the draw order - drag them into position afterwards. */
export async function addPlayer(nightId: string, name: string) {
  const { data: last } = await supabase
    .from("players")
    .select("sort_order")
    .eq("night_id", nightId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (last?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("players")
    .insert({ night_id: nightId, name, sort_order: nextSortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Persists a new round-1 draw order after dragging players into position -
 * `orderedPlayerIds` is the full list for the night, in the order they
 * should be paired (1 v 2, 3 v 4, ...).
 */
export async function reorderPlayers(orderedPlayerIds: string[]) {
  const results = await Promise.all(
    orderedPlayerIds.map((id, index) => supabase.from("players").update({ sort_order: index }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function deletePlayer(playerId: string) {
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) throw error;
}

/**
 * Fixes a typo'd name. If this player has already qualified for finals day,
 * their mirror row there is renamed too, so the two don't drift apart.
 */
export async function renamePlayer(playerId: string, name: string) {
  const { error } = await supabase.from("players").update({ name }).eq("id", playerId);
  if (error) throw error;

  await supabase.from("players").update({ name }).eq("qualified_from_player_id", playerId);
}

/**
 * Builds the bracket for a night, pairing round 1 straight from the order
 * players were added in (player 1 v player 2, player 3 v player 4, ...) -
 * that order IS the draw, so get the names in the right order first. A
 * qualifying night doesn't need an exact power of two: any leftover slot(s)
 * get a bye (an automatic walkover) rather than blocking the draw.
 *
 * Qualifying nights always play exactly 2 rounds (e.g. 16 -> 8 -> 4 winners,
 * who then advance to finals day - see the "qualifiers" section on the admin
 * page). Finals day plays a full knockout down to a single winner, and its
 * draw is always the full 16 slots regardless of how many are filled yet -
 * createNight generates it empty as soon as the night itself is created (see
 * ensureFinalsBracketGenerated for backfilling one created before that
 * existed), leaving every slot blank until that draw number is given out.
 *
 * Only call this once per night (it throws if matches already exist).
 */
export async function generateBracket(
  nightId: string,
  players: Player[],
  kind: "qualifier" | "finals",
  targetScore = 21
) {
  if (kind === "qualifier" && players.length < 2) {
    throw new Error("Add at least two players first.");
  }

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("night_id", nightId);
  if (count && count > 0) {
    throw new Error("This night already has a bracket. Reset it first if you need to redo it.");
  }

  // For a qualifying night, a blank slot after pairing means a bye - there's
  // no one left to play, so the other side wins automatically. For finals
  // day, a blank slot just means nobody's been given that number yet, and
  // stays open until they are - never treated as a bye.
  const slots: Array<Player | null> = kind === "finals" ? buildFinalsSlots(players) : buildByeSlots(players);
  const drawSize = slots.length;
  const rounds = kind === "qualifier" ? 2 : totalRounds(drawSize);
  let previousRoundIds: string[] = [];
  let previousRoundByeWinners: Array<string | null> = [];

  for (let round = 1; round <= rounds; round++) {
    const numMatches = drawSize / Math.pow(2, round);

    const rows =
      round === 1
        ? firstRoundPairs(drawSize).map(([i, j], slot) => {
            const playerA = slots[i];
            const playerB = slots[j];
            const isBye = kind === "qualifier" && playerA != null && playerB == null;
            return {
              night_id: nightId,
              round,
              slot,
              target_score: targetScore,
              player_a_id: playerA?.id ?? null,
              player_b_id: playerB?.id ?? null,
              status: isBye ? "complete" : "upcoming",
              winner_id: isBye ? playerA!.id : null,
            };
          })
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

      // Byes from the previous round already have a winner decided - drop
      // them straight into this round's match now that we know where it is.
      await Promise.all(
        previousRoundByeWinners.map((winnerId, slot) => {
          if (!winnerId) return null;
          const field = slot % 2 === 0 ? "player_a_id" : "player_b_id";
          return supabase
            .from("matches")
            .update({ [field]: winnerId })
            .eq("id", currentIds[Math.floor(slot / 2)]);
        })
      );
    }

    previousRoundIds = currentIds;
    previousRoundByeWinners = round === 1 ? sorted.map((m) => (m.status === "complete" ? m.winner_id : null)) : [];
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
 * Undoes "Mark complete" on a single match, for fixing a mistake without
 * resetting the whole night's bracket. Refuses if the winner has already
 * started their next match (nothing to retract cleanly to), or if the match
 * doesn't have two real players to begin with (a bye, or a still-blank
 * slot) - there's no "un-bye", since there was never a second player to
 * reopen a match against.
 */
export async function reopenMatch(match: MatchRow) {
  if (match.status !== "complete") return;
  if (!match.player_a_id || !match.player_b_id) {
    throw new Error("This match doesn't have two players to reopen.");
  }

  if (match.next_match_id) {
    const { data: nextMatch } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match.next_match_id)
      .single();
    const nm = nextMatch as MatchRow | null;
    // The next match flips to "live" the instant both its slots fill, even
    // at 0-0 (see completeMatch above) - that alone isn't real progress, so
    // only block on an actual score or a result, not just the eager status.
    if (nm && (nm.status === "complete" || nm.score_a > 0 || nm.score_b > 0)) {
      throw new Error(
        "Can't reopen - the winner has already started their next match. Reset the bracket if you need to redo this far back."
      );
    }

    const field = match.next_match_slot === "a" ? "player_a_id" : "player_b_id";
    await supabase.from("matches").update({ [field]: null, status: "upcoming" }).eq("id", match.next_match_id);
  }

  const { error } = await supabase.from("matches").update({ status: "live", winner_id: null }).eq("id", match.id);
  if (error) throw error;
}

/**
 * Records the number a qualifier drew for finals day, and keeps the finals
 * day night's player list in sync: their name is placed at that exact draw
 * position there (creating it if needed, moving it if the number is
 * corrected without losing their existing row, removing it if the number is
 * cleared). Assumes a single night with kind 'finals' exists - create one
 * via /admin or supabase/seed.sql.
 *
 * The finals bracket doesn't wait for all 16 numbers to be given out - see
 * ensureFinalsBracketGenerated below.
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
  const oldSeed = existing?.seed ?? null;

  if (finalsNumber == null) {
    if (existing) await supabase.from("players").delete().eq("id", existing.id);
    if (oldSeed != null) await setFinalsRoundOneSlot(finalsNight.id, oldSeed, null);
    return;
  }

  await vacateSeed(finalsNight.id, finalsNumber, existing?.id ?? null);

  let finalsPlayerId: string;
  if (existing) {
    const { error: updateError } = await supabase
      .from("players")
      .update({ seed: finalsNumber, name: player.name })
      .eq("id", existing.id);
    if (updateError) throw updateError;
    finalsPlayerId = existing.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("players")
      .insert({
        night_id: finalsNight.id,
        name: player.name,
        seed: finalsNumber,
        qualified_from_player_id: player.id,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    finalsPlayerId = inserted.id;
  }

  const generated = await ensureFinalsBracketGenerated(finalsNight.id);
  if (!generated) {
    if (oldSeed != null && oldSeed !== finalsNumber) await setFinalsRoundOneSlot(finalsNight.id, oldSeed, null);
    await setFinalsRoundOneSlot(finalsNight.id, finalsNumber, finalsPlayerId);
  }
}

/**
 * Moves a player already sitting on finals day to a different draw
 * position (or unsets their position with `null`), directly from finals
 * day's own player list. If they originally qualified from another night,
 * that night's record of their number is kept in sync too.
 */
export async function setFinalsPlayerSeed(player: Player, seed: number | null) {
  const oldSeed = player.seed;
  if (seed != null) {
    await vacateSeed(player.night_id, seed, player.id);
  }
  const { error } = await supabase.from("players").update({ seed }).eq("id", player.id);
  if (error) throw error;

  if (player.qualified_from_player_id) {
    await supabase.from("players").update({ finals_number: seed }).eq("id", player.qualified_from_player_id);
  }

  const generated = await ensureFinalsBracketGenerated(player.night_id);
  if (!generated) {
    if (oldSeed != null && oldSeed !== seed) await setFinalsRoundOneSlot(player.night_id, oldSeed, null);
    if (seed != null) await setFinalsRoundOneSlot(player.night_id, seed, player.id);
  }
}

/**
 * Drops a player straight into (or clears them from) their round-1 match
 * slot on finals day, once the bracket already exists. A no-op if it
 * doesn't yet - ensureFinalsBracketGenerated handles that first call.
 */
async function setFinalsRoundOneSlot(nightId: string, seed: number, playerId: string | null) {
  const { slot, side } = roundOneSlotForSeed(seed);
  const field = side === "a" ? "player_a_id" : "player_b_id";
  await supabase
    .from("matches")
    .update({ [field]: playerId })
    .eq("night_id", nightId)
    .eq("round", 1)
    .eq("slot", slot);
}

/**
 * Backfills the blank finals-day bracket for a finals night that was
 * created before this existed (createNight now generates it up front - see
 * above). Whoever already has a number gets dropped straight into their
 * slot; everyone else stays blank until they're given one. Returns true if
 * it just generated the bracket, false if one already existed.
 */
export async function ensureFinalsBracketGenerated(nightId: string): Promise<boolean> {
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("night_id", nightId);
  if (count && count > 0) return false;

  const { data: finalsPlayers } = await supabase.from("players").select("*").eq("night_id", nightId);
  await generateBracket(nightId, finalsPlayers ?? [], "finals");
  return true;
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
