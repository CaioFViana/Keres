# Keres icon pack — third-party notices

The `.svg` files in this directory are vendored from
[game-icons.net](https://game-icons.net)
([sources](https://github.com/game-icons/icons), HEAD
`82d948812bfe3f269ef8f731dcdb07b08160edc4`), renamed to the `name` recorded in
`../keresIcons.json`, otherwise unmodified.

They remain under their original license and are NOT relicensed under this
repository's license:

- Creative Commons Attribution 3.0 Unported (CC BY 3.0)
  <https://creativecommons.org/licenses/by/3.0/>
- Authors of the vendored icons:
  - Lorc — <http://lorcblog.blogspot.com>
  - Delapouite — <https://delapouite.com>
  - Carl Olsen — <https://twitter.com/unstoppableCarl>
  - Skoll — <https://game-icons.net> (no personal link published upstream)
- Per-icon author and upstream slug live in `../keresIcons.json`
  (`author` / `source`); the in-app credits screen reads that manifest.

Adaptation note (CC BY): at build/render time Keres drops the source files'
black background path and recolors the white glyph path with the icon's tint.
The vendored files themselves keep the original artwork untouched.

To refresh or extend the pack: clone the upstream repo, copy new files here
under their Keres `name`, add a manifest entry, and regenerate the consumers
(`bun scripts/generate-keres-icon-paths.ts`).
