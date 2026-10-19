# Going live with the 2027 site - checklist

Everything is built on branches, each one starting from the last, so the final branch
(`privacy-readability`) contains all of it. Its preview is
https://livescores-git-privacy-readability-sam-p25.vercel.app (test database).

Pick a quiet day for the switch - nothing live, and nobody needing the admin side for an hour.

## 1. Clear the test database and re-add the real competitions

- [ ] In the **test** project's SQL Editor, run step 1 of
      `supabase/scripts/clear-test-competitions.sql` (shows what will go), then step 2.
      The October Singles 2026 stays; every other competition goes.
- [ ] In Supabase (test) -> Storage -> `sponsor-logos`, delete the old logo files.
- [ ] Re-add the real competitions (Floodlit Singles, the March doubles, the Blackpool Masters,
      ...) on the preview: settings, dates, practice and start times, venues (Venues page first),
      sponsors and logos, admins and scorers, and any entries already known.

From here, **every competition on the test database is real** - they're what gets copied to live.

## 2. One full check on the preview

Tick each one on a phone as well as a computer.

**Setting up (as Super)**
- [ ] Add a venue with a Google Maps link; Directions opens the right spot
- [ ] A competition's settings: format, dates, practice on/off, start times, venue, sponsors with
      website and logo
- [ ] Users: add an admin to a competition; as that admin, add a scorer

**Entries and the draw (as an admin)**
- [ ] Enter singles and pairs with the name search, including a second "John Smith"
- [ ] Correct a player's name; remove an entry
- [ ] A qualifying-sessions competition: entries go in their session, and can be moved
- [ ] Make a draw at random and one by recording numbers; Confirm and publish
- [ ] One-day competition: set start times; they show on the public draw

**On the day**
- [ ] Score in airplane mode, then reconnect - "All scores sent", public page updates
- [ ] Didn't turn up (and undo); Replace one partner of a pair
- [ ] Correct a finished result - same winner, and a different winner
- [ ] Postpone a session and undo it

**Public pages**
- [ ] Home: Next up (nothing live) and Live scores (something live), calendar, list, filters
- [ ] A competition's page: schedule, venue, sponsors, honours board
- [ ] A session page: times, sponsors, venue, back link to the competition
- [ ] October Singles 2026 pages look as they did
- [ ] Privacy page; Larger text stays on after closing and reopening
- [ ] A shared link (WhatsApp) shows "Bowls Live"

Anything that needs changing gets fixed on the branch first.

## 3. The switch (Claude does the steps marked with C, Sam the rest)

- [ ] **Back up the live database** - Supabase (live) -> Database -> Backups, or download one
- [ ] C: write **Part 0** for live only (removes the old `clubs` and `competitions` tables and the
      empty `nights.competition_id` column left from the earlier attempt)
- [ ] In the **live** project's SQL Editor, run in order: **Part 0**, then **Parts 1 to 10**
      (`supabase/migrations/2027_01` ... `2027_10`), checking each says "Success"
- [ ] Make your live login Super (the same one-line update used on test)
- [ ] C: **copy the real competitions from test to live** - a script run on test produces the
      data, which is then run on live: organisers, competition names, competitions and settings,
      sessions, venues, sponsors, people and entries, admins and scorers. Test scores and practice
      draws are left behind. (Kept out of the repository, as it holds people's names.)
- [ ] Re-upload sponsor logos on live (the copied ones point at the test database's storage)
- [ ] C: merge `privacy-readability` into `main` - Vercel deploys the live site
- [ ] Check the live site: home page, a competition, October Singles 2026, admin sign-in
- [ ] Users (live): assign existing logins (e.g. Wayne) to their competitions
- [ ] Vercel: Production still points at the live database, and has
      `SUPABASE_SERVICE_ROLE_KEY` (the Users page needs it)

## 4. After the switch

- The test database stays for trying things out and the February dry run
  (previews keep using it).
- Still to choose: the "Get in touch" contact, the junior rule wording, the site's real name and
  domain, and the general background photo.
