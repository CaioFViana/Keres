# Implementation plan — the "Help" drawer

> A planning document. Everything here has been implemented and adapted. Target: `apps/client`, a new drawer
> in `apps/client/src/navigation/StorySelectionStack.tsx`, plus a body of help content
> versioned in the repository.
>
> **The content's audience: the end user — a writer, not a developer.** File, table,
> database field and component names appear *in this plan* only to locate
> what needs explaining; **none of them appears in the help's text**.

## 1. Goal

To add a **Help** drawer to the main menu giving access to a catalogue of pages covering
everything the user sees and does in Keres:

- every **screen** the user reaches (the main menu and the story menu — the initial installation
  screen does not need one, it is only the front door);
- every **field the user fills in or reads on screen**, explained in plain language: what
  to write there, when it makes sense to fill it in, and what changes elsewhere because of it;
- every **cross-cutting feature**: tags, notes, gallery, custom attributes, suggestions,
  favourites, search, **comments** and **see also**;
- **servers, account, friendships, collaboration and account limits**;
- **synchronization** between devices, the activity history and what to do when a
  conflict appears;
- **branching stories**: choices, checks, effects and the reader's state.

**The quality criterion:** somebody who has never read the code — and who does not know what a "ULID", a
"polymorphic FK" or a "tombstone" is — should be able to answer, after reading the page: *what is
this, what is it for, how do I do it, and what does it affect*.

## 2. Editorial principles

These rules apply to all the content and are what separates this plan from its first version.

1. **The interface's vocabulary, not the code's.** The page speaks of "Tags", "Custom
   Attributes", "Order", "Extra notes" — exactly the labels that appear on screen, in
   the user's language. Never `TagRelation`, `StorySchemaField`, `index`, `extraNotes`.
2. **No internal mechanics.** These do not enter: ULID, media hash, `version`, `isDeleted`/
   `deletedAt`, join tables, "polymorphic", Drizzle, SQLite, JWT, Zod, route names. The
   user does not see those fields and cannot act on them.
3. **Every page answers four questions, in this order:** *What it is* → *What it is for (with a
   concrete narrative example)* → *How to do it (step by step, through the interface's real path)* →
   *What it affects elsewhere*.
4. **A page is per task, not per table.** "Item journeys" is a page; "AttributeValue"
   is not a page. Entities the user never perceives as a separate thing (attribute
   values, tag/note/gallery relations, favourites as a record, permissions) are
   explained *inside* the page of the feature that uses them.
5. **An example before a definition** whenever the definition alone would be abstract. A scene's `Duration`
   and `Gap`, for example, only become clear with an example timeline.
6. **Only what is actionable.** If the user can neither see nor change it, it does not go into the help —
   it goes into `docs/`, which is where the technical documentation already lives.
7. **No promise of unverified behaviour.** Every text is written by reading the screen and the
   service that feeds it; where the behaviour is conditional (e.g. converting a branching
   story into a linear one), the condition is stated explicitly.

### 2.1 How the fields are explained

Each page's field table has three visible columns:

| Field (the screen's label) | What to write here | Note |
| --- | --- | --- |
| Title | The name by which you recognise the story. The only required field. | It appears in the story list and in searches. |
| Author | Who signs the story. Free text. | Independent of your account — use it to credit the original author of an adaptation. |

No "type" or "required/optional" column as jargon: whether something is required goes into prose in
the description itself, because that is how the screen communicates it (an asterisk/validation).

**Fields that never enter the help:** internal identifiers, the link to the story, deletion
marks, synchronization counters and the version field. **System fields that do enter, because
the user sees them:** the creation date and the last-change date (they appear on detail screens and in the
activity history) — explained once, in `activity-log`, and referenced by link.

## 3. Architecture decisions (and why)

### 3.1 Where the drawer lives

The drawer enters `StorySelectionStack` (the main menu, outside a story), by the same
reasoning already documented in a comment in the file for `ImportExport`/`ExampleStories`: help
does not depend on an open story and needs to be reachable before any story exists.

**Also in `MainSystemStack`** (the story menu), as the last item — because half the catalogue
describes screens that only exist in there, and sending the user out of the story to read about the
story is needless friction. Both point at the same help navigator. This is promoted from the
previous version's "optional phase 2" to the minimum scope.

### 3.2 Content: structured blocks, not Markdown

The client has no Markdown renderer in its dependencies (`apps/client/package.json`), and
adding one brings weight and a risk of incompatibility with React Native Web/Expo 54 with no gain:
we need *internal links between pages* and *field tables*, which Markdown would handle badly in RN.

The decision: content as a **typed block tree** in TypeScript (`HelpBlock[]`), rendered by
a component of its own. Links between pages become data that can be validated in a test, the field table
stays visually consistent across every page, and a broken link becomes a typecheck error.

### 3.3 Content outside `locales/*.json`

`src/locales/en.json` and `pt.json` already have ~64 KB / ~69 KB of UI keys and are audited by
`scripts/verify-translations.ts`. Dumping dozens of pages of prose there pollutes the audit and the
diff of every UI change.

The decision: content in `src/help/content/<pageId>/<lang>.ts`, with a **registry generated** by
a script, exactly the pattern already used by `src/exampleStories/`. Only the navigation labels
(the drawer's title, the search, "not found") stay in the locales.

Languages in v1: **pt** and **en**. The language follows the one chosen in Settings; the fallback to `en`
exists only so the screen does not break should a translation be missing.

## 4. File structure

```
apps/client/
├── scripts/
│   └── generate-help-index.js            # scans help/content, writes generated/registry.ts
└── src/
    ├── help/
    │   ├── types.ts                      # HelpBlock, HelpPage, HelpSection, HelpPageId
    │   ├── catalog.ts                    # sections + order + icons + pageIds (the source of the order)
    │   ├── fieldSources.ts               # §8: which screen fields each page must cover
    │   ├── content/
    │   │   ├── what-is-keres/{pt,en}.ts
    │   │   ├── characters/{pt,en}.ts
    │   │   └── ...                       # one folder per page (§5)
    │   └── generated/
    │       └── registry.ts               # auto-generated, do not edit
    ├── components/features/help/
    │   ├── HelpBlockRenderer/
    │   ├── HelpFieldTable/
    │   └── HelpSearchBar/
    ├── screens/help/
    │   ├── HelpIndexScreen.tsx
    │   └── HelpPageScreen.tsx
    └── navigation/                       # + HelpDrawer in both stacks
```

## 5. The content's data model

```ts
// src/help/types.ts
export type HelpPageId = GeneratedHelpPageId; // a generated literal union — see §7.1

export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'steps'; items: string[] }                    // "how to do it", numbered
  | { type: 'path'; segments: string[] }                  // "Menu › Friends › Friend detail"
  | { type: 'callout'; tone: 'info' | 'warning'; text: string }
  | { type: 'example'; title?: string; text: string }     // a concrete narrative example
  | { type: 'fields'; rows: HelpFieldRow[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'faq'; items: { question: string; answer: string }[] }
  | { type: 'seeAlso'; pages: HelpPageId[] };

export interface HelpFieldRow {
  /** The technical key — NEVER rendered. It exists only for the coverage test (§8). */
  key: string;
  /** The label exactly as it appears on screen, already in the page's language. */
  label: string;
  /** What to write there, in plain language. Whether it is required goes here, in prose. */
  whatToWrite: string;
  /** The effect on other screens, where there is one. */
  note?: string;
}

export interface HelpPage {
  id: HelpPageId;
  title: string;      // natural language: "Characters", not "entity-character"
  summary: string;    // 1 line, used in the index and in the search
  keywords: string[]; // how the user would search: "sheet", "protagonist", "cast"
  blocks: HelpBlock[];
}
```

Rules enforced by test (§8):

- every page with a field table covers 100% of the fields **visible on screen** in the corresponding one;
- every `seeAlso` points at an existing page;
- every catalogue page exists in **pt** and **en**;
- no content text contains terms from the jargon blacklist (§8, the third test).

## 6. The page catalogue

The order and grouping below are the source of truth for `catalog.ts`. The `pageId` is internal; what the
user reads is the **Title**.

### 1. Start here (`start`)

| pageId | Title | Content |
| --- | --- | --- |
| `what-is-keres` | What Keres is | Who it is for, it works without the internet, what it is **not** (it is not a text editor: it organizes the universe, you write the text wherever you like). |
| `first-story` | Creating your first story | From the local username to an open story, in steps. It suggests starting with an example story. |
| `how-keres-organizes` | How Keres organizes a story | A mental map: story → chapters → scenes; characters, locations and items that cross the scenes; tags, notes, comments and "see also" as annotation layers over everything. It is the page that gives the rest its meaning. |
| `getting-around` | Getting around the app | The two menus (the app's and the story's), how to go back, the resizable drawer, the difference between a wide screen and a phone. |
| `lists-and-search` | Lists, search and filters | Every list works the same way: search, filter by tag, sort, see favourites only, and the field-by-field Advanced Search. It includes the story's Global Search. |
| `using-this-help` | How to use this help | The index, the help's search, "see also", and what to do if you did not find it. |

### 2. Your stories (`stories`)

| pageId | Title | Content |
| --- | --- | --- |
| `story-list` | The story list | Summary cards, which server each story is linked to (or none), opening, favouriting, deleting. |
| `create-story` | Creating and editing a story | Every field of the form: Title, Type, Description, Genre, Language, Author, Theme, Extra notes, Favourite. |
| `story-type` | Linear or branching? | What changes in practice (the Choices menu only exists in branching), how to choose, **how to convert later** and what prevents the conversion from branching to linear — the screen lists the incompatible chapters before asking anything. |
| `story-settings` | Story settings | What exists only here and not in the creation form, and why: converting the type, collaborators, sending to a server, reader comments, normalising the scenes' timing, the favourites' behaviour. |
| `story-dashboard` | The story's dashboard | The summary cards, what each number counts, the shortcuts. |
| `story-analysis` | Story analysis | Every warning the analysis may show (an orphaned scene, a broken choice, etc.), what it means and how to fix it. One entry per diagnosis. |
| `import-export` | Importing and exporting | Exporting as a backup, importing creates a new story, what goes with it (and what does not), files from old versions. |
| `example-stories` | Example stories | The catalogue, choosing a language, installing generates a copy of your own and independent. |

### 3. The story's elements (`elements`)

One page per element, each with: what it is, an example, **a table of the screen's fields**, how it
relates to the other elements, and what happens on deletion.

| pageId | Title |
| --- | --- |
| `characters` | Characters |
| `character-relationships` | Relations between characters (includes the relations graph) |
| `chapters` | Chapters |
| `scenes` | Scenes (includes who takes part in the scene) |
| `scene-timing` | The scenes' timing and rhythm — Gap, Duration and "normalise timing" with an example timeline |
| `locations` | Locations |
| `location-map` | The locations map — "contains" (hierarchical) vs. "connected to" (a path between two) |
| `items` | Items |
| `item-journeys` | An item's journey — where it changed state or owner, scene by scene |
| `world-rules` | World rules |
| `notes` | Notes — loose or anchored to an element |
| `tags` | Tags |
| `gallery` | Gallery — importing an image/audio/video, reusing the same medium on several elements |
| `favorites` | Favourites — how to mark them and what changes in a shared story |

Points requiring careful writing (they are not obvious on screen today):

- **Character:** the difference between *Biography* (what has already happened) and *Planned timeline*
  (what you intend to happen); *Strengths* vs. *Weaknesses* vs. *Personality*.
- **Chapter:** *Order* is the reading order, not the world's chronology — although you may use it
  as chronology if the story is told in order.
- **Scene:** *Starting scene* and *Final scene*, and their effect on the map and the analysis; the Location
  is required; *Gap* (the time since the previous scene) vs. *Duration* (how long the scene lasts),
  each with its unit — from hours to eras.
- **Item / Journey:** the *Initial state* vs. the state recorded at each stop of the journey;
  the current owner vs. a change of owner in a scene.
- **Gallery:** the same medium imported once may illustrate several elements; deleting the link
  is not the same as deleting the medium.
- **Favourites:** what *global*, *individual* and *individual public* mean when more than one
  person works on the story.

### 4. Branching stories (`branching`)

| pageId | Title | Content |
| --- | --- | --- |
| `branching-basics` | How branching stories work | The reader chooses, the story diverges; what comes to exist in the app. |
| `choices` | Choices | The source scene → the choice's text → the target scene; the choice's notes. |
| `story-map` | The story map | Reading the graph, finding dead ends and unreachable stretches. |
| `choice-conditions` | Conditions for a choice to appear | Check groups, "all" (AND) vs. "any" (OR), a check that **blocks** vs. a check that **enables**, and the three types: visits to a scene, having/not having an item, a flag on/off. |
| `effects` | The effects of a scene or a choice | Grant an item, take an item, set a flag, unset a flag — edited inside the scene/choice itself. Emphasise that it is mainly for the story analysis, but is also used as annotations for the same. |
| `story-state` | Inventory and flags | The "reader's state": what they carry and what has already happened; how effects write that state and checks read it. The page that ties the two previous ones together. |

### 5. Annotating and connecting (`annotate`)

| pageId | Title | Content |
| --- | --- | --- |
| `comments` | Comments | Commenting on a specific field of an element, the quoted excerpt, the five criticality levels and what each one suggests, seeing all the story's comments in one place, reader comments in a shared story. |
| `see-also` | See also | A free, mutual link between any two elements; when to use this instead of a tag or a note. |
| `custom-attributes` | Custom attributes | Creating your own fields per element type; the available types (text, long text, number, yes/no, date, suggestion); required, default value and order; where the field comes to appear (the form, the detail, the advanced search, the global search); the field's name is editable, its identification is not. |
| `suggestions` | Suggestion lists | Fields that suggest values already used in the story (a character's gender, race, relation type...); how the list grows; how to edit the list. |

### 6. Preferences (`preferences`)

| pageId | Title | Content |
| --- | --- | --- |
| `app-settings` | Application settings | The light/dark theme, the language, the local username vs. the server name. — and the difference between the app's theme and a story's *Theme* (subject). |

### 7. Account, servers and friends (`accounts`)

| pageId | Title | Content |
| --- | --- | --- |
| `what-is-a-server` | What a Keres server is | What it is for (synchronizing between devices and writing together), a local story vs. one linked to a server, you may simply use no server at all. |
| `add-server` | Registering a server | The server's address (the API's address, with no suffixes), creating an account, signing in, several servers at once. |
| `your-profile` | Your profile | The display name, your `@tag` (it is by that that friends find you), the avatar's colour and icon, the bio. |
| `change-password` | Changing the password | Step by step and what happens on the other devices. |
| `friends` | Friends | Sending, accepting, refusing and undoing; what the other side sees; why friendship is a prerequisite for collaborating. |
| `collaborators` | Writing together | Owner, writer and reader: what each role may do; adding/removing a collaborator; allowing reader comments. |
| `account-limits` | Account limits | The server may limit the number of stories, of elements and the media space; what you see on reaching the limit; why a registration may be refused. |

### 8. Synchronization (`sync`)

| pageId | Title | Content |
| --- | --- | --- |
| `sync-basics` | How synchronization works | Working offline and synchronizing later; what is sent; sending a local story to a server; media go with it (and take up your account's space). |
| `sync-conflicts` | When a conflict appears | What a conflict is, the field-by-field resolution window, keep mine/keep the server's, accept the deletion, postpone — and what each button actually does. |
| `activity-log` | Activity history | What generates a record, how to read the list and the detail, what "created at" and "updated at" mean, why an offline story's history does not keep everything. |

### 9. Help and solutions (`support`)

| pageId | Title | Content |
| --- | --- | --- |
| `troubleshooting` | Solving problems | It does not connect to the server, an expired session, a refused import, a medium that will not open, a story missing from the list. The format: symptom → likely cause → what to do. |
| `data-and-backup` | Your data and backup | Where the data lives, what leaves the device and what does not, backup by exporting, what happens on uninstalling. |
| `glossary` | Glossary | Only the terms that appear **in the interface** (scene, chapter, choice, flag, tag, collaborator, synchronize...), each with a link to the full page. |
| `faq` | Frequently asked questions | A `faq` block, each answer short with a link to the detailed page. |

**Total: 53 pages** (against 78 in the previous version — the 25 removed were pages about internal
tables, join relations and synchronization mechanics the user never sees; their useful content
was absorbed by the feature pages).

## 7. Implementation

### 7.1 The generated registry

`scripts/generate-help-index.js`, a mirror of `generate-example-stories-index.js`:

- it scans `src/help/content/<pageId>/<lang>.ts`;
- it writes `src/help/generated/registry.ts` with a static `import` per file and a
  `Record<HelpPageId, Record<string, HelpPage>>` map;
- it exports `export type GeneratedHelpPageId = 'what-is-keres' | ...`, making a broken link a
  typecheck error;
- it enters `apps/client/package.json`'s `prestart` and `export:web`, alongside the other two
  generators; the standalone script is `help:generate`.

### 7.2 Navigation

In `StorySelectionStack.tsx` **and** `MainSystemStack.tsx`:

```ts
export type HelpStackParamList = {
  HelpIndex: undefined;
  HelpPage: { pageId: string };
};
```

- `HelpStackNavigator` in the shape of `FriendshipStackNavigator` (`headerShown: false`, the drawer's
  header), extracted into a shared module since both stacks use it;
- `<Drawer.Screen name="HelpDrawer" ...>` with `listeners.drawerItemPress` resetting to
  `HelpIndex`, like the other drawers;
- position: the last item, after Settings (in the main menu) and after Story
  Selection (in the story menu);
- `title`/`drawerLabel`: `t('help_title')`.

### 7.3 `HelpIndexScreen`

- The sections in §6's order, with each page's `summary` and an icon per section; the "Start
  here" section open, the others collapsed.
- **A search bar fixed at the top** (§7.3.1).
- `setDocumentTitle` on focus, like the other screens.

#### 7.3.1 The help's search (`HelpSearchBar`)

Decided: the help does **not** enter the Global Search (which is scoped to a story and would mix
documentation with narrative content). Instead, the help screen itself has its own search —
it is the main path for whoever arrives with a specific question rather than wanting to browse the
index.

- **Scope:** the title, the summary, the keywords and the renderable text of all the page's blocks
  (paragraphs, lists, steps, examples, cells of the field tables, questions and answers of the
  `faq` block). The active language only.
- **An in-memory index:** built once, on the first render, from the registry — one
  record per page with the text already flattened and **normalized** (lowercase and unaccented), so
  that "historia" finds "história". There is no I/O and no database query: the content is already in the bundle.
- **Behaviour:** the same debounce as the entity lists; while there is text, the list
  grouped by section gives way to a **flat list of results**; clearing the field (the ✕ button or an
  empty field) returns to the index, with the sections in the state they were in.
- **The result:** the page's title, the label of the section it belongs to and an excerpt of the text that
  matched, with the term highlighted. Tapping opens the page.
- **Ordering:** matched in the title > in the keywords > in the summary > in the body; a tie resolved
  by the catalogue's order, so the result is stable.
- **No result:** a message with a shortcut to the "How to use this help" page and to "Frequently
  asked questions", instead of an empty screen with no way out.
- Nothing is persisted: the search keeps no history and does not survive leaving the screen.

### 7.4 `HelpPageScreen`

- It receives a `pageId`, resolves the active language with an `en` fallback.
- `HelpBlockRenderer` maps a block → a component, using `useTheme()`.
- `seeAlso` navigates with `navigation.push`, allowing going back page by page.
- An explicit error state for an unknown `pageId`.

### 7.5 i18n

New keys (navigation chrome only): `help_title`, `help_index_title`,
`help_search_placeholder`, `help_search_clear`, `help_search_results_count`, `help_no_results`,
`help_no_results_hint`, `help_page_not_found`, `help_language_fallback_notice`,
`help_section_*` (9), `help_field_column_*` (3).
Run `bun run locales:audit` at the end.

## 8. Tests

- **Catalogue integrity** (`src/help/__tests__/catalog.test.ts`): every catalogue page
  exists in `pt` and `en`; no orphaned folder in `content/`; every `seeAlso` resolves; no
  empty title/summary.
- **Field coverage** (`src/help/__tests__/fieldCoverage.test.ts`) — the source changed relative
  to the previous version. The reference is **not** the interfaces in `packages/shared/entities/` (which
  include fields invisible to the user), but `src/help/fieldSources.ts`, which declares, per
  page, which screen fields must be documented. That file is assembled from
  `entityFieldMetadata` (which already carries the UI labels and is what feeds the Advanced Search),
  plus an explicit list of visible fields missing from it (e.g. the starting/final scene, the order,
  the scene's gap and duration). The test fails naming the missing field.
  - A second test guarantees that **every property** of each entity in
    `packages/shared/entities/` is classified in `fieldSources.ts` as *documented* or
    *invisible to the user*. That way, a new field in the model forces a conscious decision instead
    of disappearing silently — without forcing us to document what the user does not see.
- **Jargon** (`src/help/__tests__/plainLanguage.test.ts`): it scans the renderable text of all the
  pages and fails if it finds terms from the blacklist (`ULID`, `tombstone`, `polymorph`, `FK`,
  `SQLite`, `Drizzle`, `JWT`, `endpoint`, `payload`, `schema` outside "Custom Attributes",
  `.tsx`/`.ts` file names, `isDeleted`, `deletedAt`, `storyId`, ...). It is the automatic defence
  of §2's principle no. 2.
- **The help's search** (`src/help/__tests__/helpSearch.test.ts`): the search function is pure and tested
  outside the screen — it matches without accents and case-insensitively, finds by keyword and by
  block text, respects §7.3.1's ordering and returns empty for a non-existent term.
- **Screens** (RNTL, with the client's mock pattern — `__esModule: true` and a self-sufficient
  factory): the index renders the sections, typing filters and swaps the index for the results
  list, clearing returns to the index, tapping a result navigates, each block type renders,
  an invalid `pageId` shows an error.
- `bun run typecheck` and `bun run lint` in `apps/client`; `bun run test:report` for the aggregate.

## 9. Delivery phases

| Phase | Scope | Verifiable outcome |
| --- | --- | --- |
| 1 | `types.ts`, `catalog.ts` (53 entries), `fieldSources.ts`, the generator script | `help:generate` runs, typecheck passes |
| 2 | Navigation in both stacks + the index + the page + the renderer + the i18n chrome | The drawer appears and navigates, with stub content |
| 3 | Sections 1 and 2 — Start here, Your stories (14 pages) | A new user can go from zero to their first story with the help alone |
| 4 | Section 3 — The story's elements (14 pages) | The field coverage test passes |
| 5 | Sections 4 and 5 — Branching and Annotate/connect (10 pages) | Comments and "See also" documented for the first time |
| 6 | Sections 6, 7 and 8 — Preferences, Account/servers, Synchronization (11 pages) | — |
| 7 | Section 9 — Support (4 pages), with links to all the previous ones | The catalogue complete, `locales:audit` clean |
| 8 | Contextual help: a `?` icon in each screen's header opening the corresponding page | The `screenName → pageId` map covered by a test |
| 9 | Update `docs/screen_flow.md` and `docs/project_plan.md` and point at the help in `README.md` | The technical docs consistent with the code |

## 10. Risks and open decisions

- **The volume of writing.** 53 pages × 2 languages is still the bulk of the effort; the structure
  (phases 1–2) is small. Phases 3–7 are independent and can be parallelised.
- **Ageing.** Mitigated by §8's tests: a new field in the model breaks the suite until somebody
  decides whether it is visible to the user.
- **Translation.** `pt` is the primary writing, `en` is a translation. The fallback avoids blocking a
  page's delivery while the translation is not ready.
- **Screenshots.** They stay **out** of v1: one image per screen in two themes and two languages
  ages with every UI adjustment and weighs on the bundle. The `path` block ("Menu › Friends › Detail")
  covers the need for locating things without that cost. Reassess once the text is ready.
- **`docs/` out of date.** `screen_flow.md` lists neither Comments nor Suggestions in the story
  menu, and `project_plan.md` describes neither comments, "see also", effects, choice
  checks, favourites nor collaboration permissions. The help will be written from the **code and
  the screens**; phase 9 fixes the docs.
- **Decided:** help pages do **not** enter the Global Search — it is scoped to a story and mixing
  documentation with narrative content confuses the results. The need is met
  by the help screen's own search bar, specified in §7.3.1.
