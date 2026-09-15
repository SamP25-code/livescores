import { supabase } from "@/lib/supabaseClient";
import {
  buildFinalsSlots,
  buildQualifierSlots,
  firstRoundPairs,
  getWinnerSide,
  isMatchComplete,
  roundOneSlotForSeed,
  totalRounds,
} from "@/lib/bracket";
import type { MatchRow, Player } from "@/lib/types";

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

  if (kind === "finals") {
    await generateBracket(data.id, [], "finals");
  }

  return data;
}

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

export async function renamePlayer(playerId: string, name: string) {
  const { error } = await supabase.from("players").update({ name }).eq("id", playerId);
  if (error) throw error;

  await supabase.from("players").update({ name }).eq("qualified_from_player_id", playerId);
}

export async function setPlayerBye(playerId: string, isBye: boolean) {
  const { error } = await supabase.from("players").update({ is_bye: isBye }).eq("id", playerId);
  if (error) throw error;
}

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

  const slots: Array<Player | null> = kind === "finals" ? buildFinalsSlots(players) : buildQualifierSlots(players);
  const drawSize = slots.length;

  if (kind === "qualifier") {
    for (let i = 0; i < slots.length; i += 2) {
      if (slots[i] == null && slots[i + 1] == null) {
        throw new Error(
          "Two byes ended up paired against each other - move one to a different position (or add another player) and try again."
        );
      }
    }
  }
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

    const sorted = [...data].sort((a, b) => a.slot - b.slot);
    const currentIds = sorted.map((m) => m.id);

    if (previousRoundIds.length > 0) {
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

export async function adjustScore(match: MatchRow, side: "a" | "b", delta: number) {
  const field = side === "a" ? "score_a" : "score_b";
  const nextValue = Math.max(0, (side === "a" ? match.score_a : match.score_b) + delta);
  const { error } = await supabase
    .from("matches")
    .update({ [field]: nextValue, status: match.status === "upcoming" ? "live" : match.status })
    .eq("id", match.id);
  if (error) throw error;
}

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
    await supabase
      .from("matches")
      .update({ [field]: winnerId })
      .eq("id", match.next_match_id);
  }
}

export async function markNoShow(match: MatchRow, side: "a" | "b") {
  if (match.round !== 1) {
    throw new Error("A no-show can only be marked in the first round.");
  }
  if (match.status === "complete") {
    throw new Error("This match is already complete - reopen it first if you need to change the result.");
  }

  const winnerId = side === "a" ? match.player_b_id : match.player_a_id;
  if (!winnerId) {
    throw new Error("The other side hasn't been decided yet, so there's no one to advance.");
  }
  const absentField = side === "a" ? "player_a_id" : "player_b_id";

  const { error } = await supabase
    .from("matches")
    .update({ [absentField]: null, score_a: 0, score_b: 0, status: "complete", winner_id: winnerId })
    .eq("id", match.id);
  if (error) throw error;

  if (match.next_match_id && match.next_match_slot) {
    const field = match.next_match_slot === "a" ? "player_a_id" : "player_b_id";
    await supabase.from("matches").update({ [field]: winnerId }).eq("id", match.next_match_id);
  }
}

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

async function vacateSeed(nightId: string, seed: number, exceptPlayerId: string | null) {
  let query = supabase.from("players").update({ seed: null }).eq("night_id", nightId).eq("seed", seed);
  if (exceptPlayerId) query = query.neq("id", exceptPlayerId);
  await query;
}

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
