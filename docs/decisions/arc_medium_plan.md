# Arc as a work: medium, scene pages, screenplay and per-Arc release

**Status:** implemented (phases 1–7, October 2026); see "Implementation state" at the end for deviations and what was left out. The user's decisions of 2026-10-06 are incorporated.
**Mental model (do not change):** the Story is the universe (world, calendar, base vocabulary, permissions, sync). The Arc is
the work inside it: book, film, issue, season. **There is no canon shared between Stories** (cross-story sync and
permissions), and linear/branching are not mixed (the shape belongs to the Story; if there is demand, it becomes another decision).

## Frozen decisions

1. **Per-Arc release** publishes only the manuscript and the reader, with no zip. The zip belongs to the whole Story (the universe).
2. **Tier:** `maxPublishedArcs` (Arcs with at least one live version, per story; deleting the last version frees the
   slot; `null` = unlimited). The daily publication cap still applies separately.
3. **`ScenePage` with text per page.** `Scene.body` stays free. The UI says Keres is a sketch tool: it does not publish at
   final comic/animation quality (Sketch is not, and should not be, a professional tool).
4. **Screenplay:** `Scene.body` is Fountain; the scene heading is generated from Location + time **only if the body does not
   start with a heading**, with an explicit indicator/button. Without a calendar time, the heading comes out without a time; the user's text wins.
5. **Campaign is a medium** with a convenience pack and a chronicle template; quick capture only appears there.
6. **Packs are never mandatory**, only convenience. A pack can mark the default Arc with a medium and report what it turned on.
7. **Each Arc has its medium; each Arc can have its vocabulary.** The medium provides friendly default terms.
8. **`ScenePage` counts toward the tier's entity limits;** what counts is reviewed before the release.
9. **Removed media:** the page survives as "media removed" and stays out of the manuscript; the UI offers to replace it with
   other media (Sketch or Gallery). Never delete the page's text in a cascade.
10. **Cover per Arc and per Story** (`coverGalleryId`, optional) in any medium.
11. **Author per Arc** (`StoryArc.author`, nullable; falls back to `Story.author`, then to the user's `@handle`).
12. **Loose scenes:** `includeLooseScenes` already exists (default `false`). With `false` no scene without a chapter goes into an
    Arc release; with `true` they go into **every** Arc. Confirm in the isolation test and warn when publishing.
13. **Fonts:** a curated list of free (OFL) fonts, pinned and embedded in the PDF; the default stays today's. No user font
    upload (licence, weight). DOCX/EPUB/HTML only name the font; the reader needs to have it.
14. **Search in lists:** the active arc's filter + "+N results outside this arc" (tap to see). Global search
    stays unfiltered, with an arc label.

## 1. Medium on the Arc

- `StoryArc.medium`: `generic` (default) | `screenplay` | `comic` | `storyboard` | `campaign`. A name distinct from
  `Story.type` (`linear | branching`).
- **Output profile, never a data rule:** it picks default terms, a compilation template, a page preset and UI shortcuts.
  Every entity stays available in any medium. Changing the medium migrates no data (pages and texts
  persist, they just stop being compiled/shown if the new medium does not use them).
- No medium default on the Story. A new Arc starts `generic` (or copies the active arc's medium on creation).
- The **Story creation form** gains the "kind of work" field (medium), which already creates the default Arc with it. Packs
  can fill it.
- It goes into package export/import (`storyExportMigrations`), sync, clone, packs, publication snapshot.

### Term resolution (vocabulary)

Precedence, from most specific to most general: **Arc vocabulary > Story vocabulary > the medium's default terms
> app default.** A term the user chose explicitly is never overridden by a default.

- `StoryArc.vocabulary` (nullable; stores only the terms the user overrode). Inside an Arc, the vocabulary screen
  edits **that Arc's** vocabulary; outside an Arc ("All"), it edits the Story's. A term with no override
  inherits (live) from the Story and, below it, from the medium. There is no "copy from another Arc": the medium already brings friendly terms.
  Each term and the whole screen have "restore" (removes the Arc's overrides).

### "All arcs" mode

There is no single medium in that mode (decided):

- Lists and menus use the Story's terms (Story vocabulary, else the app default); no medium terms.
- A single item's screens (scene, chapter) adapt to the **item's own arc** (scene → chapter → arc): a comic scene opens with
  pages, a screenplay one opens with a screenplay heading, even in "All". A loose scene (no chapter) uses the active arc
  or, in "All", `generic`.
- Shortcuts that depend on a medium (quick session capture, Fountain export) only appear when there is an active Arc of that medium.
- A new chapter in "All" lands in the default Arc (current behaviour).

## 2. Per-Arc release

- `story_publications.arcId` (nullable; old versions = whole story). Label uniqueness and retention (5) per
  `(storyId, arcId)`.
- Arc version: `packageIncluded = false`, manuscript and/or reader with `arcId` (the compiler already isolates by Arc and cuts
  gamebook edges that leave the arc). Refuse (400) an Arc version with `packageIncluded = true`.
- Showcase: the Story page lists Arcs as works (cover, name, author, versions, reader). The zip only on the universe version.
  The publication snapshot keeps the Arc's title, author, cover and medium as they were.
- Tier: `maxPublishedArcs` (column, PG/SQLite migration, admin Tiers page, public tier schema, parity tests).
- Onboarding: "The story is the universe; each Arc is a work inside it" on the dashboard, in Story creation and in
  help; check whether the term Arc can be renamed through the vocabulary.

## 3. Covers

- `StoryArc.coverGalleryId` optional, picked from the Gallery. Used in the showcase, on the manuscript cover and in the Arc picker.
- `Story.coverGalleryId` optional for the universe (the Story page in the showcase and the universe version). An Arc without a
  cover of its own does not inherit the Story's in the manuscript.

## 4. Search and Arc

- See decision 14. Pending: read the current search behaviour inside the lists before implementing.

## 5. Location interior/exterior

- `Location.setting`: `interior | exterior | both | none` (nullable). Migration, sync, schemas, import/export, packs.
- Used only by the screenplay (`INT.`, `EXT.`, `INT./EXT.`); `none`/null produces no prefix.

## 6. Screenplay (Fountain)

- `Scene.body` = Fountain text. Screenplay mode shows above the body: location, interior/exterior, cast, time.
- Fountain export: title page (the Arc's `Title`, `Author` per decision 11, empty `Contact`), chapter → `#`,
  scene summary → `=`, generated heading (decision 4), emphasis → `*`, `**`, `_`, comments → `[[ ]]` (optional),
  `#n#` numbering (optional), `===` where the user marks.
- Fountain import: splits into scenes at the headings; **suggests** (does not create by itself) locations and characters by name.
- PDF to industry standard; FDX later, if there is demand.
- Explicit UI indicator: "Heading generated from the location; write a heading at the start of the text to
  replace it".

## 7. PDF layout and page estimate

- Today's PDF uses embedded fonts (fontkit, subset, matrices pinned in `pdfFonts.manifest.json`). New fonts
  enter the manifest with a sha256, like the current ones.
- **A second layout, "screenplay"**, beside the current one (the prose one does not change): Courier Prime (OFL, Courier metrics),
  12 pt, 10 cpi, 6 lpi, margins L 1.5" / R 1" / T 1" / B 1"; indents from the edge: scene/action 1.5", dialogue 2.5",
  parenthetical 3.1", character 3.7"; page number in the top right corner from page 2; a character
  name is never left alone at the foot; `(MORE)`/`(CONT'D)`. Goal: the PDF being the real screenplay when that is feasible in a
  simple way; comparing with Highland/Final Draft is a quality check, not a blocker.
- **Generic:** a classic manuscript preset (12 pt, double spacing, 1" margins) with the prose layout's font.
- The page estimate uses the **same engine** as the PDF; the "How we estimate" card shows paper (Letter/A4), font, size,
  spacing, margins and indents. DOCX reflows in Word and can differ.

## 8. Manuscript size limit (system review)

Today `MAX_MANUSCRIPT_BYTES` (50 MB) is only checked **after** compiling (`compileStoryManuscript.ts`, `storyReader.ts`),
so the user only finds out about the overflow at the end. Page images make this critical. Proposed review (its own phase,
before `ScenePage`):

- **Estimate first:** page images are resized **before** compiling (known size), text has a conservative quota per format and there is
  a fixed overhead per format. Show the estimate and the margin on the export/publish screen.
- **Abort early:** the PDF writer already releases per page; sum bytes while writing and stop at the limit, instead of
  finishing and throwing the result away.
- **Budget per page** (maximum resolution and quality per preset), with a warning when nearing the cap.
- Reassess the cap (split between text and image? tied to tier/storage?) and the bloat of the self-contained HTML
  reader (base64 images).

## 9. Scene pages (comic and storyboard)

- New entity `ScenePage`: `id, storyId, sceneId, position, sketchId | galleryId (exactly one), fit, text`, plus standard
  sync fields. `fit`: `contain` (centred) | `cover` (centred crop).
- Text per page: numbered balloons on the drawing; `text` says what each balloon holds. `Scene.body` free.
- The page size comes from the Arc (presets: A5, comic US, B5/manga, 16:9). The terms Page/Panel/Shot come from the medium
  (decision 7), overridable.
- Snapshot: a page with a Sketch uses the Gallery PNG (the sketch's `coverGalleryId`); if the drawing changed since the snapshot
  (`updatedAt`/hash), the client **regenerates before publishing/exporting**. The server only consumes what the client sent.
- Compilation: the page image followed by its `text` (DOCX/PDF/EPUB/HTML), subject to §8.
- Decision 9 for removed media.
- Mandatory lifecycle: create, update, delete (tombstone), reorder (disputes the whole order), sync/OCC, conflict,
  export/import, clone, linear/branching conversion, tier entity limits (decision 8).
- Notice in the UI and in help: Keres is a sketch tool; final-quality comics/animation need a professional tool.

## 10. Campaign

- Medium `campaign`. The `campaign` pack (EN+PT) is convenience: on story creation it marks the default Arc as a campaign,
  reports the modules it turned on and seeds vocabulary (Chapter → Session), a real-date DATE attribute, tags (NPC, faction,
  quest) and world sections. Everything editable/removable; without the pack the medium works the same.
- Session = chapter; what happened = a **list of scenes** (can be short).
- A "chronicle" compilation template: session by session, "the story so far", "previously".
- **Quick capture** (a screen only in the campaign medium, with an active Arc): "New session" asks **only for the real date** (today by
  default), suggests the next number and opens straight into the text, with the first scene created and a "+ scene" button. Cast present
  can be marked per scene. The in-world date is not asked (it follows attributes/timeline, or whoever records resolves it). No new data;
  draft kept if the screen closes without saving.
- A limitation to record in help: no per-field/entity visibility; readers see everything.

## Order

1. `medium`, `vocabulary`, `cover`, `author` on the Arc + a field in the Story form + Arc onboarding.
2. Per-Arc release + `maxPublishedArcs`.
3. `Location.setting` + screenplay mode + Fountain export.
4. Size-limit review (§8) and "screenplay" PDF layout + page estimate + font picker.
5. `ScenePage` + comic/storyboard compilation.
6. Campaign medium: pack, chronicle template and quick capture.
7. Fountain import; FDX if there is demand.
8. Per phase: help and tips (EN+PT), `feature_inventory.md`, `FEATURE_LANDSCAPE.md`, example matrix.

## Verification

A lifecycle test with a real database and API integration per new entity/column; PG/SQLite parity in the
migrations; an isolation-by-Arc test on publication (an Arc version never contains a zip or another Arc's content,
`includeLooseScenes` included).

## Implementation state (October 2026)

Done, by phase: **1** medium, vocabulary, cover and author on the Arc, field on the Story, onboarding; **2** per-Arc release
and `maxPublishedArcs`; **3** `Location.intExt`, screenplay mode, Fountain (export and import); **4** size
system (estimate first, abort early), screenplay PDF layout, page estimate (screenplay and prose); **5**
`ScenePage` with image compilation (HTML, EPUB, DOCX, PDF and reader), `Sketch.coverSourceHash`, `Arc.pageFormat`;
**6** campaign (pack, "chronicle" preset, "New session"); **7** Fountain import.

Deviations and leftovers, stated so they do not look like an oversight:

- **Pack and medium:** the pack schema does not carry a medium, so the `campaign` pack does not mark the Arc (the medium is chosen
  in the Story form) and does not "report what it turned on". It is content convenience only (real date, tags, notes).
- **New session:** asks only for the date and opens the first scene; "+ scene" is the one in the elements list. No markable cast in it and
  no kept draft. Without the `session_date` field (pack), the date goes in the chapter summary.
- **Removed media (decision 9):** the page stays out of the manuscript, with no number; the export says how many were left out.
- **DOCX:** does not crop; a `cover` page appears whole, inside the frame.
- **Publication:** the server only reads what the client sent. A changed Sketch is redrawn on the client before publishing,
  and that new snapshot must sync before a new attempt.
- **Search (decision 14):** "+N outside this arc" in Characters, Locations, Items and in the Narrative Elements list (chapters found by search in other arcs).
- **Fonts (decision 13):** not implemented (needs OFL fonts with a sha256 in the manifest, matrices and visual verification).
- **Screenplay heading with a time:** not implemented; the heading comes out without a time, as decision 4 provides when there is no calendar.
- **FDX:** only if there is demand.
- Not verified on a device: Sketch snapshots (Skia) and PDFs with images were covered by tests, not seen.
