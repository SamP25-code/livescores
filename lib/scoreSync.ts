"use client";

// Sends waiting scores (lib/scoreQueue.ts) when there's signal, in the order
// they were tapped, and tells the page how it's going: how many are waiting,
// whether the phone seems to have no signal, and any match that was changed
// on another phone meanwhile.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isNetworkError, loadOps, saveOps, winnerIdOf, type ScoreOp } from "@/lib/scoreQueue";

export type Conflict = { matchId: string; message: string };

type QueueState = {
  ops: ScoreOp[];
  offline: boolean;
  sending: boolean;
  conflicts: Conflict[];
  // Set when the waiting list has just emptied, for a brief "All sent"
  allSentAt: number | null;
};

let state: QueueState = { ops: [], offline: false, sending: false, conflicts: [], allSentAt: null };
let loaded = false;
const listeners = new Set<() => void>();
const sentListeners = new Set<() => void>();
const opListeners = new Set<(op: ScoreOp) => void>();

function setState(patch: Partial<QueueState>) {
  state = { ...state, ...patch };
  if (patch.ops) saveOps(state.ops);
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  state = { ...state, ops: loadOps() };
}

export function enqueue(op: ScoreOp) {
  ensureLoaded();
  setState({ ops: [...state.ops, op], allSentAt: null });
  flush();
}

// The current state, outside React (for tests)
export function queueState(): QueueState {
  ensureLoaded();
  return state;
}

export function dismissConflict(matchId: string) {
  setState({ conflicts: state.conflicts.filter((c) => c.matchId !== matchId) });
}

type Outcome = { sent: true } | { sent: false; conflict: string };

// One waiting score. Only applied if the match still has the score it was
// made from. Safe to repeat: if it had already gone through before the
// signal dropped, it's recognised and finished off rather than counted twice.
async function sendOp(op: ScoreOp): Promise<Outcome> {
  const winnerId = winnerIdOf(op);
  const winnerChanged = op.next.status === "complete" || op.prev.status === "complete";

  // A typed result that changes who won a finished match: not once the
  // winner has started their next match
  if (op.kind === "result" && op.prev.status === "complete" && winnerId !== op.prevWinnerId) {
    const { data: m, error } = await supabase.from("matches").select("next_match_id").eq("id", op.matchId).single();
    if (error) throw error;
    if (m?.next_match_id) {
      const { data: nm, error: nmError } = await supabase
        .from("matches")
        .select("status, score_a, score_b")
        .eq("id", m.next_match_id)
        .single();
      if (nmError) throw nmError;
      if (nm && (nm.status !== "upcoming" || nm.score_a > 0 || nm.score_b > 0)) {
        return { sent: false, conflict: "The winner has already started their next match, so the result can't change who won." };
      }
    }
  }

  const { data, error } = await supabase
    .from("matches")
    .update({ score_a: op.next.score_a, score_b: op.next.score_b, status: op.next.status, winner_id: winnerId })
    .eq("id", op.matchId)
    .eq("score_a", op.prev.score_a)
    .eq("score_b", op.prev.score_b)
    .eq("status", op.prev.status)
    .select("id, next_match_id, next_match_slot");
  if (error) throw error;

  let match = data?.[0] ?? null;
  let alreadyThere = false;
  if (!match) {
    // Either it went through before the signal dropped, or someone else
    // changed the match since this score was tapped
    const { data: current, error: currentError } = await supabase
      .from("matches")
      .select("id, score_a, score_b, status, next_match_id, next_match_slot")
      .eq("id", op.matchId)
      .single();
    if (currentError) throw currentError;
    const same =
      current &&
      current.score_a === op.next.score_a &&
      current.score_b === op.next.score_b &&
      current.status === op.next.status;
    if (!same) {
      return {
        sent: false,
        conflict: current
          ? `This match was changed on another phone - it's now ${current.score_a}-${current.score_b}. Check the score.`
          : "This match has been removed.",
      };
    }
    match = current;
    alreadyThere = true;
  }

  // Into the match's history: every tap, and a score typed in while it's in
  // play (a finished result being corrected is logged as a correction)
  if (!alreadyThere && (op.kind === "tap" || op.prev.status !== "complete")) {
    await supabase.from("match_events").insert({
      match_id: op.matchId,
      night_id: op.nightId,
      event_type: op.next.status === "complete" ? "complete" : "score",
      score_a: op.next.score_a,
      score_b: op.next.score_b,
      status: op.next.status,
      created_at: op.at,
    });
  }

  // The winner goes through to their next match (or comes back out of it if
  // a finished match is back in play)
  if (match.next_match_id && match.next_match_slot && winnerChanged) {
    const field = match.next_match_slot === "a" ? "player_a_id" : "player_b_id";
    const { error: nextError } = await supabase
      .from("matches")
      .update({ [field]: winnerId })
      .eq("id", match.next_match_id);
    if (nextError) throw nextError;
  }
  return { sent: true };
}

let flushing: Promise<void> | null = null;

// Sends everything waiting, oldest first. Stops at the first sign of no
// signal and tries again later. If it's already sending, waits for that
// (which also picks up anything tapped meanwhile).
export function flush(): Promise<void> {
  ensureLoaded();
  if (flushing) return flushing;
  if (state.ops.length === 0) return Promise.resolve();
  flushing = sendAll().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function sendAll() {
  setState({ sending: true });
  let sentAny = false;
  // Anything sent or dropped: the page should re-read the database
  let changed = false;
  try {
    while (state.ops.length > 0) {
      const op = state.ops[0];
      try {
        const outcome = await sendOp(op);
        changed = true;
        if (outcome.sent) {
          sentAny = true;
          // Tell the page first, so it never shows the old score in between
          opListeners.forEach((l) => l(op));
          setState({ ops: state.ops.filter((o) => o.id !== op.id), offline: false });
        } else {
          // Drop this match's waiting scores and ask the scorer to check it
          setState({
            ops: state.ops.filter((o) => o.matchId !== op.matchId),
            conflicts: [...state.conflicts.filter((c) => c.matchId !== op.matchId), { matchId: op.matchId, message: outcome.conflict }],
            offline: false,
          });
        }
      } catch (err) {
        if (isNetworkError(err)) {
          setState({ offline: true });
          break;
        }
        changed = true;
        // Refused by the server (e.g. no longer allowed to score it): waiting won't help
        const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Couldn't save";
        setState({
          ops: state.ops.filter((o) => o.matchId !== op.matchId),
          conflicts: [...state.conflicts.filter((c) => c.matchId !== op.matchId), { matchId: op.matchId, message: `Not saved: ${message}` }],
        });
      }
    }
  } finally {
    setState({ sending: false, allSentAt: state.ops.length === 0 && sentAny ? Date.now() : state.allSentAt });
    if (changed) sentListeners.forEach((l) => l());
  }
}

// The waiting list for the page: re-renders as it changes, keeps trying
// while scores are waiting, calls onSentOp as each score goes through, and
// onSent after a batch (to refresh the page from the database).
export function useScoreQueue(onSent?: () => void, onSentOp?: (op: ScoreOp) => void) {
  const [, setTick] = useState(0);

  useEffect(() => {
    ensureLoaded();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    const sent = () => onSent?.();
    sentListeners.add(sent);
    const sentOp = (op: ScoreOp) => onSentOp?.(op);
    opListeners.add(sentOp);

    // Send anything left from last time, and try again when signal returns
    flush();
    const retry = () => flush();
    window.addEventListener("online", retry);
    const onVisible = () => {
      if (document.visibilityState === "visible") flush();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (state.ops.length > 0) flush();
    }, 8000);

    setTick((t) => t + 1);
    return () => {
      listeners.delete(listener);
      sentListeners.delete(sent);
      opListeners.delete(sentOp);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
