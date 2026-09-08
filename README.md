# Bowls Live

A small live-scoring site for a knockout bowls competition:

- 4 qualifying nights, 16 players each, single-game-to-21 knockout, top 4 per night advance
- Finals day: the 16 qualifiers, knockout to one winner
- You enter the draw and update scores live from your phone (Android is fine, it's just a website)
- Anyone with the link sees live scores, updating automatically

## Stack

- **Next.js** (React) — the website itself
- **Supabase** — Postgres database, login for you as admin, and realtime updates for viewers
- **Jest** — unit tests for the bracket logic

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project (free tier is fine).
2. Once it's ready, open **SQL Editor** → **New query**, paste in the contents of `supabase/schema.sql`, and run it. This creates the `nights`, `players`, and `matches` tables, sets up permissions, and turns on realtime.
3. Open a new query, paste in `supabase/seed.sql`, and run it. This creates the competition's 5 nights (Monday–Thursday qualifying plus Finals Day) with fixed names and display order, so they immediately show up as nav links on the public site. Safe to skip or re-run — it won't duplicate a night whose name already exists.
4. Go to **Authentication** → **Users** → **Add user**, and create yourself an admin login (email + password). This is the account you'll use to log into `/admin`.
5. Go to **Project Settings** → **API**. You'll need the **Project URL** and the **anon public** key in the next step.

## 2. Configure the app

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the two values from Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` for the public site, `http://localhost:3000/admin` to log in and manage nights.

## 4. Run the tests

```bash
npm test
```

This runs the bracket-logic unit tests in `__tests__/bracket.test.js`.

## 5. Deploy so it's a real website

The easiest option is [Vercel](https://vercel.com) (made by the same people as Next.js, free for this kind of project):

1. Push this project to a GitHub repo.
2. In Vercel, "Add New Project" → import that repo.
3. When it asks for environment variables, add the same two from your `.env.local`.
4. Deploy. You'll get a URL like `bowls-live.vercel.app` you can share with players, and use on your phone for admin.

## How to run a night

1. Open `/admin` and log in. The 5 nights from `supabase/seed.sql` are already there — no need to create them.
2. Open a qualifying night and add the players in any order — drag them into the position you want for round 1 pairing (player 1 plays player 2, player 3 plays player 4, and so on). Spotted a typo? Click a name to rename it in place, any time.
3. Once you've added at least two players, click **Generate draw** — round 1 is created automatically from that order. Doesn't need to be an exact power of two (8, 16, 32...): if it isn't, the odd one out gets a bye and advances automatically, shown as "BYE" rather than a real opponent.
4. As matches are played, use the **+ / −** buttons to update the score live. Once someone reaches 21, hit **Mark complete** — the winner automatically drops into their next match. Made a mistake? Hit **Reopen** on a completed match to fix it, as long as the winner hasn't already started their next one.
5. A qualifying night plays exactly two rounds (e.g. 16 → 8 → 4 winners) and is labelled "Round 1" / "Round 2". Once a Round 2 match is marked complete, that winner appears in a new **Advancing to finals day** section at the bottom of the page — drag their name onto the finals-day number they drew (it shows who else, if anyone, already holds each one).
6. That does two things: it records the number next to their name on this qualifying night, **and** it drops them straight into that exact seat in Finals Day's own bracket — you'll see the match they'll play update live (in `/admin/night/[finals-day-id]`) without adding them yourself. This works as qualifiers come in from different nights on different days; each just slots into their number. Drag their name to a different number any time to move them — no need to reset anything, and it updates their match instantly, even after Finals Day's bracket has started.
7. Finals Day's own admin page already shows the full 16-slot bracket from the moment the night's created — every match blank ("TBC") until both slots' draw numbers are given out. Nothing to generate there; it just fills itself in as qualifiers are confirmed, on this page or from each qualifying night. There's a small "Add a player" option too, but it's only for the rare case of someone who didn't come through a qualifying night (a replacement, a bye) — drag them onto their number the same way.
8. The public homepage lists all 5 nights as big cards, each showing whether it's upcoming, live, or complete; anyone can jump between them, and each page updates live with no refresh needed — including Finals Day, which shows the same "TBC" bracket layout as any other night, filling in in real time as qualifiers are confirmed. Once the Final is won, a banner announces the champion.

A couple of things worth knowing:

- If you move someone's finals-day number after their match has already started (scores entered), those scores stay with the old seat rather than following them — use **Reset bracket** to start that match over if that happens by mistake.
- If a viewer's connection drops, the public page shows a "reconnecting" message rather than silently going stale, and reports if the page itself failed to load at all.

## Project structure

```
app/
  page.tsx                 Public homepage — list of nights
  night/[id]/page.tsx      Public live bracket view for one night
  admin/
    login/page.tsx         Admin sign-in
    page.tsx               Admin dashboard — create/list nights
    night/[id]/page.tsx    Admin editor — players, draw, live scoring
lib/
  bracket.ts               Pure bracket logic (round names, winners) — unit tested
  adminActions.ts          Supabase writes: create night, generate bracket, score, etc.
  supabaseClient.ts        Supabase browser client
  types.ts                 Shared row types
supabase/
  schema.sql               Database schema — run this once in Supabase's SQL editor
  seed.sql                 Creates the 5 competition nights with fixed names/order — run once after schema.sql
components/
  NightNav.tsx             Shared top nav of all 5 nights, used on the public homepage and night pages
__tests__/
  bracket.test.js          Jest tests for lib/bracket.ts
```
