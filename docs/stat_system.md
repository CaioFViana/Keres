# The stat system in Keres

An optional system, turned on per story, for measuring characters on axes created by the author and
comparing them on a radar chart. This document describes the data model, the ladder maths and
the rules that do not fit in a database constraint.

## 1. Turning it on and off

`Story` has two fields:

- **`statSystem: boolean`** (default `false`) - turns the feature on in that story. Off, the
  "Stats" item disappears from the side menu and the panel disappears from the character's detail;
  **nothing is deleted**, and turning it back on gives everything back.
- **`statNotation: 'letter' | 'number'`** (default `'letter'`) - how the values are displayed. With
  letters the tier's label appears (`F`, `C`, `SS`); with numbers, the value itself.

Both are edited in Story Settings and synchronize along with the rest of the `Story`.

## 2. The four entities

| Entity | What it is | Own fields |
|---|---|---|
| `Stat` | A measurable axis | `name`, `isPrimary`, `order` |
| `StatStrength` | A tier of the value ladder | `statId` (nullable), `label`, `minValue` |
| `StatRelation` | A stat's value for a character | `characterId`, `modeId` (nullable), `statId`, `value` |
| `Mode` | An alternative form of a character | `characterId`, `name`, `modeChanges`, `order` |

**Primary vs. secondary.** Only the primary ones become a radar axis, and that is why there are at most **12**
(`MAX_PRIMARY_STATS`); beyond that the drawing becomes illegible. Secondary ones have no limit: they appear
only as a text list. The chart needs at least **3** primary ones
(`MIN_PRIMARY_STATS_FOR_CHART`) - below that the polygon degenerates into a line, and the screen shows an
invitation to register more in place of the drawing.

**Modes.** They exist even with the system off: describing what changes in a transformation is useful
in itself. `Mode` enters the global search by name; since it has no screen of its own, the result carries the
**owning character's id** and opening it leads to that character's detail (see `ENTITY_ROUTES.Mode` in
`apps/client/src/utils/entityNavigation.ts`).

## 3. The tier ladder

Each tier stores only its own floor; its interval is `[minValue, the next one's floor[`. The whole
ladder comes from sorting the tiers by `minValue`, and the ladder always opens at zero - when the lowest
tier starts above 0, `sortLadder` inserts an implicit tier (with no id, labelled `—`) so that
no value falls outside every interval.

**Per stat, with a story default.** A null `StatStrength.statId` is the default ladder, used by every
stat that does not have one of its own. Filled in, it is that stat's override. That way "dexterity goes from 0
to 100" and "strength goes from F to S" coexist in the same story without requiring 12 registrations.

**Numeric notation.** It uses the same table: the screen offers a generator (`from 0 to 100 in steps of 10`) that
writes the rows, and the label is the number itself. A single rendering and synchronization path for
both notations.

### From the value to the radius

With floors `c0=0 < c1 < … < cn`, ring *k* sits at radius `k/n`, and a value in `[ck, ck+1[` sits at
`(k + fraction)/n`. It is the example from the original request: with F at 0, C at 50 and A at 400, the value 100 is
inside C, a third of the way to A.

**Overflow.** The last tier has no top. Above `cn` the drawing enters a reserved band of
20% of the radius (`OVERSHOOT_RATIO`): a whole tier beyond the top - measured by the width of the last
closed interval - fills the whole band, and from there upwards it clamps to the edge. The outer ring of that
band is dashed, which is what makes "above the scale" visible without rescaling the whole chart because
of one character.

### The tier bar

The value field is a bare number: on its own, it does not say that 100 is "C" on this ladder nor how much
is left to the next tier. That is why the character's form draws, under each field, a
bar with one band per tier, a mark at each floor and the value's point - which follows what is
being typed, before it is even saved. The same component appears on the ladder screen, as a
preview of what is being assembled.

Beside the field there is a **badge with the label of the tier** the number fell into, updated as you
type. The bar says *where* the value is; the badge says *what it is called* - which is precisely
what a ladder of arbitrary floors (F at 0, C at 50, A at 400) hides. It applies to both notations,
since in the numeric one the label is the tier's floor. Above the last tier the badge shows `A+`, the same
overflow the dashed band draws (`formatTierLabel` in `statLadder.ts`).

**One card per stat from medium up.** On a narrow screen, the name, field and bar stacked
are enough. On a wide screen the same arrangement leaves the numeric field at half the width and the
bar needlessly stretched, so from `medium` up each stat becomes a card in a
`ResponsiveGrid` (two columns at medium, three at wide) with the field at a fixed width. The
grouping also makes it clear which stat each bar belongs to.

The bar's axis is **numeric**, and not one tier per equal slice as on the radar. They are
different questions: the radar compares characters across axes, so each ring is a tier; the bar shows
the ladder's shape, so F at 0, C at 50 and A at 400 appears as a narrow band followed by
a huge one, which is the truth about those numbers. The dashed band at the end is the same 20%
overflow as the radar's.

Labels that do not fit are omitted, always preserving the two at the ends. The calculation respects the
alignment each one is drawn with (the first goes from the mark to the right, the last to the
left) - assuming all of them centred made "90" and "100" come out glued together on a numeric ladder.

## 4. Mode inheritance

A mode that does **not** have a row of its own for a stat reads the normal mode's value, marked as
inherited in the interface. Writing a value in a mode is precisely the act of no longer inheriting; clearing
the field deletes the row and gives the inheritance back. The rule lives in a single place,
`apps/client/src/utils/statValues.ts`, consumed by the panel, the comparison and the ranking.

Deleting a mode also deletes the values registered only for it: without the mode, a `StatRelation` with
that `modeId` would be orphaned and the server would refuse any later edit to it.

## 5. Invariants and conflicts

`stat_id` and `mode_id` are nullable, and in Postgres NULLs are distinct from one another - a unique index
would let through precisely the collisions of the default ladder and the normal mode. What guarantees them are
the API's synchronization handlers, which raise `SyncConflictError` and let the client open the
resolution screen:

- **`StatStrength`**: two tiers with the same floor on the same ladder. One of their intervals would have
  zero width and no value would fall into it.
- **`StatRelation`**: two values for the same `(character, mode, stat)`. Reading would come
  to depend on the rows' order.
- **`Stat`**: the 13th primary. The ceiling is a data invariant, not just a screen one: an old client cannot
  push it through synchronization.
- **FKs**: a non-existent stat, character or mode, and a mode that does not belong to the character.

The client repeats the first two checks before writing, so they become an immediate form error
instead of an opaque sync conflict hours later.

## 6. Where everything is

- **Pure maths** (no React, no database): `packages/shared/graphs/statLadder.ts` (the ladder),
  `statRadarLayout.ts` (the geometry), `statRadarSvg.ts` (the exported file) and
  `statLadderBarLayout.ts` (the tier bar), plus `apps/client/src/utils/statValues.ts`
  (inheritance) and `statRanking.ts` (the tier list). The same discipline as the app's graph layouts: the
  interactive screen and the exported SVG consume the same geometry and never disagree - and because they are
  shared, the site's showcase draws exactly the same charts.
- **Screens**: `apps/client/src/screens/stats/` - list, form, ladder, comparison and ranking,
  all under the "Stats" entry of the story menu (`navigation/StatsStack.tsx`).
- **On the character**: the panel on the detail (`components/features/stats/CharacterStatPanel`), and on the
  form the modes (`ModeManager`) and the values (`CharacterStatValuesEditor`) - the detail only
  displays, it never edits.
- **Export format**: the four collections entered in **V5** (`CURRENT_STORY_FORMAT_VERSION`);
  the `V4 -> V5` migration materialises empty lists and leaves `statSystem` off, so old
  packages remain importable without turning the feature on by themselves.
