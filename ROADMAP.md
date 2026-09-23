# Roadmap

Planning notes only. **Nothing here gets built until Sam explicitly says to start it.**

## Context

Bowls Live currently runs a single one-off competition for Penwortham Sports & Social Club:
4 qualifying nights feeding a 16-slot Finals Day, all hardcoded. Sam wants to grow this into
something that can run multiple competitions a year, keep a multi-year archive, and potentially
host other clubs (rough estimate: 5-10 competitions/year by 2027).

## Agreed direction, in priority order

1. **Multi-year archive**
   Add a `competitions` table (name, year, status: **planned**/active/archived) and give
   `nights` a `competition_id`. A club can run more than one competition in the same year (e.g.
   Penwortham's 2027 plan already has two: "Floodlit Singles" and "October Singles"), so
   `year` is just a field on `competitions` for grouping, not a separate table.

   - **planned** - dates may or may not be set yet, no players/draw entered. Nothing to click
     through to.
   - **active** - the current one, works as the site does today (nights, players, live scores).
   - **archived** - past competition, results kept and viewable, nothing further changes.

   Home page shows the active competition's nights, much like today; a separate archive/upcoming
   view lists other competitions. Low-risk, no rewrite needed - do this first regardless of
   whether multi-club ever happens.

2. **Varying formats**
   Rather than build arbitrary tournament flexibility, make "how many qualifying nights, if
   any, feeding into what size finals" a property of the competition instead of the current
   hardcoded assumption. Bundle with #1.

   Both of Penwortham's known 2027 competitions ("Floodlit Singles" and "October Singles") use
   the exact same shape as today - 4 qualifying nights, 16 players, 4 qualifiers through to
   Finals Day - so no actual format variation is needed yet. This item stays speculative until a
   competition with a genuinely different shape comes along; don't build flexibility ahead of
   that real need.

3. **Multi-club support**
   Add a `clubs` table; competitions belong to a club. The branding that's currently hardcoded
   (Verve Wills logo, "Penwortham Sports & Social Club" text, the fireworks background photo)
   would need to become data-driven per club instead of baked into `components/Brand.tsx` /
   `app/globals.css` / `public/`. Home page navigation becomes: list of clubs -> click one ->
   that club's active competition's nights (today's home page, scoped per club).

4. **Role hierarchy for multi-club**
   SuperAdmin (Sam, everything, every club) > Admin (per club, full control of just that club)
   > Scorer (per club, same restricted scoring-only access already built for the single-club
   version). RLS would need a `club_id` claim in the JWT alongside the existing `role` claim,
   scoping every relevant table by club.

## Known bug to fix alongside #1

**The finals-night lookup assumes there's only ever one finals night in the whole database.**
Both `getFinalsRoster()` and `setFinalsNumber()` in `lib/adminActions.ts` (around lines 367 and
470) find "the" finals night the same way:

```ts
const { data: finalsNight } = await supabase
  .from("nights")
  .select("id")
  .eq("kind", "finals")
  .limit(1)
  .maybeSingle();
```

That's harmless today because there's only one competition, so only one `kind = "finals"` row
exists anywhere. Once Floodlit Singles and October Singles are both running (each with their own
Finals Day), this query has no way to tell them apart - it'll grab whichever finals night
happens to come back first, and could route a Floodlit Singles qualifier into the October
Singles bracket, or vice versa.

**Sketch of the fix** (to work out properly when #1 is actually built, not now): both functions
need a `competitionId` to scope that query - add `.eq("competition_id", competitionId)`
alongside `.eq("kind", "finals")`. The caller already knows which competition it's working
within in both cases:
- `getFinalsRoster()` is called from the admin night page's `refresh()`, which already has the
  current night loaded - use that night's `competition_id`.
- `setFinalsNumber(player, finalsNumber)` receives a `player` row that has a `night_id` - look up
  that night's `competition_id` first, or pass it in from the caller, which already has the
  night in scope.

## Navigation flow (agreed 2026-09-23)

For Penwortham today, but written generally since it needs to hold up once other clubs exist:

1. **Home page** - lists clubs, unless there's only one club in the system, in which case skip
   straight to that club's competitions - no point making Penwortham's visitors click through a
   list of one while they're the only club. Once a second club is added, the picker appears
   automatically.
2. **Pick a club** - shows that club's competitions grouped by year, e.g. Penwortham 2027 ->
   "Floodlit Singles" and "October Singles".
3. **Pick a competition** - shows its nights with dates, same as the current per-competition
   view.
4. **Click a night**:
   - If the competition is **active** and the night has real content (players/draw/results),
     this behaves exactly as it does today.
   - If the competition is still **planned**, clicking a night's date doesn't go anywhere
     meaningful yet - show a message instead (e.g. "Details for this night haven't been added
     yet") rather than a broken or empty page.
   - If a **planned** competition doesn't even have dates decided yet, the night list itself
     should say so plainly (e.g. "Dates to be confirmed") rather than showing blank/placeholder
     dates.

   Closer to the date, Sam adds players the same way he does now, and the night flips over to
   showing who's playing - no separate "reveal" step needed beyond what already exists.

5. **Status changes are admin-driven, not inferred.** `planned` -> `active` -> `archived` is a
   manual toggle the admin makes (like the existing "Publish draw" button), rather than the app
   guessing from whether players have been added or dates have passed.

## Open questions (not yet decided)

- **Migration path.** When this is actually built, the currently-live `nights` need a
  `competition_id` backfilled onto a real "October Singles 2026" competition record, and the
  branding baked into `components/Brand.tsx` / `app/globals.css` / `public/` needs to become
  Penwortham's club data - without breaking the site while that competition is still running.
- **Routing.** Today's URLs are flat (`/night/[id]`). Multi-club/multi-year implies nested
  routes (club -> competition -> night); existing shared links should ideally still deep-link
  straight to a night rather than forcing people back through the club-picker every time.

## Deliberate scope-limiting decisions

- **Admin/scorer accounts stay Sam-managed.** Even once there are multiple clubs, Sam creates
  every admin/scorer login himself via SQL (the same `raw_app_meta_data` update pattern already
  in use), just with a `club_id` added to the claim. This avoids needing a secure server-side
  (service-role) "let a club's own Admin create their own scorer" endpoint - the single hardest
  new piece of engineering in this roadmap. Only build that if/when it's actually needed.

- **Results-only vs. live scoring is already built** (Sept 2026, merged to `main`). Qualifying
  nights use simple final-score entry with no point-by-point history; Finals Day keeps full
  live scoring. This was derived directly from `night.kind` rather than a new database column -
  worth reusing that same pattern (derive from existing fields before adding new ones) when
  tackling #2 above.

## Future idea, not scoped yet: cross-club calendar

Once there's more than one club, a calendar showing all clubs' qualifying nights and Finals Days
together would help avoid double-booking (helpers/scorers/players who turn out at more than one
club clashing on the same date). Not needed while there's only one club - revisit if/when a
second club actually comes on board.

Prerequisite: `nights` currently has no real `date` column, just a free-text `name` (e.g.
"Tuesday 13th October") - this would need a structured date added first, naturally alongside the
#1 work. Also undecided: whether this is an admin-only planning tool or a public page, which
affects whether it needs any access control.

## A hard-learned caution for whoever picks this up

All git branches in this project share **one** Supabase database - branch isolation is
code-only, not data-only. Test data created on any branch (e.g. test nights while building the
`competitions`/`clubs` UI) is immediately visible on production if the production code queries
the same tables without filtering. When building #1/#3, do any hands-on testing of new
tables/rows with extra care, and clean up test data immediately rather than leaving it around.

(An earlier attempt at this work, on a branch called `2027-structure`, was reset back to `main`
after test nights leaked onto the live production site this way. That branch no longer exists -
this file is the actual planning record now.)

## How to apply

Don't start any of this unprompted. When Sam brings it up again, start with the
competitions/archive piece (#1) since it has a clear near-term payoff on its own. Treat
multi-club (#3-4) as a separate, later decision gated on real demand from another club - not
something to build speculatively ahead of that.
