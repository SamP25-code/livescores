import { supabase } from "@/lib/supabaseClient";
import {
  buildFinalsSlots,
  buildQualifierSlots,
  firstRoundPairs,
  getWinnerSide,
  isMatchComplete,
  isWalkover,
  roundOneSlotForSeed,
  totalRounds,
} from "@/lib/bracket";
import { drawnByNumber, slotsByNumber } from "@/lib/draw";
import { entriesForSession, placesToSync } from "@/lib/sessionEntries";
import type { TimeSlot } from "@/lib/timeSlots";
import type { Entry, MatchEvent, MatchRow, Player } from "@/lib/types";

// Records an important change in the competition's log (who did what, when).
// Sessions not yet in a 2027 competition have no log, so nothing is written.
export async function logSessionAction(nightId: string, action: string, details: Record<string, unknown> = {}) {
  const { data: night } = await supabase.from("nights").select("competition_id").eq("id", nightId).maybeSingle();
  if (!night?.competition_id) return;
  const { error } = await supabase
    .from("audit_log")
    .insert({ competition_id: night.competition_id, action, details: { night_id: nightId, ...details } });
  if (error) throw error;
}

async function logMatchEvent(
  match: Pick<MatchRow, "id" | "night_id">,
  eventType: MatchEvent["event_type"],
  scoreA: number,
  scoreB: number,
  status: MatchEvent["status"]
) {
  await supabase.from("match_events").insert({
    match_id: match.id,
    night_id: match.night_id,
    event_type: eventType,
    score_a: scoreA,
    score_b: scoreB,
    status,
  });
}

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
    .insert({ name, kind, sort_order: nextSortOrder, draw_published: kind === "finals" })
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

// Puts entries into a session's draw, after anyone already there, in the
// order given. The database fills in each name from the entry.
export async function addEntriesToSession(nightId: string, entryIds: string[]) {
  if (entryIds.length === 0) return;
  const { data: last } = await supabase
    .from("players")
    .select("sort_order")
    .eq("night_id", nightId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const first = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("players")
    .insert(entryIds.map((entry_id, i) => ({ night_id: nightId, entry_id, sort_order: first + i })));
  if (error) throw error;
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

// "qualifier": the first two rounds of the list as ordered (a qualifying
// session, which sends its last four through). "knockout": the same list
// played all the way to a winner (a single day, or a final). "finals": the
// Finals Day draw, by draw number.
export async function generateBracket(
  nightId: string,
  players: Player[],
  kind: "qualifier" | "knockout" | "finals",
  targetScore = 21
) {
  const listed = kind !== "finals";
  if (listed && players.length < 2) {
    throw new Error("Add at least two players first.");
  }

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("night_id", nightId);
  if (count && count > 0) {
    throw new Error("This night already has a bracket. Reset it first if you need to redo it.");
  }

  const slots: Array<Player | null> =
    kind === "finals"
      ? buildFinalsSlots(players)
      : drawnByNumber(players)
        ? slotsByNumber(players)
        : buildQualifierSlots(players);
  const drawSize = slots.length;

  if (listed) {
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
            // One side empty: the other goes straight through
            const isBye = listed && (playerA == null) !== (playerB == null);
            return {
              night_id: nightId,
              round,
              slot,
              target_score: targetScore,
              player_a_id: playerA?.id ?? null,
              player_b_id: playerB?.id ?? null,
              status: isBye ? "complete" : "upcoming",
              winner_id: isBye ? (playerA ?? playerB)!.id : null,
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

// Score taps and typed results are sent by lib/scoreSync.ts, which keeps them
// on the phone until there's signal.

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

  await logMatchEvent(match, "complete", match.score_a, match.score_b, "complete");

  if (match.next_match_id && match.next_match_slot && winnerId) {
    const field = match.next_match_slot === "a" ? "player_a_id" : "player_b_id";
    await supabase
      .from("matches")
      .update({ [field]: winnerId })
      .eq("id", match.next_match_id);
  }
}

export async function markNoShow(match: MatchRow, side: "a" | "b", recordHistory = true) {
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
  const absentId = side === "a" ? match.player_a_id : match.player_b_id;

  // Both names stay in the match (the absent one shown struck through), so
  // it's easy to undo if they turn up late. A finished match at 0-0 is how a
  // walkover is recognised.
  const { error } = await supabase
    .from("matches")
    .update({ score_a: 0, score_b: 0, status: "complete", winner_id: winnerId })
    .eq("id", match.id);
  if (error) throw error;

  if (recordHistory) await logMatchEvent(match, "no_show", 0, 0, "complete");
  await logSessionAction(match.night_id, "no_show", { match_id: match.id, absent_player_id: absentId });

  if (match.next_match_id && match.next_match_slot) {
    const field = match.next_match_slot === "a" ? "player_a_id" : "player_b_id";
    await supabase.from("matches").update({ [field]: winnerId }).eq("id", match.next_match_id);
  }
}

// They turned up after all: the walkover is taken back and the match is
// ready to play - as long as the winner hasn't started their next match.
export async function undoNoShow(match: MatchRow) {
  if (!isWalkover(match)) return;
  if (match.next_match_id) {
    const { data: nextMatch } = await supabase.from("matches").select("*").eq("id", match.next_match_id).single();
    const nm = nextMatch as MatchRow | null;
    if (nm && (nm.status !== "upcoming" || nm.score_a > 0 || nm.score_b > 0)) {
      throw new Error("Can't undo - the player who went through has already started their next match.");
    }
    const field = match.next_match_slot === "a" ? "player_a_id" : "player_b_id";
    await supabase.from("matches").update({ [field]: null }).eq("id", match.next_match_id);
  }
  const { error } = await supabase.from("matches").update({ status: "upcoming", winner_id: null }).eq("id", match.id);
  if (error) throw error;
  await logSessionAction(match.night_id, "no_show_undone", { match_id: match.id });
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

  await logMatchEvent(match, "reopen", match.score_a, match.score_b, "live");
}

// The Finals Day that a qualifying session feeds: the one in the same
// competition (or, on a database not yet moved to 2027, the only one).
async function finalsNightFor(nightId: string): Promise<{ id: string } | null> {
  const { data: night } = await supabase.from("nights").select("competition_id").eq("id", nightId).maybeSingle();
  let query = supabase.from("nights").select("id").eq("kind", "finals");
  if (night?.competition_id) query = query.eq("competition_id", night.competition_id);
  const { data } = await query.limit(1).maybeSingle();
  return data ?? null;
}

export async function setFinalsNumber(player: Player, finalsNumber: number | null) {
  const { error } = await supabase
    .from("players")
    .update({ finals_number: finalsNumber })
    .eq("id", player.id);
  if (error) throw error;

  const finalsNight = await finalsNightFor(player.night_id);
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
        entry_id: player.entry_id ?? null,
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

export async function getFinalsRoster(qualifyingNightId: string): Promise<{ nightId: string; players: Player[] } | null> {
  const finalsNight = await finalsNightFor(qualifyingNightId);
  if (!finalsNight) return null;

  const { data: players } = await supabase.from("players").select("*").eq("night_id", finalsNight.id);
  return { nightId: finalsNight.id, players: players ?? [] };
}

export async function resetBracket(nightId: string) {
  const { error } = await supabase.from("matches").delete().eq("night_id", nightId);
  if (error) throw error;
}

export async function setDrawPublished(nightId: string, published: boolean) {
  const { error } = await supabase.from("nights").update({ draw_published: published }).eq("id", nightId);
  if (error) throw error;
}

// Draw numbers for a session's places (null clears one). Saved straight
// away but private until the draw is made and published.
export async function setDrawNumbers(numbers: Map<string, number | null>) {
  const results = await Promise.all(
    [...numbers].map(([playerId, n]) => supabase.from("players").update({ seed: n }).eq("id", playerId))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// Replaces a session's first-round start times
export async function saveTimeSlots(nightId: string, slots: TimeSlot[]) {
  const { error: removeError } = await supabase.from("time_slots").delete().eq("night_id", nightId);
  if (removeError) throw removeError;
  if (slots.length > 0) {
    const { error } = await supabase.from("time_slots").insert(
      slots.map((s) => ({
        night_id: nightId,
        from_number: s.from_number,
        to_number: s.to_number,
        start_time: s.start_time,
      }))
    );
    if (error) throw error;
  }
  await logSessionAction(nightId, "time_slots_set", { slots });
}

// Changes one first-round match's time by hand: a slot covering just its two
// draw numbers, which beats the wider slot it sits in. null goes back to the
// wider slot's time.
export async function setMatchTime(nightId: string, matchSlot: number, time: string | null) {
  const from = matchSlot * 2 + 1;
  const { error: removeError } = await supabase
    .from("time_slots")
    .delete()
    .eq("night_id", nightId)
    .eq("from_number", from)
    .eq("to_number", from + 1);
  if (removeError) throw removeError;
  if (time) {
    const { error } = await supabase
      .from("time_slots")
      .insert({ night_id: nightId, from_number: from, to_number: from + 1, start_time: time });
    if (error) throw error;
  }
  await logSessionAction(nightId, "match_time_set", { draw_numbers: [from, from + 1], time });
}

// Puts someone else in a place in the draw - same draw number, same opponent,
// same spot in the bracket. The replacement is always an entry of its own, so
// results go on the right people's records:
//   - an existing entry not yet in a draw is used as it is
//   - otherwise a new entry is made (e.g. a pair with one partner swapped)
// The original entry is withdrawn. If the place has already played (and won)
// a match, that result stays with the original: the replacement gets a new
// place from this match on.
export async function replaceInDraw(
  match: MatchRow,
  side: "a" | "b",
  personId: string,
  partnerId: string | null
) {
  if (match.status === "complete") {
    throw new Error("This match has finished, so its players can't be changed.");
  }
  const placeId = side === "a" ? match.player_a_id : match.player_b_id;
  if (!placeId) throw new Error("There's nobody in that place yet.");

  const { data: place, error: placeError } = await supabase.from("players").select("*").eq("id", placeId).single();
  if (placeError) throw placeError;
  const current = place as Player;
  if (!current.entry_id) throw new Error("Only places in a 2027 competition's draw can be replaced.");

  const { data: oldEntryRow, error: entryError } = await supabase
    .from("entries")
    .select("*")
    .eq("id", current.entry_id)
    .single();
  if (entryError) throw entryError;
  const oldEntry = oldEntryRow as Entry;
  if (oldEntry.person_id === personId && (oldEntry.partner_id ?? null) === partnerId) return;

  // An entry with exactly these people already?
  const wanted = [personId, partnerId].filter(Boolean).sort().join(",");
  const { data: candidates, error: candidatesError } = await supabase
    .from("entries")
    .select("*")
    .eq("competition_id", oldEntry.competition_id)
    .eq("status", "entered")
    .in("person_id", [personId, ...(partnerId ? [partnerId] : [])]);
  if (candidatesError) throw candidatesError;
  const existing = ((candidates ?? []) as Entry[]).find(
    (e) => e.id !== oldEntry.id && [e.person_id, e.partner_id].filter(Boolean).sort().join(",") === wanted
  );
  if (existing) {
    const { data: sessions } = await supabase.from("nights").select("id, kind").eq("competition_id", oldEntry.competition_id);
    const otherSessions = (sessions ?? []).filter((n) => n.kind !== "finals").map((n) => n.id);
    const { count } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("entry_id", existing.id)
      .in("night_id", otherSessions);
    if ((count ?? 0) > 0) throw new Error("They're already in a draw - pick someone who isn't playing yet.");
  }

  // Withdraw the original first: the database won't let anyone be in two
  // entries at once, and a swapped pair shares a partner with the old entry
  const { error: withdrawError } = await supabase.from("entries").update({ status: "withdrawn" }).eq("id", oldEntry.id);
  if (withdrawError) throw withdrawError;

  let newEntryId = existing?.id ?? null;
  if (!newEntryId) {
    // In a qualifying session, the replacement is entered for that session
    const { data: night } = await supabase.from("nights").select("kind").eq("id", match.night_id).single();
    const { data: created, error: createError } = await supabase
      .from("entries")
      .insert({
        competition_id: oldEntry.competition_id,
        person_id: personId,
        partner_id: partnerId,
        session_id: night?.kind === "qualifier" ? match.night_id : null,
      })
      .select("id")
      .single();
    if (createError) {
      await supabase.from("entries").update({ status: "entered" }).eq("id", oldEntry.id);
      throw createError;
    }
    newEntryId = created.id as string;
  }

  // Has this place already played a match (a bye doesn't count)?
  const { data: played } = await supabase
    .from("matches")
    .select("id")
    .eq("night_id", match.night_id)
    .eq("status", "complete")
    .not("player_a_id", "is", null)
    .not("player_b_id", "is", null)
    .or(`player_a_id.eq.${placeId},player_b_id.eq.${placeId}`)
    .limit(1);

  let newPlaceId = placeId;
  if ((played ?? []).length > 0) {
    const { data: newPlace, error: insertError } = await supabase
      .from("players")
      .insert({ night_id: match.night_id, entry_id: newEntryId, sort_order: current.sort_order })
      .select("id")
      .single();
    if (insertError) throw insertError;
    newPlaceId = newPlace.id as string;
    const field = side === "a" ? "player_a_id" : "player_b_id";
    const { error: matchError } = await supabase.from("matches").update({ [field]: newPlaceId }).eq("id", match.id);
    if (matchError) throw matchError;
  } else {
    const { error: updateError } = await supabase.from("players").update({ entry_id: newEntryId }).eq("id", placeId);
    if (updateError) throw updateError;
  }

  await logSessionAction(match.night_id, "replaced", {
    match_id: match.id,
    from_entry_id: oldEntry.id,
    to_entry_id: newEntryId,
    from_place_id: placeId,
    to_place_id: newPlaceId,
  });
}

// Keeps a 2027 session's places in step with its entries until the draw is
// made: a place for everyone entered (for this session, if it's a qualifying
// one), none for anyone withdrawn or moved. Once the draw is made, changes go
// through "Replace" instead, so this leaves it alone.
export async function syncSessionPlaces(nightId: string) {
  const { data: night } = await supabase.from("nights").select("id, kind, competition_id").eq("id", nightId).maybeSingle();
  if (!night?.competition_id || night.kind === "finals") return;
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("night_id", nightId);
  if ((count ?? 0) > 0) return;

  const [{ data: entries, error: entriesError }, { data: places, error: placesError }] = await Promise.all([
    supabase.from("entries").select("id, status, session_id").eq("competition_id", night.competition_id).order("created_at"),
    supabase.from("players").select("id, entry_id, sort_order").eq("night_id", nightId),
  ]);
  if (entriesError) throw entriesError;
  if (placesError) throw placesError;

  const wanted = entriesForSession((entries ?? []) as Entry[], night).map((e) => e.id);
  const { add, remove } = placesToSync(wanted, places ?? []);
  if (remove.length > 0) {
    const { error } = await supabase.from("players").delete().in("id", remove);
    if (error) throw error;
  }
  if (add.length > 0) {
    const first = Math.max(-1, ...(places ?? []).map((p) => p.sort_order ?? 0)) + 1;
    const { error } = await supabase
      .from("players")
      .insert(add.map((entry_id, i) => ({ night_id: nightId, entry_id, sort_order: first + i })));
    if (error) throw error;
  }
}

// Confirms a 2027 session's draw in one go: everyone entered is in it (the
// places are brought up to date first), the bracket is built by draw number,
// it's logged, and - usually - published straight away.
export async function makeDraw(
  nightId: string,
  kind: "qualifier" | "knockout",
  targetScore: number,
  method: string,
  publish: boolean
) {
  await syncSessionPlaces(nightId);
  const { data, error } = await supabase.from("players").select("*").eq("night_id", nightId).order("sort_order");
  if (error) throw error;
  const players = (data ?? []) as Player[];
  if (players.some((p) => !p.is_bye && p.seed == null)) {
    throw new Error("Someone has been entered since the numbers were drawn - give them a number, or redraw.");
  }
  await generateBracket(nightId, players, kind, targetScore);
  await logSessionAction(nightId, "draw_made", { method, places: players.length, published: publish });
  if (publish) await setDrawPublished(nightId, true);
}
