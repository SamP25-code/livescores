/**
 * Sending waiting scores, against a small stand-in for the database.
 */

// A tiny in-memory database that understands the calls scoreSync makes
const db = { matches: new Map(), events: [], offline: false, dropAfterUpdate: false };

function mockBuilder(table) {
  const q = { table, filters: [], patch: null, insertRow: null, wantRows: false };
  const rows = () =>
    [...db[table === "matches" ? "matches" : "x"].values()].filter((r) => q.filters.every(([k, v]) => r[k] === v));
  const run = () => {
    if (db.offline) return { data: null, error: { message: "TypeError: Failed to fetch" } };
    if (q.insertRow) {
      db.events.push(q.insertRow);
      return { data: null, error: null };
    }
    if (q.patch) {
      const hit = rows();
      hit.forEach((r) => Object.assign(r, q.patch));
      if (db.dropAfterUpdate) {
        // The change reaches the database, but the reply never arrives
        db.dropAfterUpdate = false;
        db.offline = true;
        return { data: null, error: { message: "TypeError: Failed to fetch" } };
      }
      return { data: q.wantRows ? hit.map((r) => ({ ...r })) : null, error: null };
    }
    return { data: rows().map((r) => ({ ...r })), error: null };
  };
  const api = {
    select() {
      q.wantRows = true;
      return api;
    },
    update(patch) {
      q.patch = patch;
      return api;
    },
    insert(row) {
      q.insertRow = row;
      return api;
    },
    eq(k, v) {
      q.filters.push([k, v]);
      return api;
    },
    single() {
      const r = run();
      return Promise.resolve(r.error ? r : { data: r.data?.[0] ?? null, error: null });
    },
    then(resolve, reject) {
      return Promise.resolve(run()).then(resolve, reject);
    },
  };
  return api;
}

jest.mock("../lib/supabaseClient.ts", () => ({ supabase: { from: (table) => mockBuilder(table) } }));

const { tapResult, makeOp } = require("../lib/scoreQueue.ts");

function freshModule() {
  let mod;
  jest.isolateModules(() => {
    mod = require("../lib/scoreSync.ts");
  });
  return mod;
}

function setMatch(over = {}) {
  const m = {
    id: "m1",
    night_id: "n1",
    target_score: 21,
    score_a: 0,
    score_b: 0,
    status: "upcoming",
    player_a_id: "pa",
    player_b_id: "pb",
    winner_id: null,
    next_match_id: "m2",
    next_match_slot: "a",
    ...over,
  };
  db.matches.set(m.id, m);
  return m;
}

// Taps on the match as the scorer sees it, chaining like the page does
function taps(start, list) {
  const ops = [];
  let seen = { ...start };
  for (const [side, delta] of list) {
    const next = tapResult(seen, side, delta);
    const op = makeOp(seen, "tap", next);
    ops.push(op);
    seen = { ...seen, score_a: next.score_a, score_b: next.score_b, status: next.status };
  }
  return ops;
}

beforeEach(() => {
  db.matches = new Map();
  db.events = [];
  db.offline = false;
  db.dropAfterUpdate = false;
  localStorage.clear();
  setMatch({ id: "m2", score_a: 0, score_b: 0, status: "upcoming", player_a_id: null, player_b_id: "px", next_match_id: null });
});

test("sends taps in order", async () => {
  const { enqueue, flush } = freshModule();
  const m = setMatch();
  for (const op of taps(m, [["a", 1], ["a", 2], ["b", 1]])) enqueue(op);
  await flush();
  expect(db.matches.get("m1")).toMatchObject({ score_a: 3, score_b: 1, status: "live" });
  expect(db.events).toHaveLength(3);
  expect(localStorage.getItem("bowls-score-queue-v1")).toBeNull();
});

test("no signal: kept on the phone, sent when it comes back", async () => {
  const { enqueue, flush } = freshModule();
  const m = setMatch();
  db.offline = true;
  for (const op of taps(m, [["a", 1], ["b", 2]])) enqueue(op);
  await flush();
  expect(db.matches.get("m1").score_a).toBe(0);
  expect(JSON.parse(localStorage.getItem("bowls-score-queue-v1"))).toHaveLength(2);

  // The page is closed and opened again later, with signal
  db.offline = false;
  const reopened = freshModule();
  await reopened.flush();
  expect(db.matches.get("m1")).toMatchObject({ score_a: 1, score_b: 2 });
});

test("finishing a match sends the winner through", async () => {
  const { enqueue, flush } = freshModule();
  const m = setMatch({ score_a: 20, score_b: 15, status: "live" });
  for (const op of taps(m, [["a", 1]])) enqueue(op);
  await flush();
  expect(db.matches.get("m1")).toMatchObject({ score_a: 21, status: "complete", winner_id: "pa" });
  expect(db.matches.get("m2").player_a_id).toBe("pa");
});

test("changed on another phone meanwhile: not overwritten, scorer asked to check", async () => {
  const mod = freshModule();
  const m = setMatch();
  db.offline = true;
  for (const op of taps(m, [["a", 1], ["a", 1]])) mod.enqueue(op);
  await mod.flush();

  // Someone else scores the match while this phone has no signal
  db.matches.get("m1").score_b = 5;
  db.matches.get("m1").status = "live";
  db.offline = false;
  await mod.flush();

  expect(db.matches.get("m1")).toMatchObject({ score_a: 0, score_b: 5 });
  expect(mod.queueState().conflicts).toEqual([
    { matchId: "m1", message: "This match was changed on another phone - it's now 0-5. Check the score." },
  ]);
  expect(JSON.parse(localStorage.getItem("bowls-score-queue-v1") ?? "[]")).toHaveLength(0);
});

test("signal drops just after a score went through: not counted twice", async () => {
  const { enqueue, flush } = freshModule();
  const m = setMatch();
  for (const op of taps(m, [["a", 2]])) enqueue(op);
  db.dropAfterUpdate = true;
  await flush();
  expect(db.matches.get("m1").score_a).toBe(2);
  expect(JSON.parse(localStorage.getItem("bowls-score-queue-v1"))).toHaveLength(1);

  db.offline = false;
  await flush();
  expect(db.matches.get("m1").score_a).toBe(2);
  expect(localStorage.getItem("bowls-score-queue-v1")).toBeNull();
});
