# Going live with the 2027 site - checklist

Everything is built on branches, each one starting from the last, so the newest branch
(`qualifying-events`) contains all of it. Its preview is
https://livescores-git-qualifying-events-sam-p25.vercel.app (test database).

The plan (Sam, 2026-10-22): everything built first, then tested over the winter on the test
database, then this switch - well before the first competition on Saturday 13 March 2027.

Pick a quiet day for the switch - nothing live, and nobody needing the admin side for an hour.

## 1. Get the test database ready to copy

- [ ] Say which competitions on test are **real** (Floodlit Singles, the March doubles, the
      Blackpool Masters, County Merit, ...) and which were only for trying things out. The
      practice ones are removed (Settings -> Remove this competition, or a script for any with
      entries).
- [ ] Clubs: every club has its address, postcode and (where needed) a Google Maps link; no club
      appears twice under slightly different names.
- [ ] Each real competition: settings, dates, practice and start times, where it's played,
      sponsors and logos, its background (if any), admins and scorers, entries already known,
      past winners on its honours board.
- [ ] Events (Blackpool Masters) and County: their competitions, qualifying places, posts and
      background.
- [ ] Settings -> Site background: the general photo chosen.

From here, **every competition on the test database is real** - they're what gets copied to live.

## 2. One full check on the preview

Tick each one on a phone (iPhone and Android) as well as a computer.

**Setting up (as Super)**
- [ ] Clubs: add a club with an address; Directions opens the right spot
- [ ] New competition: a club's, part of an event, and a county one (a venue per session)
- [ ] A competition's settings: rename it, move it ("Part of"), scoring for qualifying and Finals
      Day, background, sponsors with website and logo
- [ ] Past winners: add a year (singles and a doubles pair); it shows on the honours board and on
      both players' pages
- [ ] Events: bring in an existing competition; posts and adverts
- [ ] Users: add an admin to a competition; as that admin, add a scorer
- [ ] Overview: live now, what needs doing, the next fortnight, the latest changes

**Entries and the draw (as an admin)**
- [ ] Enter singles and pairs with the name search, including a second "John Smith"
- [ ] Correct a player's name; remove an entry
- [ ] A qualifying-sessions competition: entries go in their session, and can be moved
- [ ] Make a draw at random and one by recording numbers; publish it
- [ ] One-day competition: set start times; they show on the public draw

**On the day**
- [ ] Score live with the buttons, and with "Type the score"
- [ ] A results-only session: type a result
- [ ] Score in airplane mode, then reconnect - "All scores sent", public page updates
- [ ] Didn't turn up (and undo); Replace one partner of a pair
- [ ] Correct a finished result - same winner, and a different winner
- [ ] Postpone a session and undo it
- [ ] Share results from a session and from a competition (WhatsApp on a phone; copied on a
      computer)

**Public pages**
- [ ] Home: live scores (something live), Coming up and Latest results by month, the buttons,
      the event strip
- [ ] Menu: search (competition, club, event), Clubs, Find a player, County, Events
- [ ] A competition's page: schedule, venue, sponsors, honours board, qualifying list
- [ ] A session page: times, sponsors, the draw (list and bracket), venue
- [ ] Player pages: honours, every match, opponents link to their own pages
- [ ] Calendar: month and year pickers, every session in the month
- [ ] Backgrounds: the general one, and a competition's own
- [ ] October Singles 2026 pages still look right
- [ ] Text size follows the phone's setting (iPhone); pinch to zoom works
- [ ] A shared link (WhatsApp) shows "Bowls Live" and the North Lancs & Fylde description

Anything that needs changing gets fixed on the branch first.

## 3. The switch (Claude does the steps marked with C, Sam the rest)

- [ ] **Back up the live database** - Supabase (live) -> Database -> Backups, or download one
- [ ] C: write **Part 0** for live only (removes the old `clubs` and `competitions` tables and the
      empty `nights.competition_id` column left from the earlier attempt)
- [ ] In the **live** project's SQL Editor, run in order: **Part 0**, then every file in
      `supabase/migrations` from `2027_01` to `2027_17`, checking each says "Success"
- [ ] Make your live login Super (the same one-line update used on test)
- [ ] C: **copy the real competitions from test to live** - a script run on test produces the
      data, which is then run on live: clubs and their greens, events and the county,
      competition names, competitions and settings, sessions, sponsors, people and entries,
      past winners, qualifying places, posts, admins and scorers. Test scores and practice
      draws are left behind. (Kept out of the repository, as it holds people's names.)
- [ ] Pictures: sponsor logos, event images and backgrounds are stored on the test database -
      upload them again on live (or C copies them across)
- [ ] Settings -> Site background on live
- [ ] C: merge `qualifying-events` into `main` - Vercel deploys the live site
- [ ] Check the live site: home page, a competition, October Singles 2026, a player page, admin
      sign-in
- [ ] Users (live): assign existing logins (e.g. Wayne) to their competitions
- [ ] Vercel: Production still points at the live database, and has
      `SUPABASE_SERVICE_ROLE_KEY` (the Users page needs it)

## 4. After the switch

- The test database stays for trying things out and the February dry run
  (previews keep using it).
- Still to choose: the "Get in touch" contact, the privacy notice (written, hidden -
  `SHOW_PRIVACY` in lib/site.ts) and how juniors are shown, and the site's real name and domain.
