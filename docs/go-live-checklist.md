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

**Full sessions**
- [ ] Try to enter a 17th into a session of 16 (new, moved and reinstated) and a 33rd into a
      one-day draw of 32 - each is refused with a message

**Who can change what** (after migration 2027_20)
- [ ] As a Penwortham admin: the Blackpool Masters isn't in your list, and its sessions,
      entries and draw can't be changed (open its session page - no admin buttons)
- [ ] As a scorer: scoring, Reopen and Didn't turn up all work; there's no way to change the
      draw, entries or settings, or to correct a finished result (scorers ask an admin)
- [ ] Signed out: a draw that isn't published yet doesn't show its pairings

**On the day**
- [ ] Score live with the buttons, and with "Type the score" - on an upright phone each name
      shows in full above its buttons
- [ ] As a scorer on Live: the shot that finishes a match - it stays on screen for about 30
      seconds, so Reopen can be tapped
- [ ] Once the draw is made, the matches come straight after the title; Postpone, the venue,
      start times and Clear the draw are under "Session settings" at the bottom
- [ ] A results-only session: type a result
- [ ] Score in airplane mode, then reconnect - "All scores sent", public page updates
- [ ] Didn't turn up (and undo); Replace one partner of a pair
- [ ] Correct a finished result - same winner, and a different winner
- [ ] Postpone a session and undo it
- [ ] Share results from a session and from a competition (WhatsApp on a phone; copied on a
      computer)

**Public pages**
- [ ] A competition page: sessions, qualifying list and wildcards, honours board, Share, then
      the venue at the bottom
- [ ] The Blackpool Masters page: "N days to go" in the title line, its days, the Qualifying
      card (next final, places decided), adverts and every news post
- [ ] Home: live scores (something live), the four buttons, Coming up and Latest results by
      month, Sign in at the bottom (and nowhere else but the menu)
- [ ] Menu: search (competition, club, event), Clubs, Find a player, County, Events
- [ ] A competition's page: schedule, venue, sponsors, honours board, qualifying list
- [ ] A session page: times, sponsors, the draw (list and bracket), venue
- [ ] Player pages: honours, every match, opponents link to their own pages
- [ ] Calendar: month and year pickers, every session in the month
- [ ] Backgrounds: the general one, and a competition's own
- [ ] October Singles 2026 pages still look right
- [ ] Text size follows the phone's setting (iPhone); pinch to zoom works
- [ ] A shared link (WhatsApp) shows "Crown Green Live" and the North Lancs & Fylde description

Anything that needs changing gets fixed on the branch first.

## 3. The switch - the test database becomes the live one

Nothing is copied. The test project already holds everything real - the 2027 competitions,
clubs, people, entries, logos and backgrounds, and the October Singles 2026 (copied from live
in October 2026) - so the live site is pointed at it, and the old live project is kept as a
backup. (Decided 2026-10-29: simpler and safer than copying, with no names to match up and no
pictures to upload again.)

Claude does the steps marked with C, Sam the rest.

**Before the day**
- [ ] Supabase plan: the test project must not pause once it's live (a paid plan, or kept in
      use). Rename it to `bowls-live` in its settings if you like - the public never sees it
- [ ] Check the October Singles 2026 matches on both: 80 players and 63 matches on each (C gives
      the one-line check)
- [ ] Logins: everyone who'll run or score in 2027 has a login on the test project (only
      Wayne and the organisers - test logins are removed on the Users page)
- [ ] Rehearse `supabase/scripts/go-live-tidy.sql` on test (it ends with rollback, so nothing
      changes) and check the list it shows
- [ ] The new address, `crowngreenlive.co.uk` (bought 2026-11-02): Vercel -> Settings ->
      Domains -> add `www.crowngreenlive.co.uk`, and `crowngreenlive.co.uk` redirecting to it.
      Add the DNS records Vercel shows at GoDaddy (the same steps as for `pssc-bowls.co.uk`).
      Until the switch it just shows the current site - that's fine, and gives the DNS time
      to settle

**On the day** (a quiet day - nothing live, nobody needing the admin side for an hour)
- [ ] Back up both projects - Supabase -> Database -> Backups (or download one)
- [ ] On test: run `go-live-tidy.sql` for real (last line `commit`) - clears practice draws,
      test scores and test change logs; keeps all the set-up and entries
- [ ] On test: Authentication -> URL Configuration - Site URL `https://www.crowngreenlive.co.uk`,
      and the same address in Redirect URLs (or password-reset emails open a preview)
- [ ] Vercel -> Settings -> Domains: set `www.pssc-bowls.co.uk` and `pssc-bowls.co.uk` to
      redirect to `www.crowngreenlive.co.uk`, so posters and old shared links still work
      (`pssc-bowls.co.uk/anything` opens the same page on the new address). Keep
      `pssc-bowls.co.uk` on auto-renew for a season or two
- [ ] Vercel -> Settings -> Environment Variables, **Production**: set
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
      to the test project's values (Project Settings -> API)
- [ ] C: merge `qualifying-events` into `main` - Vercel deploys the live site with the new
      values
- [ ] Check the live site: home page, a competition, October Singles 2026, a player page, a
      logo and a background, admin sign-in, a password reset email, and an old
      `pssc-bowls.co.uk` link opening on `crowngreenlive.co.uk`
- [ ] Going back, if something's badly wrong: put the old Production values back in Vercel and
      redeploy the previous deployment - the old live project is untouched

**Previews afterwards**
- [ ] Previews need their own database again. The old live project becomes it: C writes
      Part 0 (removes the old `clubs` and `competitions` tables and the empty
      `nights.competition_id` column from the earlier attempt), then run every file in
      `supabase/migrations` from `2027_01` to the newest on it, and set Vercel's **Preview**
      values to it. Create a Super login on it.

## 4. After the switch

- The old live project is the test database from now on (see above). Hold the February dry
  run on the test project **before** the switch, while it's still test.
- Still to choose: the "Get in touch" contact, the privacy notice (written, hidden -
  `SHOW_PRIVACY` in lib/site.ts) and how juniors are shown, and the site's real name (the
  domain is `crowngreenlive.co.uk`).
