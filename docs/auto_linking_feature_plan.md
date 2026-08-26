# Plan: automatic entity linking

Target: Keres 1.6. Status: planned.

## 1. Goal

When a story's text mentions an entity by name, that mention becomes tappable and opens the entity.
No syntax to learn, no marking, no per-field setup: one switch per story, and when it is on it is
**fully automatic**.

Scope for 1.6 is **forward links only** — rendering links inside text. Backlinks ("which entities
mention this one") is a different, more expensive feature; see §9.

## 2. What "fully automatic" actually commits us to

Automatic means there is no syntax, so **the app decides what is a mention**. There is no
`[[Alice]]` to disambiguate intent and no per-mention override. That makes the matching rule the
entire feature: everything good or bad about it follows from how well the rule guesses.

Two consequences shape every decision below.

**First: the rule must be restrained, because the writer cannot correct it.** In a system with
syntax, an over-eager matcher is annoying but fixable per mention. Here it is not. Every rule in §3
exists to make false positives rare rather than to catch every possible mention. **Missing a link is
a non-event; a wrong link on every page is why people turn features off.**

**Second: it must never write.** Rendering a link creates nothing, records nothing and is undone by
the switch. The moment auto-linking creates a `SeeAlsoRelation`, Keres is deciding the story's
relationships for the writer — a rail, in the sense of `FEATURE_LANDSCAPE.md` §1. **The feature
renders and navigates. It does not persist anything, ever.** `SeeAlsoRelation` stays what it is: a
link the writer made on purpose.

## 3. The matching rule

In order. Each rule is here because it removes a specific class of false positive.

1. **Case-sensitive, exact match of the stored name.** This is the load-bearing rule and it costs
   nothing. Proper nouns are capitalised in both Portuguese and English; the common words that
   collide with them are not. An Item named `Espada` links `Espada` and leaves `espada` alone; a
   Character named `Rosa` does not light up every `rosa` in a garden description. A writer who names
   an entity in lower case gets more matches — their choice, and it is visible.
2. **Unicode word boundaries.** JavaScript's `\b` is ASCII-only: `\bJoão\b` behaves incorrectly
   around accented characters. Use explicit lookarounds with the `u` flag —
   `(?<![\p{L}\p{N}_])` … `(?![\p{L}\p{N}_])` — or equivalent manual boundary checks in the
   tokeniser. This is the single most likely implementation bug in the feature.
3. **Minimum length of 3 characters.** Removes `Al`, `Ed`, `Rei` and every other name short enough
   to appear inside ordinary words.
4. **Longest match wins.** `Alice Liddell` before `Alice`.
5. **Ambiguous names do not link.** If two active entities share a name — a Character `Rosa` and an
   Item `Rosa` — the app has no basis to choose, so it links neither. Silence beats a wrong guess,
   and this is consistent with the premise: Keres does not decide what the writer meant.
6. **Never self-link.** An entity's own fields do not link to itself.
7. **Active entities only.** The matcher is built from non-deleted rows, so a deleted character
   stops linking everywhere with no extra work.
8. **First occurrence per field.** A biography naming `Alice` forty times becomes forty blue words
   and unreadable. One link per field, at the first mention — the same convention encyclopedias
   use. This matters more here than elsewhere precisely because the writer cannot hand-tune it.

## 4. How the matching runs

**Not `LIKE`, and not a regex alternation.** A `LIKE '%name%'` query answers the opposite question
(*which texts contain this name*), which is the backlinks problem in §9. And an alternation of every
name in the story is O(names × text) per field, re-run on every render.

The correct shape is a **token map**:

- Build once per story: `Map<string, EntityRef>` from name → entity, plus the maximum name length in
  words (for the n-gram window).
- To render a field: tokenise the text once, walk it, and for each position try the longest n-gram
  window first (capped at the story's longest name, and hard-capped at 4 words), looking each
  candidate up in the map.
- That is O(text length), independent of how many entities the story has.

**Memoisation and invalidation.** The map is built per story and cached. Every entity service
already emits a change event (`character_changed`, `location_changed`, …) — the cache subscribes and
rebuilds on any of them. Rebuilding on every render is the performance failure mode to avoid; a hook
holding the matcher, or a small Zustand store beside the other story-scoped state, is the natural
home.

## 5. Where it renders

`DetailField` is the single choke point: every read-only field on every detail screen goes through
it, including `CommentableDetailField` and `CustomAttributeDetailFields`. It already supports a
whole-value link (`onPress`, added for `AttributeType.ENTITY`), so the precedent for a tappable value
exists.

What is new is **inline** spans: the value is split into segments and rendered as nested `<Text>`
runs, the matched ones carrying `onPress` and the primary colour. React Native supports nested
`<Text>` with `onPress`, so no new dependency.

Which text is scanned:

| Scanned | Not scanned |
| --- | --- |
| Long free text: description, biography, summary, notes, `extraNotes` | The entity's own name/title field |
| Long-text custom attributes | Short identifying fields |
| World rule and note bodies | Anything inside a form being edited (§6) |

## 6. It does not touch editing

While a field is being edited it is a plain `TextInput`. No linking, no highlighting, no
interference with the keyboard or the cursor. The feature exists only on the read side. This keeps
it cheap and removes an entire category of bug.

## 7. Navigation — the part that has burned us before

Use `useNavigateToEntityDetail`, which wraps `navigateToEntityDetail` +
`useHeaderBackActionStore.setCrossStackReturnAction`. **Do not write new navigation.**

The earlier incident (`useOpenGalleryMediaViewer`) came from navigating out of the current tab
without registering the way back: the first attempt returned the gallery list instead of the entity
screen; the second fixed that but made the entity screen itself lose the Drawer's focus, triggering
that tab's stack reset. The current helper is the answer to exactly that, is used by Global Search,
Story Analysis, Stat Comparison, Stat Ranking and Suggestion Usage, and is covered by
`useNavigateToEntityDetail.test.ts`.

A link to an entity type with no detail screen (`toNavigableEntityType` returns `null`) renders as
plain text — the same rule `RelatedEntitiesList` already follows.

## 8. The switch

A new column on `Story`, beside `completenessChecks` from the Story Analysis plan:

```ts
/** When on, entity names found in a story's text render as links to those entities. */
autoLinkMentions: boolean;
```

- **Not owner-only** — a reading preference, like `statSystem`.
- **Existing stories: off.** No surprise change in how anyone's text renders after an update.
- **New stories: on** is defensible and worth deciding explicitly. Unlike the completeness checks,
  this makes no judgement about the writer's work — it is a reading convenience, invisible until a
  story has both entities and prose, so it cannot surprise anyone early.
- **The switch is the only control.** No per-entity opt-out in 1.6: that would mean a column on
  seven entity tables. If one entity turns out to be a menace, §3's rules are the mitigation and
  renaming it is the escape hatch. Revisit only if real use shows it is needed.

## 9. Backlinks are not in this plan

"Which entities mention this one" is the reverse query: scan every text field of every entity for
this entity's name, on every detail screen open. That is the `LIKE` direction, it grows with the
story, and it needs its own caching strategy. Splitting it out keeps 1.6 cheap and safe. The forward
half is useful on its own.

## 10. Changes per layer

| File | Change |
| --- | --- |
| `packages/shared/entities/Story.ts` + `schemas/StorySchemas.ts` | `autoLinkMentions: boolean` |
| `apps/api/src/db/schema/tables/stories.ts` + migration | the column |
| `apps/client/src/db/schemas/stories.ts` + migration | the column |
| `apps/client/src/utils/entityMentions.ts` **(new)** | pure: build the matcher from named entities, and split a string into `{text}` / `{text, ref}` segments. No React, no database — testable in isolation |
| `apps/client/src/hooks/useEntityMentions.ts` **(new)** | loads the story's named entities, memoises the matcher, subscribes to the entity change events |
| `apps/client/src/components/common/display/DetailField/DetailField.tsx` | render segments; a matched segment is a nested `<Text>` with `onPress` |
| `apps/client/src/screens/mainstorystack/StorySettingsScreen.tsx` | the switch |
| `apps/client/src/locales/{en,pt}.json` | the setting label and hint |
| `apps/client/src/help/content/see-also/{en,pt}.ts` | how an automatic link differs from a "See also" the writer made |

## 11. Tests

`entityMentions.ts` is pure, so most of the feature is testable without rendering:

- case sensitivity: `Espada` links, `espada` does not;
- Unicode boundaries: `João` inside `São João` and beside punctuation, with accents on both sides;
- minimum length: a two-character name never matches;
- longest match: `Alice Liddell` wins over `Alice`;
- ambiguity: two active entities sharing a name produce no link;
- self-link: an entity's own field does not link to itself;
- deleted entities do not match;
- first occurrence only: forty mentions produce one link;
- a text with no matches returns a single plain segment (the common case must be cheap).

Rendering and navigation:

- `DetailField` renders a matched segment as tappable and calls the navigation helper with the right
  type and id;
- with the switch off, the value renders as one plain string and the matcher is never built;
- an entity type with no detail screen renders as plain text.

## 12. Risks

1. **Unicode boundaries** (§3 rule 2) — the most likely bug, and invisible in English-only testing.
   Covered explicitly above.
2. **Rebuilding the matcher per render.** The failure would be a slow detail screen on a large
   story, not a wrong result, so it will not show up in unit tests. Worth a deliberate check on a
   large example story.
3. **A common word as a name.** A character literally named `Sol` in a story about the sun will
   produce noise even with the rules. Accepted: the switch is the answer, and it is the writer's
   name to change.
4. **Comment snapshots.** `Comment.contentSnapshot` preserves the field text as it was; links there
   resolve against *current* entities, so a mention of a since-deleted character renders plain.
   Correct behaviour, worth an explicit test.
5. **Showcase.** The public showcase renders story content through shared components and would
   ideally link too. Out of scope for 1.6; note it so the two do not drift.

## 13. Execution order

1. `entityMentions.ts` and its tests — the whole matching rule, with no UI and no database.
2. Shared entity, schemas, both columns and migrations.
3. `useEntityMentions` with the change-event invalidation.
4. `DetailField` segment rendering plus the navigation wiring.
5. The switch in Story Settings, locales, help.
6. `bun run typecheck` → `lint` → `test:report`.

Step 1 is deliberately first: if the matching rule is not right, nothing downstream matters, and it
is the part that can be judged entirely from tests.
