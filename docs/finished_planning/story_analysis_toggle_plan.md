# Plan: Story Analysis stops having opinions

Target: Keres 1.6. Status: planned.

## 1. Goal

Story Analysis today mixes two kinds of finding: **integrity** (a reference points at something that
does not exist) and **opinion** (a location appears in no scene). The first is true in any medium and
for any intent. The second tells the writer their worldbuilding is wrong — and in a story bible, a
location that appears in no scene is simply a place that exists in the world.

Under the product premise (see `FEATURE_LANDSCAPE.md` §1), Keres does not have opinions about the
writer's work unless asked. This plan splits the two and puts the second behind a per-story switch,
off by default.

## 2. The partition

**The existing split is by cost, not by nature.** `buildCheapStoryAnalysisFindings` (feeding the
dashboard badge) versus `buildStoryAnalysisReport` (the screen) divides O(entities) checks from the
fixed-point graph walks. That split stays exactly as it is. This plan adds a **second, orthogonal**
partition that both paths must respect.

| Always on — integrity | Behind the switch — opinion |
| --- | --- |
| `checkChoices` → `analysis_choice_dangling_scene`, `analysis_choice_dangling_next_scene` | `checkCharacters` → `analysis_character_no_scenes` |
| `checkSceneReachability` → `analysis_scene_unreachable`, `analysis_no_start_scene` | `checkCharacters` → `analysis_character_no_relationships` |
| `checkChoiceSatisfiability` → `analysis_choice_never_satisfiable` | `checkLocations` → `analysis_location_unused` |
| `checkSceneFinishWithChoices` | `checkLocations` → `analysis_location_no_connections` |
| `checkStorySchema` → `analysis_attribute_*` | `checkItems` → `analysis_item_unused` |
| `checkDuplicateRelations` | `checkTags` → `analysis_tag_unused` |
| `checkNarrativeIndexes` | |

Two of these deserve their reasoning recorded, because they look like opinions and are not:

- **`checkStorySchema` stays on.** `analysis_attribute_required_missing` fires because the *writer*
  marked the field required. It enforces the writer's rule, not Keres's. That is the boundary this
  whole plan draws: the app may hold the writer to what the writer declared, never to what Keres
  believes about stories.
- **`checkNarrativeIndexes` stays on.** A gap or repeat in the numbering is not untidiness — the API
  refuses a reorder whose indices are not a contiguous 1..N, so a crooked numbering becomes a
  synchronization conflict the first time a scene is dragged.

`checkCharacters`, `checkLocations`, `checkItems` and `checkTags` each need to be split internally:
they currently emit both kinds. `checkLocations` in particular emits `analysis_location_unused`
(opinion) alongside nothing structural, while `checkCharacters` mixes both.

## 3. The switch

A new column on `Story`, following `statSystem` and `normalizeSceneTiming` exactly:

```ts
/** When on, Story Analysis also reports elements that exist but are not referenced anywhere. */
completenessChecks: boolean; // default false
```

- **Not owner-only.** `STORY_OWNER_ONLY_FIELDS` covers `id`, `userId`, `type`, `favoriteBehavior`
  and `allowReaderComments` — policy. This is a preference about a story, like `statSystem`, so a
  writer may change it.
- **Default `false`, including for existing stories.** The migration sets it false everywhere. This
  is a reduction in noise, not a loss of data: no finding disappears that the writer cannot bring
  back with one switch. Defaulting it on would mean the feature changes nothing.
- **Naming.** Avoid "Keres Consistency" — it implies Keres has a standard the story should meet,
  which is the framing being removed. Name it for what it does: the setting is *completeness
  checks*, and the label should say it reports elements not referenced anywhere. "Stricter review"
  works too. The word to keep out of it is Keres.

## 4. Changes per layer

| File | Change |
| --- | --- |
| `packages/shared/entities/Story.ts` | `completenessChecks: boolean` |
| `packages/shared/schemas/StorySchemas.ts` | field on create/update/response, `.default(false)` |
| `apps/api/src/db/schema/tables/stories.ts` | `boolean('completeness_checks').notNull().default(false)` |
| `apps/api/drizzle/00XX_*.sql` | generated with `bun run --cwd apps/api db:generate` |
| `apps/client/src/db/schemas/stories.ts` | same column |
| `apps/client/src/db/migrations/00XX_*.ts` | `ALTER TABLE stories ADD COLUMN completeness_checks integer NOT NULL DEFAULT 0;` |
| `apps/client/src/utils/storyAnalysisChecks.ts` | split the four mixed check functions; add `includeCompleteness` to `StoryAnalysisInput`; both entry points honour it |
| `apps/client/src/services/storymanagement/StoryAnalysisService.ts` | select the column and pass it into the input |
| `apps/client/src/screens/mainstorystack/StorySettingsScreen.tsx` | the switch, beside the other story switches |
| `apps/client/src/components/features/story/StoryFieldsForm/` | **no change** — this is a story setting, not a creation field |
| `apps/client/src/locales/{en,pt}.json` | the setting label, its hint, and nothing else — no finding text changes |
| `apps/client/src/help/content/story-analysis/{en,pt}.ts` | explain the two kinds of finding and the switch |

Nothing in `StorySyncHandler` needs special treatment: it is an ordinary column on an entity that
already synchronizes.

## 5. The dashboard badge

`MainDashboardScreen` counts findings through the cheap path. It must pass the same flag, or the
badge will contradict the screen. This is the one place the two orthogonal partitions interact, and
the test below exists because of it.

## 6. Tests

- `storyAnalysisChecks.test.ts`: with the flag off, none of the six opinion codes appears; with it
  on, all six can appear; the integrity codes appear in both cases. Parameterised over the code list
  so a new check must be classified to compile.
- A story with an unreferenced location, an unused tag and a dangling choice reports **one** finding
  with the flag off and **three** with it on. This is the whole feature in one assertion.
- `StoryAnalysisService.test.ts`: the flag is read from the story and reaches the input.
- The cheap path and the full path agree on which opinion codes they suppress.
- `StorySettingsScreen`: toggling writes the field and records one operation.

## 7. Risks

1. **A new check lands unclassified.** Mitigated by making the classification a typed map keyed by
   finding code, so an unhandled code fails typecheck rather than silently defaulting to "always
   on".
2. **Existing users lose findings they relied on.** Real, and accepted: the switch is one tap and
   the help page explains it. The alternative — defaulting on — makes the feature inert.
3. **Wording drift.** The findings behind the switch should also be reworded from problems to
   observations ("not referenced by any scene" rather than "has no scenes"), but that is text, not
   logic, and can follow later without blocking this.

## 8. Execution order

1. Shared entity, schema, both database columns and migrations.
2. The partition in `storyAnalysisChecks.ts` plus its tests — the flag can be threaded before any
   UI exists.
3. `StoryAnalysisService`, the analysis screen and the dashboard badge.
4. The switch in Story Settings, locales, help.
5. `bun run typecheck` → `lint` → `test:report`.
