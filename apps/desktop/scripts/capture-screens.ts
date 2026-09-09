/**
 * Takes the screenshots of the app's screens for the website's showcase.
 *
 * It runs the real app inside Electron - the same host the desktop app ships to users - and
 * photographs each requested screen. No automation browser: Electron is already a dependency
 * here and already provides what the web app needs (the `app://` protocol with COOP/COEP,
 * without which the browser's SQLite will not open).
 *
 * Each photo comes from a URL the app's showcase mode understands (see `showcaseRequest.ts`), so
 * there is no click to simulate: open, wait, photograph.
 *
 *   bun run desktop:capture
 */
import electronModule from 'electron';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imported from outside Electron, the `electron` package exports the binary's path - the
// published typings describe the main-process API, which is the other side of the same package.
const electronBinary = electronModule as unknown as string;
const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = resolve(desktopRoot, '..', 'client');
const outputDirectory = resolve(desktopRoot, '..', 'site', 'public', 'showcase', 'screens');

/**
 * The showcase screens.
 *
 * `story` picks the example story, and each screen uses the one that fills it best: the story map
 * needs a branching one, the large cast lives in Kaguya, the plots in Cinderella.
 */
const ONLY = process.env.KERES_CAPTURE_ONLY;
/**
 * Only the compact graphs ask for "fit to screen": on the large ones (story map, matrix,
 * timeline) fitting shrinks everything to the point of being unreadable, and the photo looks
 * better with the drawing at real size running past the edge - which is how the app presents
 * itself when it opens.
 */
const FIT = { en: 'Fit to screen', pt: 'Ajustar à tela' };
/**
 * Two screens per example story on purpose: a single-story showcase looked like an app for
 * one tale. Goldilocks previously had none; Cinderella had four.
 */
const SCREENS: Screen[] = [
  // Goldilocks — expand a chapter so scenes appear under it (same in-list expand as characters).
  {
    name: 'narrative-elements',
    stack: 'NarrativeElementsStack',
    story: 'goldilocks',
    // Chapter row title is `${index}. ${name}`; match the bare name so icon glyphs in the
    // parent node do not break the capturer's exact textContent lookup.
    press: { en: '1. Lost in the Woods', pt: '1. Perdida na Mata' },
    pressWaitMs: 1800,
  },
  {
    name: 'dashboard',
    stack: 'MainDashboard',
    story: 'goldilocks',
    press: { en: 'Story Overview', pt: 'Visão Geral da História' },
    pressWaitMs: 2500,
  },
  // Princess Kaguya — large cast.
  {
    name: 'character-list',
    stack: 'CharactersStack',
    story: 'princess-kaguya',
    press: { en: 'Kaguya-hime', pt: 'Kaguya-hime' },
  },
  {
    name: 'relation-map',
    stack: 'CharactersStack',
    screen: 'CharacterRelationView',
    story: 'princess-kaguya',
    settleMs: 3500,
    press: FIT,
  },
  // Alice — branching graph + board with editorial notes.
  {
    name: 'story-map',
    stack: 'NarrativeElementsStack',
    screen: 'ChoiceView',
    story: 'alice-in-wonderland',
    settleMs: 2500,
  },
  {
    name: 'board-canvas',
    stack: 'BoardsStack',
    story: 'alice-in-wonderland',
    press: { en: 'Decision threads', pt: 'Fios de decisão' },
    pressWaitMs: 2500,
  },
  // Little Mermaid — time and place graphs.
  {
    name: 'story-timeline',
    stack: 'NarrativeElementsStack',
    screen: 'StoryTimeline',
    story: 'little-mermaid',
    settleMs: 2500,
  },
  {
    name: 'location-map',
    stack: 'LocationsStack',
    screen: 'LocationView',
    story: 'little-mermaid',
    settleMs: 3500,
    press: FIT,
    viewport: { width: 1440, height: 560 },
  },
  // Beauty and the Beast — canvas map + character detail with auto-links
  // (`The Beast` / `A Fera` fields mention `Beauty` / `Bela` by full name).
  {
    name: 'location-map-canvas',
    stack: 'LocationsStack',
    screen: 'LocationMapList',
    story: 'beauty-and-the-beast',
    settleMs: 1200,
    press: { en: 'Castle map', pt: 'Mapa do castelo' },
    pressWaitMs: 2500,
  },
  {
    name: 'character-detail',
    stack: 'CharactersStack',
    screen: 'CharacterDetail',
    story: 'beauty-and-the-beast',
    focus: { en: 'The Beast', pt: 'A Fera' },
    // Mention matcher loads entity names after the story is selected; wait past that + detail mount.
    settleMs: 4500,
  },
  // Cinderella — plot tools.
  {
    name: 'plot-coverage',
    stack: 'PlotsStack',
    screen: 'PlotProgress',
    story: 'cinderella',
    viewport: { width: 1440, height: 620 },
  },
  {
    name: 'plot-matrix',
    stack: 'PlotsStack',
    screen: 'PlotMatrix',
    story: 'cinderella',
    settleMs: 2500,
  },
];

const LANGUAGES = (process.env.KERES_CAPTURE_LANGS || 'en,pt').split(',');
const THEMES = (process.env.KERES_CAPTURE_THEMES || 'light,dark').split(',');
/**
 * A desktop wide enough for the open drawer, which is how the app presents itself on a large
 * screen. A screen can ask for a different height (`viewport`) when its content is short and the
 * full window would photograph half a blank page.
 */
const VIEWPORT = { width: 1440, height: 900 };

interface Shot {
  name: string;
  query: string;
  width: number;
  height: number;
  settleMs?: number;
  press?: string;
  pressWaitMs?: number;
}

interface Screen {
  name: string;
  stack: string;
  screen?: string;
  story: string;
  settleMs?: number;
  press?: Record<string, string>;
  /** Language-specific entity display name resolved after install (see `focus` query param). */
  focus?: Record<string, string>;
  pressWaitMs?: number;
  viewport?: { width: number; height: number };
}

function run(command: string, args: string[], options: { cwd: string }): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else
        reject(
          new Error(`${command} ${args.join(' ')} terminou com ${signal || `código ${code}`}.`),
        );
    });
  });
}

function buildPlan() {
  const shots: Shot[] = [];
  for (const screen of SCREENS.filter((s) => !ONLY || s.name === ONLY)) {
    for (const language of LANGUAGES) {
      for (const theme of THEMES) {
        const query = new URLSearchParams({
          showcase: screen.story,
          stack: screen.stack,
          theme,
          lang: language,
        });
        if (screen.screen) query.set('screen', screen.screen);
        const focusName = screen.focus?.[language];
        if (focusName) query.set('focus', focusName);
        shots.push({
          name: `${screen.name}.${language}.${theme}`,
          query: query.toString(),
          width: screen.viewport?.width ?? VIEWPORT.width,
          height: screen.viewport?.height ?? VIEWPORT.height,
          settleMs: screen.settleMs,
          press: screen.press?.[language],
          pressWaitMs: screen.pressWaitMs,
        });
      }
    }
  }
  return { outputDirectory, shots };
}

async function main() {
  const skipBuild = process.argv.includes('--skip-build');
  if (!skipBuild) {
    await run('bun', ['run', 'capture:setup'], { cwd: clientRoot });
    await run('bun', ['run', 'build:main'], { cwd: desktopRoot });
  }

  const plan = buildPlan();
  const planDirectory = await mkdtemp(join(tmpdir(), 'keres-capture-'));
  const planPath = join(planDirectory, 'plan.json');
  await writeFile(planPath, JSON.stringify(plan), 'utf8');

  // A fresh profile on every run: the app keeps the installed story and the theme in its own
  // database, and a leftover from the previous run would change the photo without anyone noticing.
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'keres-capture-profile-'));
  try {
    await run(
      electronBinary,
      ['.', `--capture-screens=${planPath}`, `--user-data-dir=${userDataDirectory}`],
      { cwd: desktopRoot },
    );
    console.log(`[capture] ${plan.shots.length} imagens em ${outputDirectory}`);
  } finally {
    await rm(planDirectory, { recursive: true, force: true });
    await rm(userDataDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error('[capture]', error);
  process.exitCode = 1;
});
