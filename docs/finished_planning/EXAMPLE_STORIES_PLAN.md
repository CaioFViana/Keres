# Plan: example stories as a complete showcase of the system

## Goal

Every story packaged in `apps/client/src/exampleStories/content/<slug>/{en,pt}.json` should
exercise **everything** the export format carries and that the story's type allows.
Installing an example has to be enough for the person to open any screen, any chart and
any SVG export and see something full and coherent — not an empty screen saying "no items".

Today that does not happen: no example has stats, modes, more than one chapter, or a character's
presence in more than two scenes. Half of the app's visual products open practically empty.

## Current state

Counts per collection (the `en` language; `pt` is parallel):

| Collection | alice | beauty | cinder | goldi | mermaid | kaguya |
|---|---:|---:|---:|---:|---:|---:|
| type | branching | branching | linear | linear | linear | linear |
| chapters | 1 | 1 | 1 | 1 | 1 | 1 |
| scenes | 7 | 10 | 7 | 5 | 7 | 8 |
| characters | 5 | 6 | 6 | 4 | 5 | 9 |
| **characterScenes** | **2** | **2** | **2** | **2** | **2** | **2** |
| characterRelations | 4 | 5 | 5 | 3 | 4 | 9 |
| locations | 3 | 3 | 2 | 2 | 3 | 3 |
| locationRelations | 1 | 1 | 1 | 1 | 1 | 1 |
| items | 2 | 3 | 3 | 2 | 2 | 2 |
| itemJourneys | 2 | 3 | 5 | 2 | 3 | 4 |
| choices | 7 | 10 | — | — | — | — |
| choiceCheckGroups / Checks | 1 / 1 | 1 / 1 | — | — | — | — |
| effects | 1 | 1 | 1 | 1 | 1 | 1 |
| plots / plotScenes | — | — | 1 / 3 | 1 / 3 | 1 / 3 | 1 / 3 |
| **stats / strengths / relations** | **0** | **0** | **0** | **0** | **0** | **0** |
| **modes** | **0** | **0** | **0** | **0** | **0** | **0** |
| **galleryItems** | **0** | **0** | **0** | **0** | **0** | **0** |
| notes / noteRelations | 2 / 2 | 2 / 2 | 1 / 1 | 1 / 1 | 2 / 2 | 1 / 1 |
| tags / tagRelations | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 |
| worldRules | 2 | 2 | 2 | 1 | 2 | 1 |
| comments | 1 | 1 | 1 | 1 | 1 | 1 |
| seeAlsoRelations | 1 | 1 | 1 | 1 | 1 | 1 |
| favorites | 1 | 1 | 1 | 1 | 1 | 1 |
| storySchemaFields / attributeValues | 2 / 4 | 2 / 4 | 2 / 4 | 2 / 4 | 2 / 4 | 2 / 4 |
| suggestions | 12 | 12 | 12 | 12 | 12 | 12 |
| scenes with timing (gap/duration) | 0 | 1 | 0 | 0 | 0 | 0 |

Gaps in variety, beyond the counts:

- `effects` is always a single `triggerSet`; `itemGrant`, `itemTake` and `triggerUnset` never
  appear.
- `choiceChecks` is always a single `sceneCount`; `inventory` and `trigger` never appear.
- `storySchemaFields` are always two fields of the `suggestion` type; the other six types
  (`text`, `long_text`, `number`, `boolean`, `date`, `suggestion_list`, `entity`) never appear.
- `locationRelations` is always a single `connected_to`; `contains` never appears, so the locations
  map never shows a hierarchy.
- `seeAlsoRelations` is always `Character ↔ Location`, out of eight possible types.
- `comments` are always on `Character.description`, criticality 2, out of a scale from 1 to 5.
- `favorites` are always on the `Story` itself.
- Every story has `statSystem: false`.

### The Story Analysis baseline

Running `buildStoryAnalysisReport` over each of today's examples:

| Story | Findings | Which |
|---|---:|---|
| alice-in-wonderland | 4 | 3× a character with no scene, 1× a location with no link |
| beauty-and-the-beast | 5 | 4× a character with no scene, 1× a location with no link |
| cinderella | 4 | 4× a character with no scene |
| goldilocks | 4 | 2× a character with no scene, 1× a character with no relation, 1× an unused location |
| little-mermaid | 4 | 3× a character with no scene, 1× a location with no link |
| princess-kaguya | 8 | 7× a character with no scene, 1× a location with no link |

No example passes clean today. The good news is that the findings are exactly the ones phases
2 and 3 resolve as a consequence: a character with no scene disappears when every character enters
`characterScenes`, and a location with no link disappears when the locations map gains a hierarchy. That is,
"zero findings" is not an extra goal — it is the side effect of hitting the targets in the tables
above, and that is why it works as an automated guard.

The two branching stories already pass clean on the expensive checks (choice reachability and
satisfiability); Phase 6 has to keep that while adding a cycle and alternative
endings.

## What each visual product requires in order to "be complete"

| Product | Where | It needs |
|---|---|---|
| The story map (SVG) | `storyGraphSvg` | a branching story with multiple chapters (colours per chapter), a fork, a reunion, at least one cycle and one alternative ending |
| The locations map (SVG) | `locationGraphSvg` | `contains` **and** `connected_to`, with at least two levels of hierarchy |
| The relations map (SVG) | `characterRelationGraphSvg` | ≥ 6 characters and relations forming groups, not a single star |
| The presence matrix (SVG) | `presenceMatrixSvg` | **many `characterScenes`** — today's 2 per story leaves the matrix almost empty; with the new thread, ideally there should be a continuous character, a character with a gap and a character in a single scene |
| The item matrix (SVG) | the same matrix, `kind: item` | ≥ 3 items with ≥ 3 stops each, with different states |
| The plot matrix (SVG) | `presenceMatrixSvg` through Plot | ≥ 3 plots with partial scene overlap (linear) |
| Plot coverage (SVG) | `plotCoverageSvg` | plots with markedly different coverage from one another, including an empty plot |
| The timeline (SVG) | `storyTimelineSvg` | `gap`/`gapType` and `duration`/`durationType` on most scenes, with varied units |
| The stat radar | `statRadarSvg` | `statSystem: true`, 4–6 primary stats, ≥ 3 characters with values, and at least one character with a **mode** |
| The tier bar | `statLadderBarLayout` | the story's default ladder + at least one stat with a ladder of its own |
| Ranking / comparison | the Stats screens | values spread out enough for the ranking not to be a tie |
| The plot reader | `PlotReaderScreen` | a filled-in summary on every scene |
| Story analysis | `storyAnalysisChecks` | ideally **zero** findings: the example is the reference for a well-formed story |

## The target per story

The general rule: **every** story covers everything its type allows. What changes between them is the
scale and the theme, not which features appear.

### Common minimums (linear and branching)

| Collection | Minimum | Note |
|---|---:|---|
| chapters | 3 | it gives the charts a chapter colour and validates the 1..N numbering |
| scenes | 12 | 3–5 per chapter |
| scenes with `gap` + `duration` | 80% | varied units (`minutes`, `hours`, `days`, `years`) |
| characters | 6 | |
| characterScenes | 18 | ≥ 3 characters present in ≥ 4 scenes each |
| characterRelations | 6 | at least two distinct groupings |
| locations | 5 | |
| locationRelations | 4 | at least 2 `contains` and 2 `connected_to` |
| items | 3 | |
| itemJourneys | 9 | ≥ 3 stops per item, with a change of owner and of state |
| worldRules | 3 | |
| notes / noteRelations | 3 / 4 | notes linked to different entity types |
| tags / tagRelations | 4 / 10 | the same tag on different entity types |
| comments | 4 | different fields, criticalities 1, 3 and 5 |
| seeAlsoRelations | 4 | at least 4 pairs of different types |
| favorites | 3 | Story + Character + Scene |
| storySchemaFields | 8 | **one of each** `AttributeType` |
| attributeValues | 12 | every field with a value on at least two entities |
| stats | 5 | `statSystem: true` |
| statStrengths | 12 | the default ladder + one stat's own ladder |
| statRelations | 20 | ≥ 4 characters × 5 stats |
| modes | 2 | at least one character with a mode, with values of its own |
| effects | 4 | one of each: `itemGrant`, `itemTake`, `triggerSet`, `triggerUnset` |
| suggestions | 12+ | the catalogues of the suggestion fields used |

### Linear stories only (Cinderella, Goldilocks, the Mermaid, Kaguya)

| Collection | Minimum | Note |
|---|---:|---|
| plots | 4 | including **one empty plot**, so the coverage average shows that case |
| plotScenes | 14 | distinct coverage: one nearly complete plot, one sparse, one concentrated in a single act |

### Branching stories only (Alice, Beauty and the Beast)

| Collection | Minimum | Note |
|---|---:|---|
| choices | 16 | a fork, a reunion, a cycle and ≥ 2 endings |
| choiceCheckGroups | 4 | at least one `AND` and one `OR` |
| choiceChecks | 6 | at least one of each type (`sceneCount`, `inventory`, `trigger`) and at least one in `enable` mode and one in `block` |

## Inviolable constraints

These are not preferences — breaking any of them produces an example that fails on
installation, on synchronization or in the Analysis:

1. **1..N numbering.** Chapters 1..N in the story; scenes 1..M **within the chapter**, with no
   holes or repeats. There is already a test locking that down (`ExampleStoryService.test.ts`).
2. **Plots only in linear stories**, choices/checks only in branching ones. The services refuse
   the opposite, and the drawer hides Plots in branching stories.
3. **`formatVersion: 6`** and every collection present (even empty, where the schema requires it).
4. **Ids in ULID format** (26 characters, Crockford's alphabet — no `I`, `L`, `O`, `U`),
   unique within the file. Installation remaps them all, but repeated ids inside the same
   file would collapse two entities into one.
5. **Every reference has to exist within the file itself**: `chapterId`, `locationId`,
   `sceneId`, `itemId`, `characterId`, `plotId`, `fieldId`, and the `entityId` of a comment/attribute/
   favourite/see-also.
6. **The PlotScene note**: a single line, ≤ 160 characters.
7. **At most 12 primary stats** per story.
8. **`userId`** stays `EXAMPLEUSERPLACEHOLDER0000` on the story, comments and favourites.
9. **Public domain**: only public-domain works and texts, written in our own words.
10. **en and pt in parallel**: the same ids, the same structure, only the text changes. A feature present in
    one language has to exist in the other.

## Out of scope, and why

- **The gallery (`galleryItems`, `galleryRelations`)**: a gallery row points at a local media
  file; examples are static JSON, with no packaged media (see `ExampleStoryService`).
  A row with no file would appear as a broken thumbnail — worse than an empty list. It stays
  out until there is a way of packaging media with the example.
- **Synchronization data** (`serverLastOperationVersion` > 0, conflicts, permissions,
  publications): they belong to an account and a server, not to the story's content.
- **Literary suggestions / Story Devices**: an app catalogue, not story data.

## Execution

Each phase is independent and verifiable; none depends on the next.

### Phase 0 — An authoring tool (before touching any content)

Write `apps/client/scripts/build-example-story.ts` that assembles the JSON from a lean
description (chapters → scenes → who appears, items, plots) and generates deterministic ULID ids per
slug. Writing 12 files of ~2,000 lines by hand, in two languages, with correct cross
references, is where human error creeps in.

The script takes care of: 1..N numbering, fixed `createdAt/updatedAt`, `version: 1`, required
null fields, and en/pt parity (the same ids in both).

### Phase 1 — Narrative structure

For the six stories: split into 3 chapters, reach ≥ 12 scenes, fill in `summary` on
all of them, and distribute `gap`/`duration` with varied units. It is the phase that fills the Timeline
and gives every map a chapter colour.

### Phase 2 — Cast and presence

Rise to ≥ 6 characters, ≥ 18 `characterScenes` (with the three profiles: continuous, with a gap, in
a single scene), ≥ 6 relations forming groups. It fills the presence matrix and the relations map.

### Phase 3 — The world

≥ 5 locations with a hierarchy (`contains`) and links (`connected_to`); ≥ 3 world rules. It fills the
locations map.

### Phase 4 — Items

≥ 3 items with ≥ 3 stops each, with a change of owner and of state. It fills the item matrix and the
journey.

### Phase 5 — Stats and modes

`statSystem: true`, 5 stats, the default ladder + one ladder of its own, values for ≥ 4 characters,
2 modes with values of their own. It fills the Radar, the Bar, the Ranking and the Comparison — all empty today.

### Phase 6 — Plots (linear) and branching (branching)

Linear: 4 plots (one empty) and ≥ 14 relations with distinct coverage.
Branching: ≥ 16 choices with a fork, a reunion, a cycle and two endings; 4 check
groups covering `AND`/`OR` and the three check types; 4 effects covering the four types.

### Phase 7 — The editorial layer

A story schema with a field of **each** attribute type and values filled in; tags
applied to different entity types; notes linked to different entities; 4 comments on
different fields and criticalities; 4 "see also"s between pairs of different types; favourites on
three types.

### Phase 8 — Guards

New tests in `apps/client/test/services/ExampleStoryService.test.ts`:

- **a coverage matrix**: for each example, every collection applicable to the story's type has at
  least this table's target count. It is the test that stops a new example entering half-finished;
- **variety**: the four effect types, the three check types, the eight attribute types,
  the two location relation types, ≥ 3 comment criticalities;
- **referential integrity**: every reference points at an id existing in the same file;
- **ids**: all unique and in valid ULID format;
- **en/pt parity**: the same ids and the same counts in both languages;
- **a clean Analysis**: `buildStoryAnalysisReport` of each installed example returns zero findings —
  the example is the reference for a well-formed story;
- **size**: each file under 250 KB (today: 30–46 KB; the target triples the content, so
  the ceiling leaves slack without letting the bundle grow without limit).

### Phase 9 — Visual verification

With a story installed, check the nine SVG/chart products from the table above, in light
and dark themes, and export each one. It is the only phase that cannot be automated here.

## Risks

- **Bundle size**: the examples are a static `import` inside the app's JS. Six stories
  tripling in size go from ~240 KB to ~700 KB of JSON. Acceptable, but it is the reason for the
  250 KB per file ceiling in Phase 8. If it gets tight, the way out is loading the content on demand
  instead of cutting features.
- **Translation**: doubling the content doubles the text to write in pt and en. The structural parity is
  testable (Phase 8), the text's quality is not.
- **Maintenance**: every new feature of the system comes to imply updating six stories in two
  languages. The Phase 8 coverage test is what turns that oversight into a build failure
  instead of a silently outdated example.
- **Delivery order**: phases 1 and 2 change ids and counts the following phases reference.
  Doing one whole story end to end before repeating it in the other five is safer
  than doing one phase at a time across all six — a suggestion: **Cinderella** first (linear, already the most
  complete) and **Alice** next (branching), and only then replicate the pattern.
