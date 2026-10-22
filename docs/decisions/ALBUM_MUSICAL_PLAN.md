# Music in scenes — plan (v4)

> Music is something a **scene** has, just as a comic scene has Sketch pages (`ScenePage`).
> It serves the story: score, tavern song, anthem, lullaby, table ambience. The heart of the
> tool is writing a song (lyrics, chords, melody) and **hearing a sketch of it**: a synthetic voice
> humming the notes. Publishing is secondary. **Runtime weight is a requirement**, not a detail: see
> "Performance budget".
>
> A survey that changed no code. Repo facts checked in October 2026; what was not checked
> is marked.

## Implementation state (October 2026)

Phases 1, 2, 3a and 3b done; of phase 4 only the music sheet. All in unsigned commits, with tests.

| Part | State | Where |
|---|---|---|
| Phase 1: `SceneMusic` (link to Gallery media), role, cue, integrity findings | done | `SceneMusicScreen`, `useSceneMusic` |
| Phase 2: `Song` (ChordPro lead sheet, sections, transpose with undo, syllable count, translation, ChordPro import/export), `sections` on the link, global search in the lyrics, Gallery owning `Song`, publication (appendix or after the scene; screenplay as Fountain lyrics), Story Analysis (deleted target, vanished section, whole song because of a vanished section, repeated label, mismatched translation, unused song), warning on exporting whole printed songs, example in Alice | done | `SongEditorScreen`, `musicChecks.ts`, `songPrint.ts` |
| Phase 3a: melody (closed ABC subset, one per section with inheritance), alignment with syllables, 2-octave keyboard, synthetic voice (hum, "ah", "la"), sliced WAV with hash cache (20 MB), karaoke, MIDI and ABC | done | `melody.ts`, `timeline.ts`, `voice.ts`, `SongAudioService.ts`, `MelodyPanel.tsx` |
| Phase 3b: chord accompaniment (guitar, harp, piano, violin; waltz, ballad, march, lullaby), alone when there is no melody | done | `accompaniment.ts`, `instruments.ts` |
| Phase 4: music sheet (CSV and Markdown) | done | `cueSheet.ts`, `CueSheetService.ts` |
| Phase 4: Skia staff with Bravura; linking a song to who sings it | **not done** | depends on demand (see below) |

**Spike (decision 15), measured in bun, not on a device.** 30 s of hummed melody:
- with JIT: ~6 ms; with the JIT off (`BUN_JSC_useJIT=0`, a proxy for an interpreter): ~210 ms;
- with accompaniment (30 s, 120 background notes): ~10 ms with JIT, 0.45–0.55 s without JIT (guitar, harp,
  piano, violin);
- the bar is 2 s on a mid-range device; the margin is ~4× over the proxy. **Hermes was not
  measured** (there is no Hermes VM in the repo, only the compiler) and neither was the mid-range device.

**Deviations from the plan**
- Route A (JS + `expo-audio`); route B (`react-native-audio-api`) was not evaluated, because A passed.
- The preview does not play a "small set of players" for the keyboard: it uses a single player that swaps
  file on each key (each tone is a short cached WAV). Key latency not measured.
- The cache discards the oldest written (not the least recently used): expo-file-system does not expose last
  access.
- A dynamic `import()` to load the synthesis only on play was **not done** (I did not check support in
  Metro/Hermes); the module is small and nothing runs until play is pressed.
- Karaoke: the player's clock is read every 120 ms; the line only re-renders when it changes.
- The song's duration shows in the editor (measured from the melody, or estimated from the chords); the song
  list shows key, tempo and meter, not the duration. **Suggesting the scene's duration from the
  song was not done.**

**The instruments are math, not samples, and have never been heard.** The first version had a
violin with no harmonics above the 6th, a piano with 3 partials and plucked strings fading out above the 6th (measured);
it sounded like a flute/organ. The second (Karplus-Strong strings with hammer and unison detuning for the
piano, band-limited sawtooth with body and bridge resonances for the violin) has harmonics up to the 8th–10th
measured, but that only proves harmonics are not missing, not that it sounds like a violin. Real sound needs
samples (raw PCM + credits), which did not go in. The **MIDI** file carries the accompaniment on its own
channel with the instrument's General MIDI program (nylon guitar 24, harp 46, piano 0, strings 48), so
the player can use its own sounds.

**Not verified** (only on a device or on the web): quality and naturalness of the voice and instruments
(ears untested; I checked pitch and spectrum by measurement), keyboard latency, iOS silent mode,
`expo-audio` with `blob:` on the web, the real cache size on a device.

## Decided

1. **Publication:** a "Songs" appendix at the end **or** the lyrics at the end of the scene where it is sung; the writer
   chooses (see "Publication").
2. **Names:** `Song` (the song) and `SceneMusic` (the scene's link).
3. **Music in every medium**, `generic` (book) included: the novelist links songs to scenes because the
   book publishes the lyrics at the end of the scene or the volume. No door hidden by medium.
4. **Counts toward the tier**, like `ScenePage`.
5. **A synthetic voice humming the melody** is the preview and is central (phase 3).
6. **Recording audio into the Gallery:** outside this plan.
7. **Sung excerpt:** `SceneMusic.sections` — each scene says which sections of the song appear in it.
8. **Second lyrics** (fictional language and translation): its own column on `Song` (see "Model").
9. **With no melody, each chord lasts one bar**; with a melody, the chord starts on the note of the syllable where it
   was written.
10. **One tempo and one meter per song.** Whoever needs more is outside Keres's target.
11. **Transposing rewrites** chords and melody for real, with undo.
12. **Second lyrics = `lyricsTranslation`** (in the database, `lyrics_translation`): the lyrics in the
    reader's language. `lyrics` is the sung one, in a fictional language or not.
13. **The appendix prints the whole song**, even if the scenes only use one section.
14. **Orphan section** (renamed or deleted): if any of the link's `sections` remain, what
    remains is printed; if none remain, **the whole song** is printed. **The Story Analysis warns**
    (see "Story Analysis"), not a validation of the screen's own; the export also says how many songs
    came out whole for that reason.
15. **Spike bar:** 30 s of melody rendered in up to 2 s on a mid-range device.
16. **Table `scene_music`**, singular.
17. **Melody per section, with inheritance** (phase 3a). Researched: the **strophic** form (the same melody
    for every stanza) is that of hymns, ballads and many pop songs ("Amazing Grace"); **verse–chorus**
    repeats the chorus and lets the verses vary; **through-composed** writes new music for each stanza. The ABC
    standard stores **one melody** and puts several stanzas under it (`w:` lines). Our model covers all three: a
    section with no melody of its own uses the previous one of the same kind (verse→verse), and any section can have its own. On screen this shows as "uses the melody of
    Verse 1", with no jargon, with a tap to write one of its own.

## Premises

1. **Music belongs to the scene, not the arc.** The medium only changes the vocabulary (`ARC_MEDIUM_TERMS`: screenplay
   "Music/Cue", campaign "Ambience", comic and storyboard "Score") and the publication default. `ARC_MEDIUMS`
   today: `generic, screenplay, comic, storyboard, campaign`. No new medium.
2. **Same mould as `ScenePage`:** the link points to **one of two things** — a `Song` made here
   or a Gallery item (audio or link). If the target vanishes on another device, the link survives with its
   note and shows "removed" (decision 9 of the Arc plan).
3. **Logic in `packages/shared`**, pure TS, tested in vitest, for client and API.
4. **Nothing third-party is published.** Gallery references never leave; lyrics only leave from a `Song`.

## Model

### `SceneMusic` (link, one row per piece of music in the scene)
`id, storyId, sceneId, rank, songId | null, galleryId | null (exactly one), role, cue, sections |
null, createdAt…`
- `rank` orders like pages (`rules/rank.ts`).
- `cue`: free text — "comes in when she opens the door", "cuts at the scream". It is the cue note.
- `songId` and `sections` are born **already in phase 1**, null, so phase 2 does not migrate.
- `role` and `sections` below.

### `role`: do the characters hear this music?
- **`in-world`** — exists inside the story: the tavern song, the anthem, the lullaby. The lyrics
  may appear in the text, because they are part of what happens.
- **`score`** — exists for whoever tells the story, not for whoever lives in it: a comic's score, an
  animation theme, table music during combat. It never enters the text.
- Publication: only `in-world` prints lyrics. Screenplay: a sung `in-world` becomes a Fountain `~` line
  (prints); `score` becomes a `[[ ]]` note (does not print).
- The same song can have both roles (sung by the bard in one scene, score at the funeral), so
  the role lives on the **link**.
- Default: `in-world` when the target is a `Song` with lyrics, `score` when it is a Gallery reference. Two
  values are enough; "table ambience" is `score` with the `campaign` medium's label.

### `sections`: the excerpt the scene sings
- A list of section labels (JSON); `null` = the whole song.
- Labels come from the lyrics' markers: `{start_of_verse: Verse 1}`, `{start_of_chorus: Chorus}`.
  The editor **numbers and requires a unique label** within the song (two "Verse" become "Verse 1" and "Verse 2").
- Lyrics with no markers = one implicit section; `sections` stays null.
- Renaming or deleting a section leaves the reference orphaned. Example: scene 9 sings the "Chorus"; later the
  writer renames the label to "Refrain" in the lyrics, and the link still says "Chorus", which no longer
  exists. Rule (decision 14): if any of the link's sections still exists, only it is printed; if
  none exists, **the whole song** is printed. The warning comes from the Story Analysis.
- `{chorus}` (ChordPro recall, "repeat the chorus here") prints only the label in parentheses, not the
  text again.

### Names in code and database
Repository standard (checked in `sketches.ts` and `storyArcs.ts`): camelCase property in TS
(`coverSourceHash`, `pageFormat`) and snake_case column in the database (`cover_source_hash`,
`page_format`); plural snake_case table (`sketches`, `scene_pages`). So: `Song.lyricsTranslation`
↔ column `lyrics_translation`; table `songs`; the link becomes `scene_music` (singular: "music" has no
plural in English), with columns `scene_id`, `song_id`, `gallery_id`, `role`, `cue`, `sections`, `rank`.

### `Song` (the song; one row with separate columns)
`id, storyId, title, notes, lyrics, lyricsTranslation, melody, key, tempo, meter, createdAt…`
- **Separate** columns, not a JSON `content` like the Sketch: the sync `update` is partial (the Sketch
  uses `PartialSketchSchema`), so lyrics and melody edited on different devices do not trample each other
  wholesale (I did not check whether the conflict is decided per field or by the row's version). And text in a
  column enters **global search** (`searchField`, as the Sketch does with name and description).
- `lyrics`: **what is sung**, in a **ChordPro** subset — `[G]Noite des[Em]ceu`,
  `{start_of_chorus: Chorus}`, `{key: G}`, `{tempo: 90}`, `{time: 3/4}`; syllables with a hyphen where
  the count matters. In a fictional language, it is the fictional lyrics. The melody, the karaoke and the syllable
  count follow this column.
- `lyricsTranslation`: optional, the lyrics in the reader's language, **without chords**, with the same section
  markers (a warning if they do not match). Only published; it does not play.
- `melody`: notes as text (an ABC-style subset; format closed in phase 3), reserved in the
  schema since phase 2.
- `notes` (sheet): narrative function, who sings, culture, metre and rhyme.
- **Caps** (calibrated on real lyrics, below): lyrics 16 KB (with chords), translation 16 KB, sheet 8 KB,
  melody 8 KB. Strict validator before push, versioned schema.

  Measurements on public-domain songs (Wikisource, text without markup, in bytes):
  | Song | Size | Note |
  |---|---|---|
  | Danny Boy (Weatherly) | ~0.9 KB | 21 lines |
  | Auld Lang Syne (Burns) | ~1.3 KB | verse and chorus |
  | Robin Hood and the Monk (Child 119) | ~11.3 KB | 369 lines, the long narrative ballad; the text
  includes a few editorial lines, so it is an upper bound |

  Chords add about 25% (a ~4.5-byte chord every ~5 syllables, my estimate): the longest ballad
  comes to ~14 KB with chords. Today's songs (long rap lyrics) stay at 5–7 KB. So 16 KB
  covers the real worst case with a small margin, and the 32 KB cap I had proposed was excessive. The melody
  counts in **bytes**, not notes: ~6 bytes per note as text, 8 KB ≈ 1,300 notes. I did not measure scores;
  the note estimate comes from one note per syllable (a 4-line hymn ≈ 28 notes per stanza; a
  pop song with verse, chorus and bridge ≈ 200 distinct notes, 400–550 if everything were written out in full).
  **Synthesis cost depends on the time played, not on what is stored**, and the preview cap already
  limits it.
- **Gallery:** `GALLERY_OWNER_ENTITIES` gains `'Song'` (today: `Character, Location, Note, Scene, Item,
  WorldRule`; the type makes the compiler point at every missing `case`). It gives a listening reference (link),
  a scanned or Sketch-drawn score and reference audio.

## Phases

Each phase pays for itself and tests the demand for the next.

### Phase 1 — Scene music by reference (no `Song`, no generated audio)
- `SceneMusic` only with `galleryId` (audio or link) + `role` + `cue`.
- `SceneMusicEntry` on the scene, beside `ScenePagesEntry`, in **every medium**; in `generic` the row is
  discreet ("Music" and the count). Full screen in the mould of `ScenePagesScreen`.
- Fountain: the cue becomes the note `[[MUSIC: title — cue]]`. Comic/storyboard: text alongside the page.
- Story Analysis: the two phase-1 integrity findings (deleted target; double or empty pointer).
- Cost: **one** new entity (see "Cost").
- The question it answers: do writers note music per scene? If not, stop here.

### Phase 2 — `Song`: lyrics with chords
- Entity `Song`, library (beside the Sketch list), `SceneMusic.songId` and `sections`, `Song`
  as Gallery owner, global search in the lyrics.
- A lead sheet editor **in text**: chord over the syllable, sections, **transpose**, syllable count per
  verse (a PT/EN heuristic labelled as an estimate; fictional language = manual hyphenation), a section
  picker on the link screen, a translation field.
- ChordPro import/export. Estimated duration (bars × beats ÷ BPM), which can suggest the scene's
  duration (the screenplay already has `duration`).
- Publication (below). Music findings in the Story Analysis (table above). An example `Song` in one
  of the example stories.

### Phase 3 — Melody and the hummed preview
**3a. Melody + voice.**
- **Model:** MIDI-like events (pitch, start, duration), a single voice. The melody is not tied to the lyrics
  by position: the lyrics show the notes aligned by order and **warn when the count does not match**
  (syllabification is never perfect). Rests and ties are events.
- **Melody per section, with reuse.** A strophic song (a 78-stanza ballad, a 4-line hymn)
  repeats the same melody: the melody is stored **once per section**, and the next section of the
  same kind (verse after verse) inherits the previous one when it has none of its own. What is stored is what
  was written, not what is played; 78 stanzas do not cost 78 melodies, and the count warning runs per
  stanza.
- **Input:** a slidable 1-to-2-octave keyboard that plays the tone; **one note per syllable** with a duration
  selector; tapping an existing note edits it. Alternative: typing in text.
- **Voice:** source–filter synthesis, **monophonic** — glottal pulse, 3 formants, vibrato with a delayed
  onset, short portamento, envelope. Timbres: **hum** ("mm", the most believable), "ah",
  "la". `expo-speech` discarded: it does not tune per note.
- **Preview:** the melody plays with the lyrics following (karaoke) and an optional click (mixed into the WAV, not
  scheduled in real time). Keyboard with short pre-rendered tones.
- **Technical route**, to be decided by the measurement spike:
  - **A.** Synthesis in JS, offline render to WAV, played by `expo-audio`. No native module.
  - **B.** `react-native-audio-api` (Software Mansion; a Web Audio API in C++, serves RN and web). I did not
    confirm the licence, Expo 57 support or `OfflineAudioContext`; it is a native module and needs a
    development build.
  - Web and iOS silent mode tested separately on both.
- **Export:** the same event model writes standard MIDI (`.mid`) and ABC.

**3b. Chord accompaniment.** From the chords it generates harp, guitar, violin and piano in a groove (waltz,
ballad, march, lullaby): voicing per instrument and pattern per groove, which need their own design. Harp and
guitar by Karplus-Strong, violin and piano procedural; piano from a sample only if the procedural one sounds
unacceptable (needs raw WAV/PCM — decoding MP3/OGG in JS is not viable — and credits). **The whole
band only comes in if the 3a spike passes with room to spare**, because several voices multiply the cost.

### Phase 4 — Optional
Skia staff, Bravura, music sheet (cue sheet: scene, cue, role, reference, key/BPM, duration,
lyrics) for a composer, linking a song to who sings it.

## Publication

- `includeSongs` (default off) and `songsPlacement`:
  - **`appendix`** — a "Songs" appendix at the end (`songsHeading`), like the loose scenes
    (`looseHeading`, `includeLooseScenes`). Each song **whole, once**, in the order of the first
    scene where it is `in-world`, only from included scenes (respects arc and filters).
  - **`after-scene`** — the lyrics right after the scene's text, in italics, **only the link's `sections`**.
    No anchor in the middle of the text: the scene body has no insertion point.
- Only `in-world` prints. A `score`-only song does not come out, even with lyrics.
- **Language:** `songLanguage`: `sung` (default), `translation` or `both`. `both` puts the sung lyrics and,
  right below, the translation, section by section (the markers match the two). Without a translation, `both` and
  `translation` fall back to `sung`.
- **`songRepeat`** (`after-scene` only): `first-only` (default) or `every`. Each **section** of a song
  is only printed the first time it appears in the book; in other scenes, what already came out becomes only the title
  (`♪ Lullaby`). With `every`, it always prints. This avoids the whole lullaby three times, and
  lets scene 2 print the verse and scene 9 the chorus without conflict.
- `songChords` (off): chords alongside the lyrics, for a songbook.
- **Screenplay (Fountain):** sung `in-world` → `~` lines; `score` → a `[[ ]]` note. Keres's own import
  already keeps `~` and discards notes (the notes do not come back).
- **Comic/storyboard:** title and cue come out in the page/panel text.
- **Published reader:** lyrics only, no audio or reference. The songs' size enters the manuscript
  size estimate (`estimateManuscriptBytes`), which already aborts early.

## Story Analysis

The module (`apps/client/src/utils/storyAnalysis/`) separates **integrity** (a reference to something that does not
exist; true in any work, always on) from **opinion** (behind `completenessChecks`,
off by default). The orphan section is integrity, and the rest of music splits the same way. A new file `musicChecks.ts`, category
`'music'`, `analysis_*` keys with EN/PT text, findings anchored on the **scene** (already navigable) so as not to
require a new screen.

| Finding | Severity | Kind | Phase |
|---|---|---|---|
| Link points to a **deleted** `Song` or Gallery item (media removed) | warning | integrity | 1 |
| Link with `songId` and `galleryId` at the same time, or neither (the server refuses; an outside package may bring it) | error | integrity | 1 |
| `sections` cites a label that **no longer exists** in the lyrics (partial: prints what remains) | warning | integrity | 2 |
| All of the link's `sections` vanished (**prints the whole song**) | warning | integrity | 2 |
| Section label **repeated** in the lyrics (the `sections` become ambiguous) | warning | integrity | 2 |
| `lyricsTranslation` with sections that **do not match** `lyrics` | warning | integrity | 2 |
| A song no scene uses (`analysis_song_unused`) | warning | **opinion** (enters `COMPLETENESS_FINDING_KEYS`) | 2 |

Outside the Story Analysis, on purpose: syllable count against the melody and extra or missing notes
are **opinion about a draft** and stay in the editor, where the writer is looking at them.

**Cost.** The cheap path runs on every change to the story (the panel's seal) and must be O(links):
- Only the link's data goes in and, **only for songs with `sections` on a link**, the list of labels
  extracted from the lyrics by a simple marker extractor (`{start_of_*: label}`), cached by the song's
  version. The Story Analysis never analyses melody or estimates syllables.
- Nothing reads the lyrics of songs with no link carrying `sections`; the "repeated" and translation findings only
  run for those same songs.
- The two phase-1 findings read no lyrics at all.
- The extractor is the same as the editor's and the manuscript's (a single rule for "which section is which").

**Bills to pay:** a new category in the type and in the analysis screen, EN/PT messages, and tests in the mould of
`storyAnalysisChecks.test.ts`.

## Performance budget

Principle: **nothing runs unless the user asks** and **nothing weighs where they are not using music**. The
numbers are targets to validate in the spike, not measurements.

**Outside the music screen**
- The scene only pays one light query (titles and count of `SceneMusic`); no reading of lyrics or melody.
- The song list shows title and cached duration; it does not analyse the lyrics.
- The music and synthesis modules **do not load at app start**: only on opening the screen and on play
  (lazy loading; check dynamic `import()` support in the Metro/Hermes configuration).

**Lead sheet editor**
- Each line is a few `Text`s: the "chord + text up to the next chord" segment becomes a stack; the rest of the
  line is a single `Text`. **Never a stack per syllable.**
- Lines in a virtualized list; each line in `React.memo`; text analysis debounced and only of the
  changed lines.
- Autosave debounced (idle ~1–2 s and on leaving): **one sync operation per save**, never per
  keystroke. Lyrics and melody never go to sync beyond the text.
- Melody keyboard with 25 fixed keys; melody limited in bytes (8 KB), rendered per line in a
  virtualized list.

**Synthesis and preview**
- **Only on play.** No render on open, no render in the background.
- WAV 22.05 kHz, mono, 16-bit (≈ 2.6 MB/min), preview limited to 60–90 s or to one chorus.
- Inner loop in `Float32Array`/`Int16Array`, no per-sample allocation; render **in slices** that
  yield the JS thread between one and the next (RN has no worker), with a progress bar and cancellation on
  leaving the screen.
- **Cache by hash** (melody + tempo + timbre): if nothing changed, play the file; if it changed, render
  again. A temporary cache with a cap (proposal: 20 MB, discards the oldest) and cleanup; never
  syncs.
- Keyboard tones rendered on the spot the first time the editor opens (25 × 0.5 s, hundreds of
  thousands of samples, little), kept in a small set of players and **released on leaving**.
- Karaoke: position read at ~4–10 Hz and only the current line re-renders; no 60 Hz animation loop.
- **Spike criterion (decision 15):** render 30 s of melody in at most 2 s on a mid-range device,
  without freezing the UI. A 3-minute song exceeds the preview cap: the preview plays a
  **section** of choice (or the first 60–90 s). If it fails: reduce to 16 kHz, fewer formants, a shorter preview, or route B.
- Full band (3b) only with 3a inside the target.

**Publication**
- Plain text; no audio. Cost equal to a scene's.

## Copyright

- A reference (Gallery) is from the writer to the writer: never published.
- A `Song`'s lyrics may be a third party's; the app does not know. A warning in the editor ("own lyrics; for
  someone else's song, keep the link"), and `includeSongs` off by default. It also applies to imported
  ChordPro.
- Samples (3b only, if they come): each one enters `THIRD_PARTY_CREDITS`
  (`packages/shared/metadata/AppRelease.ts`; `appRelease.test.ts` fails if one is missing). Salamander Piano V3
  is CC-BY 3.0 (Alexander Holm, with a subset note), VSCO-2 CE is CC0, Bravura is SIL OFL. A sample as
  data does not contaminate the app's MPL-2.0. Verovio is LGPL-3.0: discarded.

## Real cost of a new entity (from experience with `ScenePage`)

Each one (`SceneMusic`, then `Song`) requires: entity, schema and handler in `shared`; API handler
and PG and SQLite migrations; client table and migration + `generate-indexes`; sync handler; export
collection and package import; `cloneExampleStory` and the example JSONs; `tierCounting` (they now
count); local purge of the story; Story Analysis findings; EN/PT texts; help; vocabulary per medium; tests at each layer.

## Open questions

None. The two points that remained were closed (decisions 16 and 17).

## Risks and notes (no pending decision)

- **Verification on a device and on the web** (keyboard latency, voice quality, iOS silent mode,
  web audio) is only discovered there; reserve time when phase 3 arrives, as in the Arc plan.
- **Unvalidated demand.** No story-planning competitor does this (World Anvil only
  embeds music). That is why phase 1 is small and 3 only comes after 2 has been used.
- **The note estimate** did not come from scores; it comes from one note per syllable. Worth checking against
  real melodies in phase 3.
- **Edit conflict** on the same `Song` on two devices: I did not check whether it is per field or by the row's
  version; separate columns help in both cases.
