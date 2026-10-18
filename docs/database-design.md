# Database design - 2027 multi-competition site

**Status: agreed with Sam 2026-10-18 (see "Decisions" at the end). Nothing here has been built
or run yet.**
Roadmap step 2 ("Competitions + settings, people and entries, qualifying places, venues and
postponed nights - one database change"). Everything is applied to the **test** database
first, checked on a preview, and only then run on the live one.

---

## The short version

Today the database knows about **nights**, **players** (a name typed in for one night),
**matches** and the score history. That's enough for one competition. For 2027 it needs to know:

1. **Who runs it** - a club or an event (Penwortham, Blackpool Masters). Behind the scenes only.
2. **Which competition** - "October Singles", "Spring Doubles", repeated every year.
3. **Each year's edition** - "October Singles 2027", with its settings (format, singles or
   doubles, draw size, 21/31 up...), locked once the draw is made.
4. **Its sessions** - the qualifying nights and the Finals Day, or the single day - each with a
   date, start time, venue and a "postponed" status. (This is today's `nights` table, extended.)
5. **People** - each real person once, found by the name search, reused year after year.
6. **Entries** - a person (singles) or two people (doubles) entered into one competition.
7. **Where each entry sits in a session's draw** - their draw number, bye, and so on. (This is
   today's `players` table, now pointing at an entry instead of holding a typed name.)
8. **Who can run or score which competition** - Super (Sam), Admin, Scorer, assigned per
   competition.
9. **A log of changes** - replacements, corrected results, draws made, wildcards - who and when.

Plus, for later in 2027: **qualifying places** (Blackpool Masters), **honours from before the
site**, and **venues** shared between competitions.

**Matches, the bracket logic and live scoring stay as they are** - they're proven, and keeping
them reduces risk before 13 March. They just gain a start time and a "finished at" time.

```
organisers ─┬─ series ─── competitions ─┬─ nights (sessions) ─┬─ players (places in a draw) ── matches ── match_events
            │  (October    (October      │                     │        │
            │   Singles)    Singles 2027)├─ entries ───────────┼────────┘
            │                            │    └─ people (1 or 2)
            │                            ├─ assignments (admins, scorers)
            │                            └─ qualifying_places (later)
            └─ venues                    honours_history (titles from before the site)
audit_log (every important change)       viewer_pings (unchanged)
```

---

## Tables

Notation: **new** = new table; **changed** = existing table gains columns; *unchanged*.

### `organisers` - new
Who runs competitions. Behind the scenes only (no public club pages).

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | "Penwortham Sports & Social Club", "Blackpool Masters" |
| short_name | text | "Penwortham" - shown as "Run by Penwortham" |
| kind | text | `club` or `event` |
| background_image | text | optional per-organiser photo (today's fireworks photo for Penwortham) |
| created_at | timestamptz | |

### `series` - new
A competition that repeats each year. This is what gives the **year-less address**
(`/october-singles` always opens the latest year) and holds the **honours board**.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| organiser_id | uuid → organisers | |
| name | text | "October Singles" |
| slug | text, unique | `october-singles` - the year-less address |
| created_at | timestamptz | |

### `competitions` - new
One year's edition of a series, with its settings. **Super (Sam) sets these up**; admins can't
change the structure.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| series_id | uuid → series | |
| year | int | 2027. Address `/october-singles-2027`; unique per series |
| status | text | `planned` / `active` / `archived` - a manual toggle |
| format | text | `qualifying_and_finals` / `single_day` / `final_only` |
| team_size | int | 1 = singles, 2 = doubles |
| entry_method | text | `open` / `qualification` / `on_the_night` |
| label | text, optional | e.g. "Ladies" - a pill and a filter |
| target_score | int | 21 or 31 (copied onto each match, as today) |
| scoring_style | text | `live` (point by point) or `results` (enter the final score) |
| draw_size | int | Finals Day / single day draw: 4, 16, 32... |
| qualifying_nights | int, optional | e.g. 4 (qualifying format only) |
| entries_per_night | int, optional | e.g. 16 |
| qualifiers_per_night | int, optional | e.g. 4 |
| draw_method | text | `in_advance` / `on_the_day` |
| structure_locked | boolean | set when the first draw is made; settings form then read-only |
| sponsor_name, sponsor_url | text, optional | per competition (Verve Wills for October Singles) |
| venue_id | uuid → venues, optional | the default venue for its sessions |
| colour | text, optional | calendar colour; auto-assigned if empty |
| created_at | timestamptz | |

The settings form checks the numbers add up (e.g. `qualifying_nights × qualifiers_per_night`
must fit `draw_size`) before saving.

### `venues` - new

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | "Penwortham Sports & Social Club" |
| address | text | |
| postcode | text | used for the "Get directions" link |
| notes | text, optional | "Parking on site. Bar open, seating available" |

### `nights` (sessions) - changed
Today's table, kept and extended - it's what the night pages, viewer log and realtime already
use. In 2027 a "night" means any **session**: a qualifying night, a Finals Day or a single day.
(The public pages say "Qualifying night 2", "Finals Day" or the day's name; the table name is
internal.)

| New column | Type | Notes |
|---|---|---|
| competition_id | uuid → competitions | which competition it belongs to |
| session_number | int | 1, 2, 3, 4... order within the competition (replaces `sort_order` for this) |
| date | date | |
| start_time | time | e.g. 19:00 |
| venue_id | uuid → venues, optional | if different from the competition's (e.g. Finals Day elsewhere) |
| postponed | boolean | **Rain-offs** |
| postponed_reason | text, optional | "Rained off" |
| original_date | date, optional | kept when moved, so the calendar can show "moved from…" |

`kind` gains `single_day` and `final` alongside `qualifier` and `finals`. `name` becomes
optional (generated from the date and kind when empty). `draw_published` stays.

### `people` - new
Each real person once. Found by the name search; never typed twice.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| full_name | text | "Wayne Ditchfield" |
| note | text, optional | tells same-named people apart: "Snr", "Jnr", "John A. Smith" |
| club_id | uuid → organisers, optional | their club - shown in search results |
| hidden | boolean | **privacy**: name removed on request; results show "Withdrawn player" |
| merged_into_id | uuid → people, optional | set when two records are merged; the old one points to the kept one |
| created_at | timestamptz | |

"Last played" in the search results is worked out from their entries, not stored.

### `entries` - new
A person (singles) or a pair (doubles) entered into one competition.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| competition_id | uuid → competitions | |
| person_id | uuid → people | |
| partner_id | uuid → people, optional | doubles partner; must be empty for singles |
| status | text | `entered` / `withdrawn` |
| created_at | timestamptz | |

A person can only be entered once per competition (as player or partner). Results on player
pages come from here, so both doubles partners get the result.

### `players` (places in a draw) - changed
Today each row is a typed name on one night. In 2027 each row is **an entry's place in one
session's draw** - the same job the bracket, drag-ordering, finals numbers and byes already use,
so that logic keeps working. Matches keep pointing here, exactly as now.

| Change | Notes |
|---|---|
| + entry_id → entries | who this place belongs to |
| `name` | filled in and kept up to date by the database from the entry's people (part 5) - "A & B" for a pair, with a club or note only where two people in the competition share a name. Kept on the row so the live pages, which are sent single rows, always have it |
| `seed`, `sort_order`, `is_bye`, `finals_number`, `qualified_from_player_id` | unchanged - draw number, round-1 order, bye, finals number, link from qualifying night to Finals Day |

**Replacing someone** (Draws: "Replace with someone else") points the place at a new entry -
same draw number, same opponent - and logs it. Locked once that match is finished.

### `matches` - changed (small)

| New column | Type | Notes |
|---|---|---|
| start_at | timestamptz, optional | from the session's **time slots**, or set by hand |
| completed_at | timestamptz, optional | when it finished - keeps the right date if the night is later moved (part-played rain-offs) |

Everything else unchanged.

### `time_slots` - new
Round-1 start times by draw number, for a session.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| night_id | uuid → nights | |
| from_number, to_number | int | e.g. 1-8 |
| start_time | time | e.g. 10:00 |

When the draw is made, each round-1 match's `start_at` is filled from these; a single match can
then be changed by hand. Later rounds stay empty ("Time to follow").

### `assignments` - new
Who can run or score which competition.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid → logins | a Supabase login |
| competition_id | uuid → competitions | |
| role | text | `admin` or `scorer` |
| created_by | uuid | who gave it |

**Super** isn't an assignment - it's a mark on Sam's login itself (`role: super`), so it covers
every competition, including new ones. An admin can add **scorer** assignments (and create
scorer logins) for their own competitions only.

### `audit_log` - new
A record of every important change, so there's never an argument later.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| at | timestamptz | |
| user_id | uuid | who did it |
| competition_id | uuid, optional | |
| action | text | `draw_made`, `draw_published`, `replaced`, `bye`, `result_corrected`, `postponed`, `wildcard_set`, `people_merged`, `people_split`... |
| details | json | e.g. old and new result; who was replaced by whom |

Readable by Super, and by admins for their own competitions.

### `match_events`, `viewer_pings` - *unchanged*
Score history and the viewer log keep working as they are (both hang off `nights`).

---

## Later in 2027 (designed now, built after 13 March)

### `qualifying_places` - new (Blackpool Masters)

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| competition_id | uuid → competitions | the Invitation 32 |
| place_number | int | 1-32 |
| source | text | `winner_of` / `runner_up_of` / `typed_in` / `wildcard` |
| source_competition_id | uuid, optional | the qualifying competition, if on the site |
| source_label | text | shown until filled: "Winner - October Singles 2027 (Penwortham)" |
| entry_id | uuid → entries, optional | filled automatically, or by the admin |
| original_source_label | text, optional | kept when a place is changed to a wildcard |
| flagged | text, optional | e.g. "Already qualified via the October Singles" |

### `honours_history` - new
Titles from **before the site existed**, added by hand.

| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| series_id | uuid → series | |
| year | int | |
| winner_person_id / runner_up_person_id | uuid → people, optional | |
| winner_text / runner_up_text | text, optional | if the person isn't on the site |

The honours board on a competition page = these rows + the champions of finished competitions
in the same series (worked out, not stored twice).

---

## Who can do what (security rules)

The database checks every change itself, as it does today:

| | Public | Scorer | Admin | Super |
|---|---|---|---|---|
| See published competitions, draws, scores | ✓ | ✓ | ✓ | ✓ |
| Score live matches | | own competitions | own competitions | all |
| Players, draws, byes, replacements, time slots, postponing, correcting results | | | own competitions | all |
| Create scorer logins / assignments | | | own competitions | all |
| Set up competitions and their structure; organisers, series, venues | | | | ✓ |
| Read the audit log | | | own competitions | all |
| Read the viewer log | | | own competitions | all |

"Own competitions" = the competition is in their `assignments`. A draw isn't public until
`draw_published`, as today. Planned competitions with no details show only their name.

---

## Moving the October Singles 2026 into the new design

Done as one script, on the test database first:

1. Create organiser **Penwortham** (club), series **October Singles** (`october-singles`), and
   competition **October Singles 2026** - archived, qualifying + finals, singles, 4 nights of
   16, 4 through, draw 16, 21 up, Verve Wills as sponsor - plus the venue.
2. Point the five existing nights at it, with their dates and session numbers.
3. Create one **person** per distinct player name (64 qualifying players). Names are checked by
   eye first in case of spelling differences.
4. Create one **entry** per person, and point each existing `players` row at it - the 16
   Finals Day rows point at the same entries as the qualifying rows they came from.
5. Sam's login becomes **Super**. Existing scorer logins are **not carried over** - 2027 starts
   fresh, and admins create new scorer logins per competition. (The old ones can be removed from
   the Users page once the move is done.)

Matches, scores, score history and the viewer log don't move - they already hang off the nights
and player rows. Old `/night/...` links keep working.

**Rehearsed on the test database 2026-10-18** - Part 1 (`supabase/migrations/2027_01_…`) and
Part 2 (`2027_02_…`) ran cleanly on a copy of the real 2026 data: 5 nights linked with dates, 64
people and 64 entries, every player row pointing at an entry, Sam's test login Super.

**Before running on live - leftovers from the earlier attempt.** The live database still has a
`clubs` table ("Penwortham Sports"), a `competitions` table in an older shape with one row -
**"Floodlit 2027"**, active, qualifiers, 4 through, 16 finals draw, sponsor **Neal Buckley
Funerals & Penwortham Limousines** - and an empty `nights.competition_id` column. Part 1 would fail
on live because of them. **Floodlit 2027 is real** (Sam, 2026-10-18), so on live only: run a
small "Part 0" that drops the old `clubs` and `competitions` tables and the empty
`nights.competition_id` column, then Parts 1 and 2, then recreate Floodlit 2027 in the new
structure (Penwortham -> Floodlit Singles -> 2027, sponsor Neal Buckley Funerals & Penwortham
Limousines) through the new set-up screens. The test database never had them.

---

## Decisions (Sam, 2026-10-18)

1. **Keep the internal names** `nights` and `players` for version 1 - less change to the proven
   bracket and scoring code before 13 March. (They can be renamed later if wanted; the public
   pages never show them.)
2. **Pairs only** - an entry is one person (singles) or two (doubles), never more, so
   `entries.partner_id` is enough; no separate members table.
3. **A person's club is optional** - quicker to add someone on the night. The "same person?"
   check and the optional note still handle same-named people.
4. **Scorers start fresh in 2027** - existing scorer logins aren't carried over (see Migration
   step 5).
5. **Past October Singles winners** - Sam has a list and will add it later through
   `honours_history`; the move doesn't need it.
