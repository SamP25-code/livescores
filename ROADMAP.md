# Roadmap

Planning notes only. **Nothing here gets built until Sam explicitly says to start it.**

## Context

Bowls Live currently runs a single competition for Penwortham Sports & Social Club: the October
Singles 2026 - 4 qualifying nights of 16 players, 4 qualifiers from each into a 16-player Finals
Day, much of it hardcoded.

**The 2027 goal (agreed 2026-10-15):** host up to **20 tournaments across different clubs, all
on one site**. Build over winter 2026/27, pilot with one or two other clubs early in 2027, then
open it up.

## Formats

**Wording (agreed 2026-10-18):** on screen it's a **qualifying session**, not a "qualifying night",
since some will be played in the daytime. (The October Singles 2026 nights keep their names; the
database column names don't change.) Older notes below still say "night" in places - read it as
"session".

**Sponsors (agreed 2026-10-18):** a competition can have **more than one sponsor** - each with a
name and website, added one under another ("+ Add another sponsor") on the set-up form, shown in
that order.

Not every tournament will look like Penwortham's. The formats known so far:

- **Qualifying nights + Finals Day** - today's format (e.g. 4 nights of 16, top 4 each through
  to a 16-player Finals Day).
- **Single day** - any draw size down to a winner, all on one day: e.g. 32 players (5 rounds),
  or 4 players (semi-finals then a final). This is essentially a Finals Day on its own, with
  players entered directly and no qualifying nights. The bracket, live scoring, bracket view
  and champion display all carry over.
- **Final only** (agreed 2026-10-16) - just the final of a competition that's otherwise run off
  the site: the organiser enters the two finalists and the result, and the winner is recorded.
  Lets a club put its final on the site with little effort - and lets its winner feed a
  qualifying place elsewhere (see "Qualifying places" under Blackpool Masters). Most qualifying
  competitions are expected to be entered this way, **as results only, not live scores** -
  sometimes just the finalists and who won - so this needs to be as quick as possible to fill in
  (two names from the person search, tap the winner, optional score). Live scoring stays
  available if a club wants it.

Both run as **singles or doubles** - 2027 needs both (agreed 2026-10-15). See "Doubles" below.

Build for every possibility, chosen per competition, rather than hardcoding either. The
settings for a competition:

- **Format** - qualifying nights + Finals Day, single day, or final only
- **Singles or doubles**
- **Entry** - open (the organiser enters players), by qualification / invitation (places filled
  from qualifying routes and wildcards - see "Qualifying places"), or entered on the night
- **Label** (optional) - e.g. **Ladies**; shown as a pill on the competition and filterable on
  the home list (Juniors / Veterans could follow)
- **Players TBC** - a competition can be listed before its entries are known; its places show
  "To be confirmed" until filled
- **Draw method** - made in advance by Sam, or made on the day by the club organiser (see
  "Draws" below)
- **Dates** - each qualifying night's date, and the Finals Day / single day date
- **Entries per qualifying night**
- **How many qualify** from each night
- **Draw size** for the Finals Day / single day (16, 32, ...; byes already fill gaps)
- **Winning score** - 21 or 31 (already stored per match as `target_score`, default 21)
- **Scoring style** - live point-by-point (as Finals Day now) or results only (as qualifying
  nights now)

What's hardcoded today and needs to become one of these settings: the 16-slot finals draw
(`buildFinalsSlots`), the qualifier bracket always being 2 rounds (16 down to 4), and live vs
results-only being decided by `night.kind`.

**Settings are fixed once set.** A competition's size and winning score never change
mid-competition. The settings form should still lock once a draw is made - cheap to build, and
stops a stray tap changing a live competition.

**Who sets competitions up.** For 2027, Sam sets up every competition himself through a
settings form in admin - he keeps control while it's new and can catch settings that don't add
up (e.g. 7 qualifiers into a 16 draw). Later, if it works well, the same form can be opened to
trusted admins (a per-admin "can set up competitions" tick box - see Roles) - building it as a
form from the start makes that only a change of who's allowed to use it.

**Phone layout for big draws.** The list view works at any size. The bracket view gets very
wide at 32 (5 rounds) - needs design thought, probably showing two or three rounds at a time.

## Players as people (agreed 2026-10-15)

Today a player is just a name typed in for one night, so the same person in three competitions
is three unrelated rows, and "Wayne Ditchfield" / "W Ditchfield" would be two people. Players
become real records:

- A **`people`** table - one row per real person (name, and their club if they have one).
- An **entry** links a person (or two, for doubles) to a competition; matches are between
  entries. Every place that today stores a `players` row id points at an entry instead.
- **Player page** - every competition they've played, results, titles won; head-to-heads later.

**Adding a player (agreed 2026-10-15)** - entering a name is a **search bar**: as the organiser
types, everyone already in the app's history who matches shows up, and they tap to select them.
A new person is only created if they're not there - so duplicates don't creep in. Used wherever
a name is entered: entries, replacements on the night (see Draws), doubles partners, and adding
past winners to an honours board.

**People with the same name (agreed 2026-10-15)** - common across 20 clubs (two John Smiths):
1. **Search results show who's who** - name plus club and when they last played, e.g.
   "John Smith · Penwortham · last played Oct 2026" / "John Smith · St Anne's · last played Jun
   2027". Uses information the app already has.
2. **"Same person?" check** - if the organiser types a full name that already exists and taps
   "Add new" instead of picking one, ask: "There's already a John Smith (St Anne's, last played
   Jun 2027) - is this them?" -> **Yes, use them** / **No, a different person**.
3. **A different person needs one distinguishing detail** - their club, or if they're at the
   same club a short note ("Snr", "Jnr", a middle initial: "John A. Smith"). The note shows in
   search results from then on.
4. **Public pages add the detail only when needed** - normally just "John Smith"; if two people
   with the same name appear on the same page or in the same competition, each shows their club
   or note, e.g. "John Smith (Penwortham)".
5. **Fixing mistakes** - admins can **merge** two records that turn out to be the same person,
   and **split** one that was picked wrongly, moving the affected results to the right person.
   Merges and splits are logged.

No dates of birth or other personal details for telling people apart - club plus an optional
note does the job without storing anything sensitive (keeps the privacy side simple).

**Previous winners / history.** Each competition gets an **honours board** - champion (and
runner-up) by year. Because winners are people, the board links to their player page. Years
from before the site existed can be added by hand (year + winner's name) so a competition's
history isn't limited to what was played here. Shown on the competition page and the club page.

Needs the privacy decisions below (a public page per person).

## Doubles (agreed 2026-10-15)

An entry is one person (singles) or **two** (doubles); everything else - draws, live scoring,
bracket, qualifiers, champions - works on entries, so it's shared by both.

- Shown as "Wayne Ditchfield & Tim Hodge"; on narrow phone layouts (bracket) this needs a
  shorter form - surnames ("Ditchfield & Hodge") or two lines - to be designed.
- Draw numbers belong to the entry (the pair), as now for a player.
- Both partners get the result on their player pages; honours list both names.
- A person can be in a singles and a doubles competition at once, and partner different people
  in different competitions.

## Draws (agreed 2026-10-15)

Both happen in 2027, chosen per competition (or per night):

- **In advance** - Sam (or a club admin) makes the draw beforehand and publishes it when ready.
  This is today's flow (arrange round 1, "Publish draw"), kept as is.
- **On the day** - the club organiser does it at the green, on a phone, with players waiting.
  Needs to be quick and hard to get wrong (flow: Draw -> Publish):
  - The draw is made from **everyone entered** - there's no "who's turned up" step before it.
  - Either **record a physical draw** (each entry's drawn number from a picker, like the finals
    number picker; taken numbers drop out, unused numbers become byes) or press **"Draw at
    random"** in the app, with a preview and a "redraw" before it's confirmed.
  - **Publish** straight away so the public page shows the draw.
  - Record who made the draw and when, so there's no argument afterwards.
- The organiser is an **Admin** assigned to that competition (see Roles).

**Time slots (agreed 2026-10-16)** - for one-day competitions only (qualifying sessions and
Finals Day just start at the session's time - Sam, 2026-10-18), the admin sets round-1 start times **by draw number**, e.g. "1-8 at 10:00, 9-16 at
10:45, 17-24 at 11:30...". Each first-round match then shows its time on the draw ("10:45 · 9 v
10"), on each player's page ("Your match: 10:45") and on the home page's Next up card (first
start). Later rounds show "Time to follow" (or an estimate if wanted); any single match's time
can be changed by hand.

**Changing people after the draw (agreed 2026-10-15)** - applies to both draw methods, and
happens all the time, so it's a quick action on the player's row, available at any point:
- **Didn't turn up -> mark as a bye.** Their opponent goes through (as the no-show button works
  today). Only done *after* the draw is published. The name stays in the draw, struck through,
  so it's easy to undo if they turn up late.
- **Replace with someone else.** The replacement takes over that exact place - same draw number,
  same opponent, same spot in the bracket. Pick them from existing people or add a new one (see
  "Adding a player" under Players as people), so the result goes on the replacement's record.
- Every change is logged (who was replaced by whom, when, by which admin), so it's clear later
  who actually played, and the original entrant's record doesn't show a match they never played.
- A player can be replaced in any match that hasn't finished; once the result is in, that
  match's players are locked so a result can't end up credited to the wrong person.
- No mockups needed for this (Sam, 2026-10-15) - the logic above is the spec.

## Structure

1. **Competitions and a multi-year archive**
   A `competitions` table (club, name, year, status, plus the settings above) and a
   `competition_id` on `nights`. A club can run more than one competition a year (Penwortham's
   2027 plan has "Floodlit Singles" and "October Singles"), so `year` is just a field for
   grouping.

   - **planned** - may or may not have dates yet, no players/draw. Nothing to click through to.
   - **active** - works as the site does today.
   - **archived** - past competition, results kept and viewable, nothing further changes.

   Status changes are a manual admin toggle (like "Publish draw"), not inferred from dates.

2. **Clubs and events**
   An `organisers` table, each row a `club` or a standalone `event` (see Navigation);
   competitions belong to one. Branding that's built into the site today -
   the Verve Wills sponsor logo and link, the "Penwortham Sports & Social Club" name, the
   fireworks photo - becomes per club (sponsor arguably per competition) instead of living in
   `components/Brand.tsx` / `app/globals.css` / `public/`.

3. **Roles - assigned per competition (agreed 2026-10-16, replaces "roles per club")**

   | Role | Who | Can do |
   |---|---|---|
   | **Super** | Sam only | Everything. **Sets up every competition and its structure** (format, singles/doubles, number of qualifying nights, players per night, how many go through, draw size, 21/31 up). Creates admins and assigns them. Sees the overview across all competitions. |
   | **Admin** | A competition organiser | Runs **the competitions they're assigned to**: enters players, makes / publishes the draw, changes people, sets time slots, postpones nights, corrects results, and **creates scorer logins** for those competitions. **Can't change the structure.** |
   | **Scorer** | Helpers on the night | Scores matches in the competitions they're assigned to - nothing else. |

   - **No "User" role** - spectators never need an account; everything public is viewable
     without logging in. Player accounts could come later if something needs them (Follow a
     player can work without).
   - **Why Sam sets the structure in 2027** - it's decided once and locked, and everything after
     depends on it; one person setting all 20 keeps them consistent and catches settings that
     don't add up (e.g. 7 qualifiers into a 16 draw). Later, a per-admin "can set up
     competitions" tick box can open the same form to trusted admins - no rebuild.
   - **Assignments are per competition**, not per club (there are no club pages): an admin can
     run several competitions, and one person can be an admin on one and a scorer on another.
     Row-level security checks the login's assignments for the competition being changed. The
     admin Users page (built Oct 2026, generated passwords) gets a competition picker; an admin
     only sees and creates logins for their own competitions.

## Web address

**A new, neutral website** for everything (agreed 2026-10-16, details TBC). `pssc-bowls.co.uk` is
kept as Penwortham's shortcut - specifically to its **October** competition.

**Year-less competition addresses** - each competition has two:
- `/october-singles` - always opens **the latest year** of that competition
- `/october-singles-2026` - that specific year, for the archive

So one link on posters, the Facebook page and the noticeboard never goes out of date - true for
every competition (Blackpool Masters, St Anne's...), not just Penwortham's. **`pssc-bowls.co.uk`
forwards to `/october-singles`**, so it's right every October without anyone touching it.

**Choosing the name** (not chosen yet):
- **Neutral** - no club, sponsor or town in it, so any club is happy to use it.
- **Says what it is** - someone seeing it on a poster knows it's live bowls scores.
- **Easy to say aloud and type on a phone** - short, no hyphens if possible, hard to misspell.
- **`.co.uk` free**, and ideally the matching Facebook / Instagram names too.
- Directions to check (availability not checked): crowngreenlive, crowngreenscores, livebowls,
  bowlslive (the working name), greenscores.

**Buy early, switch over with the pilot** - secure the domain as soon as it's picked (a few pounds
a year, and stops anyone else taking it once word spreads); point it at the site when the
multi-competition version goes live. Until then `pssc-bowls.co.uk` carries on exactly as now.
**Keep `pssc-bowls.co.uk` on auto-renew** - it's on posters and in shared links, so the forwarding
stays for as long as it's in use.

Setting a new domain up is the same GoDaddy + Vercel steps used for `pssc-bowls.co.uk`;
`metadataBase` in `app/layout.tsx` then needs the new domain.

The separate website that currently links here (not Penwortham's own club site) will change
address at some point - nothing changes on this side, it just needs its link updated.

## Navigation - competitions first (agreed 2026-10-16)

Replaces the earlier clubs-then-competitions layout. Visitors care about competitions, so the
site is **Home -> Competition -> Night** - three levels, with clubs and events in the
background. Concept mockups made 2026-10-16 - see `docs/concepts/` (`home-live-and-quiet.jpg`,
`competitions-first.jpg`, `blackpool-masters-weekend.jpg`).

```
Home
──────────────────────────────
● LIVE  Floodlit Singles · Penwortham

Calendar  (see "Calendar" below)
  ‹ June 2027 ›     [Showing Floodlit Singles · Show all]

Competitions                                   2027 ▾
  [All] [Live now] [Coming up] [Finished] [Singles] [Doubles]
  ▌Floodlit Singles      ● Live   Penwortham · Singles · 4 nights + Finals Day   Open ›
  ▌Blackpool Masters    Coming up  Event · 3 competitions · Fri 17 – Sun 19 Sep    Open ›
  ┊October Singles       Planned  Penwortham · Dates to be confirmed             Open ›
  ┊Spring Singles       Finished  St Anne's · Champion …                         Open ›
```

1. **Home** (layout agreed 2026-10-16, from phone mockups) - built around why people arrive
   ("what's the score?", "when am I playing?", "what's on / who won?"). The top changes with
   what's happening; the rest is always the same. In order:
   - **When something's live** - the live banner, then a **"Live scores" card** with the matches
     in play: both names (whoever's ahead in bold), scores in the big scoreboard font, and each
     match's competition and round, so visitors at the green get the scores without a tap.
     **Capped at 4 matches**, then "See all live scores ›" (keeps a busy Finals Day short). If two
     competitions are live, matches from both, each labelled.
   - **When nothing's live** - a **"Next up" card** instead: the next competition, who runs it and
     its format, a big **countdown in days**, the date / which night / start time, whether the
     draw is out ("Draw published · 16 entered"), and **See the draw ›**. **If two competitions
     start in the same week, show both**; otherwise just the nearest.
   - **Calendar** (see "Calendar" below).
   - **Find a player** - search box straight to a player page (next match, draw, past results).
     Sits **below the calendar for now**; it could move up later if it turns out to be heavily
     used (the viewer log / page views will show).
   - **Competition list** (below).
   - **Recent champions** - the last two or three winners with a gold trophy badge, their
     competition and date.
   - **Footer** - one-line description, a **"Running a competition? Get in touch"** button (how
     new clubs and events find the site), About · Privacy, and credits for any site-wide
     supporters (separate from each competition's own sponsor).
   - Kept **off** the home page: full draws, long result lists - one tap away is fine, and a short
     page matters on a phone with patchy signal at the green.

   The calendar and list work together: tapping a competition row highlights its dates on the
   calendar ("Showing …" bar under the calendar, with "Show all"); its **Open ›** goes to the
   competition.
   - **Each row** - colour bar (matching the calendar; dashed if it has no dates yet), name,
     status (**Live / Coming up / Planned / Finished**), who runs it (club name, or "Event"),
     singles/doubles and format, dates written out, and the champion once finished.
   - **Order** - live first, then coming up by date, then planned, then finished.
   - **Filters** - All · Live now · Coming up · Finished · Singles · Doubles (+ labels such as
     Ladies), scrolling sideways on a phone.
   - **Year switch** (2027 ▾) - past years' competitions; this is the archive.
   - **A multi-competition event is one row** (e.g. "Blackpool Masters · 3 competitions",
     agreed 2026-10-16) that opens the event's weekend page, rather than one row per
     competition. On the calendar each of its competitions still gets its own date marks.
2. **A competition** - header (name and year, "Run by <club>", sponsor), its settings as
   pills (Singles · 4 nights of 16 · Top 4 through · 16 on Finals Day · 21 up), its schedule as one
   list (finished nights ticked with how many went through, tonight marked Live, upcoming nights
   with start times, Finals Day in gold - each opens that night), then its **honours board**
   (roll of honour - this is the only place it lives; agreed 2026-10-16). A
   planned competition with no dates says "Dates to be confirmed"; a planned night with no details
   says so rather than showing an empty page.
3. **An event with several competitions** (e.g. Blackpool Masters) - the event's page: dates,
   sponsor, a day-by-day strip (one tile per day, competition colour with the gold trophy ring,
   today outlined, ● LIVE), then one row per competition (status, settings pills, champion or
   current round, Open ›), then last year's winner of each.
4. **A night** - as today.

**No club pages (agreed 2026-10-16)** - the public site is just the competitions list and each
competition's page (plus a multi-competition event's page). Clubs still exist **behind the
scenes**: every competition belongs to a club or event, which carries its admins, scorers,
branding, sponsor and history - but there's no public page per club, no club filter, and "Run by
Penwortham" on a competition is plain text. Sharing is done with each competition's own address
(see Web address). Each competition's roll of honour is on its own page.

**Data:** clubs and events are one table ("organisers"), each marked `club` or `event`, so
admins, scorers, branding, sponsors and the archive all work the same for both - no second system.

## Blackpool Masters 2027 (agreed 2026-10-16)

A standalone event (not a club) running **three competitions over one weekend**, Fri 17 - Sun
19 September 2027, shown as one row on the home list ("Blackpool Masters · 3 competitions").

| | 31-up Challenge | Masters Invitation 32 (main event) | Ladies 32 |
|---|---|---|---|
| Day | Fri 17 Sep | Sat 18 Sep | Sun 19 Sep |
| Format | Single day, **4 players** - semi-finals then a final | Single day, **32 players** | Single day, **32 players** |
| Winning score | **31** | 21 | 21 |
| Entry | Entered on the night | **By qualification + wildcards** | **TBC** |
| Draw | **On the night** (see Draws) | **Made in advance**, uploaded ahead of the day | TBC |
| Label | | | **Ladies** |

### Qualifying places (for the Invitation 32)

The 32 places are filled from **qualifying routes**, then **wildcards**. Last time: **26
competition winners**, then wildcards chosen by the organisers near the time. The qualifying
events for 2027 are announced next year, so the competition is set up with its places first and
the names filled in as they become known:

- **Each place has a source**, shown publicly until it's filled - e.g. "Winner - October
  Singles 2027 (Penwortham)" - which also advertises those competitions.
- **Qualifying events on the site** - the winner fills the place **automatically** when that
  competition finishes, the way qualifiers fill Finals Day today. Most will be **results only**,
  often just the final (see "Final only" in Formats) - the winner still feeds through.
- **Qualifying events not on the site at all** - the organiser **types the winner in** against
  that place (person search).
- **Wildcards** - places marked "Wildcard", filled by hand by the Blackpool Masters organisers
  near the time.
- Places can be added or edited as qualifying events are announced, without changing anything
  else about the competition.
- Once all 32 are known, the draw is made in advance and published ahead of the day.

**The Blackpool Masters as its own event (Sam, 2026-10-20)** - the event gets its own tab / page,
not just a row of competitions, because there will be more on it: **advertisements**, **short
articles** about the event, and **updates on who's qualified**, alongside its three competitions,
the weekend's schedule and the qualifying list. So the event page needs simple **posts** (a title,
some words, a picture, a date), and room for adverts. Built with the qualifying competitions.
Concepts: `docs/concepts/blackpool-event-page.jpg` and `blackpool-event-posts.jpg`.
- **Who writes posts (Sam, 2026-10-20)** - Sam only: the organisers send him the words and
  pictures and he uploads them.
- **Adverts** - placed wherever the admin chooses on the page; details TBC.
- **Automatic qualifier posts** (the site drafting "X wins the Y and qualifies" when a winner is
  entered) - undecided, TBC.

**Qualifying competitions (Sam, 2026-10-19)** - concept in
`docs/concepts/qualifying-competitions.jpg`:
- Any competition can be **entered by qualification**; it then has a **Qualifying** tab for Super
  and its admins, listing its places (each a qualifying competition's winner, or a wildcard).
- **A qualifying competition on this site** (e.g. the October Singles) - pick it; its champion
  fills the place automatically when its final finishes.
- **A qualifying competition not on this site** - add its **name, where it's played and the date
  of its final**, and choose **how many results to enter**: just the final, semi-finals and final,
  quarter-finals onwards, or just the winner (no scores). Results are entered with the person
  search, and **the winner takes that competition's place** in the list. It also becomes a small
  results page of its own.
- The list doubles as the public **"How to qualify"** page ("Fylde Classic · Kirkham · Sat 5 Jun -
  Alan Hart, Qualified" / "To be decided"), which also advertises those competitions.

**Exceptions are handled by hand (agreed 2026-10-16)** - rather than automatic rules:
- **Someone qualifies twice** - their **first** qualification counts; the second place becomes a
  **wildcard**. The site doesn't do this itself: it **flags** the duplicate to the admin ("Tim
  Hodge already qualified via the October Singles") and leaves that place unfilled.
- **A qualifier can't make the date** - that place becomes **another wildcard** too.
- **Admin control for both** - on any place, the admin can **change it to a Wildcard** and fill it
  from a **person search box** (the same search as everywhere else). A place's original source
  ("Winner - Summer Open") stays recorded against it, so it's clear later why it became a
  wildcard.

Existing shared links to `/night/[id]` should keep working (redirect into the new structure).

## Hosting and cost

- **Supabase Pro (~$25/month)** - needed. The free plan allows roughly 200 live connections at
  once (one per open night page) and pauses after a week of no activity. Pro raises the
  connection limit and never pauses. Competitions clash at most two at a time, which Pro
  handles; if two very busy finals days coincide, Supabase sells a higher connection limit as an
  add-on.
- **Vercel Pro (~$20/month)** - the free plan is for non-commercial use, and a multi-club site
  with sponsors isn't. Bandwidth isn't a concern either way.
- Decide who pays - Sam, or a small fee per club.
- The daily keep-alive job (`/api/keepalive`, `vercel.json`) becomes unnecessary on Supabase Pro
  but is harmless to leave.

## Test database (Sam to set up after Finals Day 2026, before building any of this)

All branches currently share **one** Supabase database, so preview links read and write live
data - test data has leaked onto the live site twice (including test nights from an earlier
attempt at this work, on a `2027-structure` branch that was reset). With 20 clubs relying on
it, previews need their own database:

About 15 minutes, free:

1. Supabase dashboard -> **New project**, e.g. `bowls-live-test`, free plan (two free projects
   are allowed, so it sits alongside the live one).
2. In the new project's **SQL Editor**, run the contents of `supabase/schema.sql`, then
   `supabase/seed.sql` for sample data.
3. Vercel -> **Settings -> Environment Variables**: set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` for the **Preview**
   environment to the test project's values (found in its **Project Settings -> API**). Leave the
   **Production** values alone so the live site keeps the real database.
4. Create a test admin login in the test project. The admin Users page needs an admin to exist
   first, so the first one is made in the Supabase dashboard (Claude can walk through it).
5. Redeploy a preview so it picks up the new values.

From then on, preview links read and write only the test database. The free test project pauses
after a week unused - restore it in the dashboard when needed.

## Known bug to fix with the competitions work

`getFinalsRoster()` and `setFinalsNumber()` in `lib/adminActions.ts` find "the" finals night
with `.eq("kind", "finals").limit(1)` - fine with one competition, but with several each Finals
Day would be indistinguishable, and qualifiers could land in the wrong competition's draw. Scope
both by `competition_id` (the caller always has the current night, and its competition, in
hand).

## Migration

The live October Singles 2026 data needs to become "Penwortham -> October Singles 2026" (backfill
`competition_id` on its nights, create the club and competition rows, move the branding into the
club's data) without breaking the archive of this year's results.

## Calendar (agreed 2026-10-15)

A public month calendar on the home page, replacing a plain "Coming up" list - competitions with
qualifying nights then a Finals Day run over several dates, which a list can't show well. It
also covers the earlier idea of a cross-club calendar for spotting clashes. Concept mockups were
made on 2026-10-15 - see `docs/concepts/calendar-gold-ring.jpg` and `calendar-options-compared.jpg`.

**Month grid** (Mon-Sun, `‹ ›` to change month):
- **Qualifying night** - a small dot under the date, in the competition's colour.
- **Trophy day** (Finals Day or single-day event - any day a champion is decided) - the date in
  a filled circle of the competition's colour **with a gold ring** around it (chosen over a plain
  circle on 2026-10-15: the big days stand out, a Finals Day and a one-day event look the same,
  and you can still see whose day it is).
- **Today** - ringed; if something's on tonight, "● LIVE" under the date.
- Days from the next/previous month are greyed but still marked, so a competition that runs
  over the month end (e.g. qualifying Mon 28 Jun - Thu 1 Jul, Finals Day Sat 3 Jul) reads as one.
- A key under the grid: dot = qualifying night, gold-ringed circle = Finals Day / single day.

**Below the grid** - one row per competition that month: a colour bar matching its marks, its
name, its club (or "Event"), and its dates written out, e.g. "Qualifying Mon 7 – Thu 10 Jun ·
Finals Day Sat 12 Jun". The rows double as the colour key, so nothing relies on colour alone.

**Colours** - assigned to the competitions *shown in that month* in a fixed order (the mockup
used green `#2f7d4a`, blue `#2f63a8`, raspberry `#c2477f`). **Gold is reserved for the trophy
ring** and never used as a competition colour, so it only ever means "trophy day" (matching
Finals Day being gold in the night tabs). Purple was tried and is too close to the blue for
colour-blind viewers; the raspberry is borderline for them, which is fine because the rows name
every competition - but re-check any new colours (the dataviz palette validator) before adding
them. Beyond about six in one month, don't add more colours - lean on the rows.

**Behaviour**
- **Tap a competition in the list -> its dates light up** on the calendar (agreed 2026-10-15):
  that competition's dots and ringed circle stay bold and the rest fade back, so its whole run -
  qualifying nights through to Finals Day - is easy to see at a glance. If its dates are in
  another month, the calendar jumps there. Tap it again (or another competition) to change or
  clear the highlight. The row gets an "Open ›" link to go to the competition itself, since a tap
  on the row now highlights rather than opens.
- Tapping a date shows what's on that day.
- Everything is filled automatically from each competition's dates in the settings form -
  nothing entered twice.

**Needs** the structured dates from the competitions work first.

**Still to decide** - whether to add a one-line "Next up: …" above the calendar for people who
only want the next date.

## Privacy (to look into)

A public site naming members of many clubs, with player pages and years of archived results,
needs: a short privacy notice; a way to remove or anonymise someone's name on request (their
results stay, shown as "Withdrawn player" or initials); a decision on juniors (under-18s -
initials only, or club consent); and who answers requests (Sam, or each club). Settle before the
pilot, since player pages make names more prominent than they are today.

## Shareable results (agreed 2026-10-15, styles later)

One tap to make a results image ready to post on Facebook / WhatsApp / Instagram - e.g. after a
qualifying night (who's through), after Finals Day (champion and runner-up), or a single match.
Carries the club and sponsor branding. On a phone it opens the share sheet directly; on a
computer it downloads. **Formats and visual styles to be decided later** - plan for a few
templates (square for Instagram, landscape for Facebook).

**Share as text first (agreed 2026-10-16, format and structure TBC)** - once all the results of a
night / day / competition are entered, a **"Share results"** button appears that creates a
ready-to-post **text** version (e.g. who won, scores, who's through) to paste into Facebook,
WhatsApp or a club group. On a phone it opens the share sheet; otherwise it copies to the
clipboard (and can be downloaded as a text file). Simpler than images, so it can come well
before them; the images build on it later.

## Sponsor reports (agreed 2026-10-15)

Built from the viewer log already running: per competition, how many different phones looked
in, the peak and when, and viewers per night - plus the competition's page views if those get
tracked. A simple page (or PDF / image) a club can hand its sponsor, e.g. "1,240 people
followed the October Singles, 86 watching the final at its peak". Helps clubs keep sponsors, and
could support a fee. Needs the viewer log to be per competition (it's per night today - just
total across the competition's nights).

## Help for club admins (agreed 2026-10-15)

A short "how to run your competition" guide for club organisers who won't have Sam next to
them: adding players, making the draw (in advance and on the day), scoring, publishing, giving
scorers logins, and what to do if something goes wrong on the night. Ideally linked from inside
the admin pages ("?" next to each step), plus a printable one-page version for the clubhouse.

## Rain-offs and postponements (agreed 2026-10-16 - a 2027 requirement)

Bowls nights get rained off, so a night or day can be **Postponed**:
- Shown on the competition page, the calendar and the home page, with a short reason and the new
  date when known ("Rained off - now Thu 10 Jun").
- The night **moves to a new date** without touching its draw or entries.
- **Part-played nights** - finished matches stay finished; unplayed ones carry over to the new
  date.
- The calendar moves its marks to the new date (the old date can show a small "postponed" note).

## Venues (agreed 2026-10-16 - a 2027 requirement)

Each competition shows **where it's played**: venue name, address and a **"Get directions"** link
(opens Google / Apple Maps), with optional parking / spectator notes ("Bar open, seating
available"). A competition can use **different venues for different rounds** (e.g. qualifying at
the club, Finals Day elsewhere), so venue is set per night / day, defaulting to the
competition's.

## Branding and backgrounds (agreed 2026-10-19)

- The site's name, tagline, link-preview description and phone icon are neutral for now ("Bowls
  Live", a "BL" icon) and all live in `lib/site.ts` / the icon files - Sam will change them when
  the real name and domain are chosen.
- **Background photo** - the Penwortham fireworks photo will be replaced with a **general
  background**, and each competition can have **its own background**, uploaded by the user (like
  sponsor logos), shown on that competition's pages.

## SuperAdmin overview (agreed 2026-10-16 - a 2027 requirement)

One admin screen for Sam showing what needs attention across every competition, so he isn't
clicking through 20 of them: draws not yet published for this week, competitions with no
scorer set up, qualifying places flagged as duplicates or still empty, postponed nights without a
new date, and tonight's live competitions at a glance.

## Correcting results (agreed 2026-10-16 - a 2027 requirement)

Once results feed the next round, honours boards and qualifying places, a wrong result matters
more:
- A clear way for an admin to **correct a finished result** (today it's "reopen" on the night).
- Every correction is **logged** (old and new result, who, when).
- **Everything downstream updates** - the next round's players, the champion, the honours board,
  and any qualifying place it fed. If the next round has already started with the wrong player,
  the admin is warned and decides (it may need the "replace" rule from Draws).

## Scoring by stage, and typing a score (raised 2026-10-21 - later)

- Scoring is set once for the whole competition (live, or results only).
  Some will want results only on the qualifying sessions, then live scoring
  on Finals Day: let the scoring style be chosen for qualifying and for
  Finals Day separately.
- Live scoring keeps the +1, +2 and - buttons (as for the October Singles
  2026), and also lets the scorer type the score straight in - from 10-10 to
  17-17 in one go, rather than pressing through each point.

## Ideas to decide on (2026-10-16)

- **QR posters?** An automatic printable poster per competition (name, dates, venue, QR code to
  its year-less address) for clubhouses - cheap way to get spectators on the site.
- **Installable site?** "Add to home screen" so regulars get an app-like icon without an app
  store - also what makes "Follow a player" notifications possible.
- **Monitoring?** Switch on error alerts (Sentry is already wired in), an uptime check that emails
  Sam if the site goes down, and a clear "who to contact if something breaks mid-competition"
  line in the club admins' help guide.
- **Pricing / who pays?** Hosting is about $45/month (see Hosting and cost). Options: free for
  clubs (Sam, or a site-wide sponsor in the footer credit), a small yearly fee per club or
  competition, or free for the pilot clubs then decide. This October's sponsor report is useful
  evidence either way. Settle before the pilot.

## Scoring with poor signal (agreed 2026-10-16 - a 2027 requirement)

Every score tap goes straight to the database today; if the signal drops at the green, a tap can
fail without the scorer noticing - the most likely way for a wrong score to get onto the site.
With 20 competitions at different greens it has to be handled:
- Taps are **queued on the phone** when there's no connection and **sent in order** when it
  comes back - nothing is lost and nothing is applied twice.
- The scorer can **always see** whether everything has been sent (e.g. "All saved" / "3 taps
  waiting to send" / "Offline - scores will send when you're back online").
- If two scorers change the same match while one was offline, the later change wins and both
  are told; the score history (match events) keeps every step.

## Easy to read for every age (agreed 2026-10-16 - applies to every screen)

Many players and spectators are older, so: big text, strong contrast, large tap targets, plain
words. A **"Larger text"** option (remembered on that phone) is cheap to add. Check every new
screen against this before it ships, on a real phone outdoors.

## Follow a player (agreed 2026-10-16 - after the core work)

Once players are people: a **Follow** button on a player page, so family and friends get a
notification when that player is about to play and when they win or lose (a phone
notification for the site added to the home screen). Nice to have - after the 2027 core work.

## Next.js 15 upgrade (agreed 2026-10-16 - before the 2027 build)

The site is on Next.js 14.2.35, which fixes the warning Vercel showed, but npm's audit lists
further Next.js advisories only fixed in 15.5+ (none of the critical ones affect this site - see
the October 2026 notes). Upgrade in November, after the competition and **before** the 2027
work starts, so everything new is built on the current version. It touches every page, the
API routes and React itself, so it needs its own branch and a full test on a preview.

## After Finals Day 2026 (agreed 2026-10-16)

1. **Sponsor report for Verve Wills** - from the viewer log: different phones per night, the
   peak and when, Finals Day itself, and total hours watched. A thank-you to the sponsor and a
   ready-made example to show other clubs. (SQL drafted 2026-10-16.)
2. **Back up the results** - export `players`, `matches` and `match_events` once Finals Day is
   done. This year's results become the first entries in the October Singles' roll of honour, so
   keep them safe before any 2027 database changes.
3. **Ask for feedback** - a quick question to players and spectators: what they used, what was
   missing. Shapes 2027 better than guessing.
4. Tidy the old merged git branches.

## Timeline - everything before Christmas (brought forward 2026-10-19)

**First competition: Saturday 13 March 2027 - a one-day doubles at Penwortham, 32 pairs.**
Sam brought the plan forward (2026-10-19): **build everything before Christmas 2026**, leaving
January and February for additions and changes, the dry run, and plenty of slack before 13 March.

| When | What |
|---|---|
| **October 2026 (done)** | Next.js 15, test database, competitions + settings, people + doubles entries, draws (random / physical) + start times, changing people, roles + assignments, scoring with poor signal, correcting results, postponements, new home page / calendar / competition pages, sponsor logos, practice times, Larger text and the readability pass, choose-your-own password, Super "View as" |
| **Late October (done)** | **Qualifying places and qualifying competitions** (Blackpool Masters), the **multi-competition event page** with posts and adverts, **County competitions** (a venue per session), **clubs and venues as one list** (each club with its green), the home page and side menu redesign (search, Clubs, County, Events), one row style for every competition list, Back on every page, moving / renaming / removing competitions, bringing a competition into an event |
| **November - mid December** | **Player pages and Find a player** (next), the **SuperAdmin overview**, **Share results as text**, **backgrounds** (general + per competition), **scoring by stage and typing a score in**, the **help guide** for admins, the privacy removal process |
| **Before Christmas** | All of it built, then **go live**: review and merge the branches, run the database parts on live, **copy the real competitions across from the test database** (see below), assign existing logins |
| **January - early February** | Additions and changes from Sam and the organisers |
| **About 14 February** | Feature freeze - bug fixes only from here |
| **About 20-27 February** | **Full dry run** with real Penwortham organisers and scorers, on the test database |
| **Sat 13 March 2027** | First competition |

Parked until Sam decides: the **privacy notice** (written, kept off the site for now -
`SHOW_PRIVACY` in lib/site.ts), **"Get in touch"** (needs an address), and the **new domain**.

The new domain is switched over whenever Sam has picked the name (the year-less addresses already
work).

**The real competitions stay (Sam, 2026-10-19)** - the competitions being set up on the test
database (Floodlit Singles, the March doubles, the Blackpool Masters, ...) are definitely happening,
so they are **copied across to the live database** at the switch rather than entered again: their
organisers, series, settings, sessions (dates, practice and start times), venues, sponsors and
logos, people and entries. Test scores and practice draws are not copied. Before the switch, Sam
says which competitions on test are real and which were only for trying things out.

### Version 1 (needed for 13 March) - built

- Competitions + the settings form (Super sets it up): single day, doubles, 32 entries, 21 up
- People + entries with **doubles pairs**, using the person search
- Roles: **Super, Admin, Scorer**, assigned per competition; admins create scorer logins
- Competition page (schedule, venue + directions, honours board) and the home page (live
  scores / Next up, calendar, competition list)
- Draw (in advance or on the day), **time slots** for round 1, and **changing people** (bye /
  replace)
- **Scoring with poor signal** (queued taps), **correcting results**, **postponements**
- **Doubles names in the narrow bracket view** and the **32-draw bracket layout on a phone**
- Done since: the **"Easy to read for every age"** pass. Text follows the phone's own text size
  (and any page can be zoomed), so the "Larger text" button was taken off (2026-10-21). The **privacy notice** is written but kept off the site for now; **"Get in
  touch"** waits for an address

## Order of work

Done (October 2026): Next.js 15 upgrade; test database; competitions + settings, people and
entries (singles and doubles), postponed nights; roles (Super / Admin / Scorer, assigned per
competition); draws and time slots; scoring with poor signal; correcting results; the home page,
calendar and competition pages with year-less addresses; sponsor logos; qualifying places and
qualifying competitions; the event page; County competitions; clubs and venues as one list; the
home page and menu redesign.

Still to do, in order:
1. **Player pages and Find a player**; honours boards filled with past winners
2. The **SuperAdmin overview**; **"Share results" as text**
3. **Scoring by stage, and typing a score in** (see above)
4. **Backgrounds** - a general one, and uploaded per competition
5. Help guide for club admins; privacy removal process
6. Go live: merge, live database, copy the real competitions across
7. New domain when the name is chosen; pilot with other clubs, then open up
8. After the pilot: shareable results images, sponsor reports, follow a player

Throughout: the "Easy to read for every age" rules apply to every screen.

