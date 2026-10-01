# Guided tours

Short first-open tours, one per screen. Rationale and rollout history live in
`.agents/plans/2026-09-19-guided-onboarding-first-story.md`; this note is the
how-to for adding the next one.

## Rules (from the onboarding research)

- At most 4 steps per tour, one idea per step, benefits over feature lists.
- Skip is always visible; finishing or skipping marks the tour seen.
- Drawer guidance uses semantic groups (max 3 per drawer), never item by item —
  and only the two entry tours walk the drawer at all. Later tours stay
  screen-only so the drawer is toured exactly once.
- No tours in ColdInstall (no settings row yet), AppSettings (the control
  panel), Help, or Detail/Form screens — except creation forms on the
  first-story trail.

## Adding a tour

1. Register the guide in `apps/client/src/guides/registry.ts`, keyed by route
   name (the same vocabulary as `screenHelpPage`). Keep 1–4 steps; point
   `helpPageId` at the matching help page.
2. Place anchors with `useGuideAnchor(id)` on host `View`s
   (`collapsable={false}` on Android). Screen ids come from `screenAnchorId`,
   drawer entries from `drawerAnchorId` (already registered per item by
   `AnchoredDrawerItemList`). Steps without measurable anchors degrade to a
   card — by design, not by accident.
3. Call `useScreenTour('<route>')` in the screen. For creation-only tours,
   resolve edits to an id with no guide (see `StoryFormScreen`).
4. Write the copy in `en.json` + `pt.json` (`tour_*` keys, alphabetical) and
   run `bun run locales:audit` from the repo root.
5. Cover the wiring: extend `test/guides/registry.test.ts` keys, and mock
   `useScreenTour` in the screen's test with a called-with assertion.

## Plumbing

- `state/guideStore` holds the playing tour; `components/.../GuideHost`
  (mounted once in `App.tsx`) renders the overlay: a touch-blocking backdrop,
  a 4-view spotlight mask, and the card. The card renders first; the
  spotlight is an enhancement.
- Persistence is `client_settings.show_tutorials` + `seen_tutorials`
  (`{version, seen[]}`, plus the `firstStory` trail object), mirrored in
  `userSettingsStore`. `AppSettingsScreen` owns the switch and the reset.
- Dismissing is recorded twice: synchronously in
  `guideStore.dismissedGuideIds` (otherwise the focus effect re-fires before
  the database write lands and replays the tour), then durably via
  `useGuidePersistence`. A failed write undismisses so the tour can show
  again; the tutorials reset and `resetAllClientStores` clear the session
  record.
- "Later" (`snoozeTour`) only closes the card: `snoozedGuideId` blocks the
  reopen while the focus lasts, and `useScreenTour` lifts it on blur, so the
  tour returns on the next visit without ever being marked seen.
- The first-story trail is entered from a persistent banner on
  `StorySelectionScreen` (visible with or without stories until done or
  dismissed) and completes on the first dashboard arrival.
- Showcase captures set `showTutorials: false` in `prepareShowcase`, and
  `useScreenTour` also refuses to start under a showcase request.
