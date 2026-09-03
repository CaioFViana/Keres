# Custom calendars

## 1. What this is, and what it is not

A story declares its own calendar — how long a year is, what the months are called, which eras it
counts from — and the app renders every date it already knows in that calendar instead of in the
Gregorian approximations it uses today.

It is **not** a new way to write time. Nobody types "they sailed for one moon". Durations continue
to be written the way they are written now: a number and a unit on a scene. The calendar is what
turns those durations into dates a reader of the app can situate.

Three things are deliberately out of scope, and §12 says why:

- Custom leap rules
- A month grid drawn in the story's own calendar
- Anything that makes a moon or a season an *input*

---

## 2. Two time systems, and which one this touches

Keres has two, they are independent, and only the smaller one is Gregorian.

| | System A — relative duration | System B — civil date |
| --- | --- | --- |
| Where | `scenes.gap/duration`, `chapterAnchors`, `storyTimelineLayout` | `AttributeType.DATE` only |
| Stored as | a number plus a unit (`seconds`…`eons`) | canonical `YYYY-MM-DD` string |
| Gregorian? | only in two constant tables | fully, via `Intl` |
| This feature | **rewrites both tables** | **does not touch it** (§10) |

System A runs the whole story and never produces a date. The Gregorian leakage in it is exactly two
literal tables:

- [`VISUAL_SECONDS_PER_UNIT`](../packages/shared/graphs/storyTimelineLayout.ts) — a month of 30.4375
  days, a year of 365.25
- the carry table in [`sceneTiming.ts`](../apps/client/src/utils/sceneTiming.ts) —
  `60/60/24/7/4/12/1000`, behind the per-story `normalizeSceneTiming` flag

Both are already commented in the source as deliberate approximations. Both are one place each.

System B is marginal: three consumer files, one 237-line utility, no native entity field of any kind
is a date, and the advanced search matches dates **by substring** rather than by comparison. There is
no date arithmetic anywhere in the app to port.

---

## 3. The claim that makes this cheap: a calendar is a formatter

**Nothing in Keres stores a date.** A scene stores `3, 'months'`. An anchor stores a scene, a
position, and an offset. The timeline stores pixels derived from those.

A calendar is therefore never storage. It is a function from a day number to a label, and back.

Three consequences, and they are the whole argument for the shape of this feature:

1. **Adding, editing or deleting a calendar cannot corrupt a story.** There is no stored value that
   becomes wrong. The same day is simply read differently. This is unusual for a feature this size
   and it is why the risk section (§14) is short.
2. **Several calendars cost nothing in the data model.** A second calendar is a second rendering of
   the same day number, not a second copy of the data.
3. **Moons and seasons are pure functions**, not entities with state — §8.

---

## 4. Storage

### 4.1 `storyCalendars`

One story-scoped entity, sibling to `worldRules` and `storySchemaFields`. It carries the whole
definition, and §4.2 argues for that.

```ts
export const storyCalendars = sqliteTable('story_calendars', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  /** The one the graphs use, and the one whose units durations are written in (§5). */
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  /** `CalendarDefinitionSchema` — months, weekdays, eras, moons, seasons (§4.2). */
  definition: text('definition').notNull(),
  extraNotes: text('extra_notes'),
  // ...the usual sync columns
});
```

### 4.2 Why one JSON column and not five child tables

Months, weekdays, eras, moons and seasons are all ordered lists belonging to one calendar. Modelled
relationally they would be five more entities inside the sync engine: five handlers on each side,
five operation-log entity types, five conflict stories, five sets of migrations.

They are also never edited independently. A writer opens a calendar, sets it up, and rarely returns.
Renaming the third month is not a change anyone needs merged separately from renaming the fourth.

So: one Zod schema in `packages/shared/schemas/CalendarSchemas.ts`, validated on write, stored as
text. Last-write-wins on the whole definition is the correct conflict behaviour for an object edited
as a unit — and it is what the sync engine already does for every other column.

The shape, kept small on purpose ("poucos detalhes, o app faz a matemática"):

```ts
{
  secondsPerMinute: number,          // defaults to 60/60/24 - a story that leaves them alone
  minutesPerHour: number,            // keeps the clock it already had
  hoursPerDay: number,
  daysPerWeek: number,
  weekdayNames: string[],            // length must equal daysPerWeek
  months: { name: string; days: number }[],
  eras: { name: string; abbreviation: string; startYear: number }[],
  moons: { name: string; periodDays: number; referenceDay: number }[],
  seasons: { name: string; startDayOfYear: number }[],
}
```

`daysPerYear` is derived by summing the months, never stored — a stored total that disagrees with
the months is a bug waiting to happen.

### 4.3 The epoch

One story-level column, not part of the calendar: `stories.timelineEpochDay`, an integer day number
that the story's **first scene** sits on.

It belongs to the story and not to the calendar because it is a fact about the narrative ("the story
opens on this day"), and it must stay the same when the reader switches which calendar they are
reading in. Each calendar then converts that one day number into its own date.

Absent means absent: with no epoch, dates simply do not appear anywhere (§6). That is the default and
it costs nothing to leave alone — the same principle as an unanchored chapter.

---

## 5. The primary calendar

Several calendars, exactly one primary. It does two jobs the others do not:

- **The graphs render dates in it.** Timeline labels, the agenda, anything with one axis.
- **It defines what the duration units mean.** `3, 'months'` is three of *its* months.

Secondary calendars are display conversions only: the same day, read by the dwarves. They appear on
detail screens as an extra line, never on a graph — two calendars on one axis is the conflation this
whole design avoids.

**Switching the primary does not migrate anything.** A scene that said "3 months" still says "3
months"; that is what the writer wrote and it stays true. What changes is how many days three months
spans, which is correct: they moved to a calendar where months are a different length.

Exactly one primary is enforced by the service, not by the database — SQLite cannot express "exactly
one true per story" without a partial unique index that also forbids zero, and a story mid-setup
legitimately has none.

---

## 6. What the epoch unlocks

With an epoch, every scene has an absolute day: walk the timeline's gaps and durations, which
`storyTimelineLayout` already does to produce pixels. The conversion is one function over a value it
already computes.

That single addition is where the feature stops being cosmetic:

- **The timeline labels rows with in-world dates** — "14 Harvest, 3019 T.A." beside each scene,
  instead of only relative gaps.
- **Anchors become readable as dates.** "300 years before the first scene" already resolves to a
  position; with an epoch it also resolves to a year.
- **The agenda exists at all** (§9).

Without an epoch every one of those degrades to what the app does today, which is why the epoch is
its own phase and everything downstream is gated on it.

---

## 7. Units and the carry table

The two Gregorian tables from §2 become functions of the primary calendar.

| Today | With a calendar |
| --- | --- |
| `carry('seconds', 'minutes', 60)` | `secondsPerMinute` |
| `carry('minutes', 'hours', 60)` | `minutesPerHour` |
| `carry('hours', 'days', 24)` | `hoursPerDay` |
| `carry('days', 'weeks', 7)` | `daysPerWeek` |
| `carry('weeks', 'months', 4)` | derived from the months' lengths |
| `carry('months', 'years', 12)` | `months.length` |
| `carry('years', 'millennia', 1000)` | unchanged — see below |
| `VISUAL_SECONDS_PER_UNIT.*` | derived from the whole chain |

**The sub-day units are in.** An earlier draft excluded them as three more parameters serving a case
nobody had asked for, and that was mispriced: the carry table is being parameterised in this phase
anyway, so the hour and the minute are three more lookups replacing three more literals. The cost is
in building the mechanism, and the mechanism is being built. A story that leaves them alone keeps
60/60/24, which is what the defaults are for.

One consequence worth stating: with a redefined second, `VISUAL_SECONDS_PER_UNIT` stops measuring
real seconds and starts measuring the story's own. Nothing breaks, because that table exists to give
bars *relative* widths within one story — everything on the axis is converted through the same chain,
so the drawing is identical and only the internal number changes.

**`millennia` and `eons` stay 1000 and 10⁹ years.** They are decimal magnitude words, not calendar
facts. A world in which a millennium is not a thousand years is a world that means something else by
the word, and it should rename the unit (below) rather than redefine the arithmetic.

The unit **names** come from the calendar too, so a story can call a week a *ciclo*. That is 18
translation keys (`scene_time_*`, nine units in two plural forms) becoming a lookup with the current
strings as the fallback.

**Plumbing cost, measured:** 24 call sites of the three formatters in `sceneTiming.ts` currently pass
a boolean and would pass a calendar; `buildStoryTimelineLayout` has 2 callers. Mechanical, wide, low
risk — and it is the bulk of the work in this feature.

---

## 8. Moons and seasons: derived, never stored, never inputs

This was the expensive half of an earlier draft and it stopped being expensive when it was scoped to
**read-only derived information**.

```ts
moonPhase(dayNumber, moon) = ((dayNumber - moon.referenceDay) mod moon.periodDays) / moon.periodDays
season(dayOfYear, seasons)  = the last season whose startDayOfYear <= dayOfYear
```

Two pure functions in `packages/shared`, tested without any UI. They need `dayOfYear`, which §6
already had to compute. Several moons are an array — the arithmetic does not care.

**They are never inputs.** No duration is ever written in moons, no gap is ever "one season". This is
the constraint that keeps them cheap, and breaking it later would turn them into a time system with
all the cost that implies.

Where they show: beside a date, wherever one is displayed — the agenda's cells, a scene's detail, the
date field's helper line. Informative and passive. A story that declares no moons and no seasons
never sees the word.

---

## 9. The agenda

A month of the story's calendar as a grid, with what happens in the story on it.

It is cheaper than the Gregorian [`DatePickerModal`](../apps/client/src/components/common/inputs/DatePickerInput/DatePickerModal.tsx)
it resembles, for one reason: that modal has to extract month lengths and weekday names from `Intl`,
and here the calendar definition simply states them. No `Intl` involvement at all.

Each cell carries the day number, the season and moon phase if declared, and a marker for every scene
or event landing on it — the last being a join on the absolute day from §6, not new arithmetic.

**Navigation is by content, not by time.** The screen opens on the month containing the first scene,
and the controls are "next scene" and "next event", not "next month". This is not a convenience: a
story spanning three thousand years has thirty-six thousand months, and paging through empty ones is
both useless and the only thing that would make this screen expensive. Navigating by content answers
the scale problem and gives the screen a purpose the grid alone does not have.

Gated on §6. With no epoch it has nothing to place, and it should say so rather than render an empty
calendar that looks broken.

---

## 10. What does not change: `AttributeType.DATE`

It stays Gregorian, and this is a decision rather than an omission.

Its values are canonical `YYYY-MM-DD` strings, validated by round-trip so that 30 February is
rejected, with the year clamped to 1–9999. A calendar of thirteen 28-day months breaks the regex and
invalidates every value already stored in every story.

It also has a legitimate use that a custom calendar would destroy: historical fiction dates things in
the real calendar, and should keep being able to.

So a story-calendar date is a **new attribute type** beside it, not a conversion of it. Stored as an
integer day number (which is what the whole feature is built on) rather than as a formatted string,
so it survives a calendar being edited afterwards.

Its input is composed of small controls rather than a grid: **era** and **month** as selects, year
and day as numbers, with the resolved date and its season and moon echoed back below.

The era select is what makes this work, and it is the same move a normal date picker makes when it
offers a decade before a year: a coarse jump that removes most of the typing before any fine control
is needed. Today's Gregorian
[`DatePickerModal`](../apps/client/src/components/common/inputs/DatePickerInput/DatePickerModal.tsx)
has no such control — it navigates months with arrows and takes the year as a free numeric field,
which is exactly the part that would age badly at "year 3019 of the Third Age".

What is still excluded is the **month grid**: drawing the story's own month, day by day, with its own
week length. That is the expensive half of a picker, its value is convenience, and the agenda (§9)
already draws that grid for the one purpose that justifies it — browsing, not entry.

---

## 11. Where it appears

- **The world-bible area**, beside World Rules and Story Schema. No new drawer entry is needed and
  one would be weight without use — a calendar is set up once and consulted, not worked in daily.
- **The timeline** gains date labels on its rows (§6), from the primary calendar.
- **Scene and chapter detail** gain a date line where a duration line already exists.
- **The agenda**, its own screen inside the world-bible stack (§9).
- **Packs.** A calendar is small, self-contained and reusable across stories, which is exactly what
  the pack system carries. This costs nothing if the entity is designed for it now, and costs a
  migration if it is not.

---

## 12. What is deliberately excluded

| Excluded | Why |
| --- | --- |
| Custom leap rules | Invented calendars are almost always integer-length years by design, which keeps every conversion in this plan integer arithmetic. A fractional year drifts `dayOfYear` and pulls a correction rule into every one of them. |
| A month grid in the date input | 440 lines of `DatePickerModal` rewritten without `Intl`, to save typing that §10's era and month selects already remove. |
| Moons or seasons as inputs | §8. It is the constraint that keeps them nearly free. |
| A second calendar on a graph axis | §5. |

Sub-day units **were** on this list and came off it — see §7. The reasoning that put them here was
that they were three more parameters for a case nobody had asked for, and it ignored that the carry
table is being parameterised in the same phase regardless. That is the shape of mistake worth
watching for in the rest of this list: an exclusion is only honest while the mechanism it avoids is
genuinely not being built anyway.

Leap rules and the month grid survive that test. They are also the parts of "custom calendars" that
worldbuilding tools ship and that fantasy *novels* almost never use — the audience for them is
campaign management, which is not what this app is. They stay possible later without rework, since §3
means nothing stored has to change.

---

## 13. Phases

| Phase | Scope | Ends with |
| --- | --- | --- |
| **1** (**done**) | `storyCalendars`: table, `CalendarDefinitionSchema`, both sync handlers, service, export format V8, the list and form screens in the world-bible area, the primary flag | A calendar can be described and syncs |
| **2** (**done**) | The unit ratios and names sourced from the primary calendar: `sceneTiming` carries, `VISUAL_SECONDS_PER_UNIT`, the 24 formatter call sites, the unit-name lookup | The app's arithmetic stops being Gregorian |
| **3** (**done**) | `stories.timelineEpochDay`, the day↔date conversion in `packages/shared`, date labels on the timeline rows and on scene/chapter detail | Dates exist |
| **4** (**done**) | `moonPhase` and `season`, and their display beside every date | The passive information layer |
| **5** (**done**) | The new date attribute type (§10), stored as a day number, with the era/month selects and the resolved echo | A story can date its own entities |
| **6** (**done**) | The agenda screen, navigating by content | The calendar is browsable |

Phases 4, 5 and 6 are independently cuttable. Phase 3 is the hinge — 4 and 6 are meaningless without
it, and 1–2 are worth shipping even if everything after is dropped.

**All six shipped.** Two things came out differently from the plan and are worth naming:

- `buildStoryTimelineLayout` was converted from four positional arguments to an options object
  before the calendar became the fifth. Its call sites had become a row of unlabelled literals.
- The calendars are reached from **Story settings**, which gained a stack to hold them. It was a
  flat `Drawer.Screen`, and a flat screen that navigates elsewhere leaves the header with no back
  arrow — the same defect the pack screens had.

---

## 14. Risks

Short, and §3 is why.

1. **The plumbing in Phase 2 is wide.** 24 call sites plus two graph builders, all threading a
   calendar where a boolean used to go. Nothing subtle, but it touches a lot of screens, and a missed
   call site silently keeps rendering Gregorian totals.
2. **Exactly one primary is a service invariant, not a database one** (§5). Two primaries after a
   merge is the plausible failure; the reader should pick deterministically rather than throw.
3. **The epoch walk depends on the timeline's arithmetic being right.** Phase 3 converts positions
   that `storyTimelineLayout` computes; an error there stops being a slightly wrong bar width and
   starts being a wrong date on every row.
4. **A calendar edited after dates were entered** (Phase 5). Storing day numbers rather than strings
   is what contains this — the day does not move, only its label does — but a writer who renames
   months after dating fifty characters will see fifty labels change, and should be told that before
   they save.

The risk that is **absent** is worth naming: there is no data-corruption path. No stored value in any
existing story becomes invalid at any point in this plan.

---

## 15. Deferred

- The six bundled example stories declare no calendar. Little Mermaid and Princess Kaguya both have
  material for one — Kaguya's is explicitly lunar, which would demonstrate §8 without inventing
  anything. Content work, the same class as the events entry in `events_feature_plan.md` §14.
- A shipped calendar pack, once §11's pack support exists.

---

## 16. Calendar-change review and anchor inspection (shipped 2026-08-30)

Calendar definitions interpret the story's relative timeline; they do not own or migrate it.
Consequently, editing a saved definition now opens a required review before persistence. The review
lists the story opening and every Chapter/Event anchor, with its current reading and its reading
after the proposed definition. Confirming saves only the definition: it never rewrites an epoch,
gap, duration or anchor.

Each custom calendar also exposes **View anchors**. Its read-only sheet shows those same facts as
that calendar currently reads them and opens the reference Scene through normal entity navigation.
When the story opening has not been set, an anchor is listed but intentionally has no invented date.

This is deliberately not a calendar migration system. Different calendars cannot preserve both an
authored label and the underlying elapsed story time after a structural change. Keres preserves the
relative time and makes the changed interpretation visible before the author accepts it.
