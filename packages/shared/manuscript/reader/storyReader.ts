import { z } from 'zod';
import type { CompiledManuscript } from '../compile/export/manuscriptCompiler';
import { hasPages, PAGE_CSS, pageFigureMarkup } from '../compile/export/manuscriptPageFigure';
import { bytesToBase64 } from '../../utils/base64';
import {
  buildManuscriptHtml,
  escapeHtml,
  spansToHtml,
  typographyCss,
} from '../compile/export/manuscriptHtml';
import {
  presentedManuscriptOf,
  type CompileStoryManuscriptInput,
} from '../compile/presentedManuscript';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  MAX_MANUSCRIPT_BYTES,
  ManuscriptOptionsSchema,
} from '../compile/manuscriptContracts';
import { renderOptionsOf } from '../compile/manuscriptStyle';
import { READER_BRANCHING_SOURCE, READER_COMMON_SOURCE, READER_LINEAR_SOURCE } from './readerApp';
import { READER_ENGINE_SOURCE } from './readerEngine';

const labelSchema = z.string().max(120);

/** The words of the reader's own interface, in the publisher's language. */
export const ReaderLabelsSchema = z.object({
  back: labelSchema,
  path: labelSchema,
  inventory: labelSchema,
  inventoryEmpty: labelSchema,
  saves: labelSchema,
  save: labelSchema,
  saveName: labelSchema,
  load: labelSchema,
  remove: labelSchema,
  autosave: labelSchema,
  noSaves: labelSchema,
  notSaving: labelSchema,
  continueLabel: labelSchema,
  newGame: labelSchema,
  restart: labelSchema,
  theEnd: labelSchema,
  contents: labelSchema,
  appearance: labelSchema,
  theme: labelSchema,
  themeAuto: labelSchema,
  themeLight: labelSchema,
  themeDark: labelSchema,
  themeSepia: labelSchema,
  textSize: labelSchema,
  stepsWord: labelSchema,
  scene: labelSchema,
  journey: labelSchema,
  empty: labelSchema,
  close: labelSchema,
});
export type ReaderLabels = z.infer<typeof ReaderLabelsSchema>;

export const DEFAULT_READER_LABELS: ReaderLabels = {
  back: 'Back',
  path: 'Path',
  inventory: 'Inventory',
  inventoryEmpty: 'Nothing yet.',
  saves: 'Saves',
  save: 'Save',
  saveName: 'Name this save',
  load: 'Load',
  remove: 'Delete',
  autosave: 'Autosave',
  noSaves: 'No saves yet.',
  notSaving: 'Progress is not being kept here.',
  continueLabel: 'Continue',
  newGame: 'Start reading',
  restart: 'Start over',
  theEnd: 'The End',
  contents: 'Contents',
  appearance: 'Appearance',
  theme: 'Theme',
  themeAuto: 'Auto',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSepia: 'Sepia',
  textSize: 'Text size',
  stepsWord: 'steps',
  scene: 'Scene',
  journey: 'Read my path',
  empty: 'This story has no scenes to read yet.',
  close: 'Close',
};

/** The manuscript's own options (the same choices), minus the file format, plus the reader words. */
export const ReaderOptionsSchema = ManuscriptOptionsSchema.omit({ format: true }).extend({
  readerLabels: ReaderLabelsSchema.partial().optional(),
});
export type ReaderOptionsInput = z.input<typeof ReaderOptionsSchema>;

/** What the reader needs beyond the manuscript's own input: the rules that gate and change a run. */
export type ReaderRules = {
  groups: {
    id: string;
    choiceId: string;
    combinator: 'AND' | 'OR';
    isDeleted: boolean;
  }[];
  checks: {
    groupId: string;
    mode: 'block' | 'enable';
    type: 'sceneCount' | 'inventory' | 'trigger';
    sceneId: string | null;
    minVisits: number | null;
    itemId: string | null;
    itemPresence: 'has' | 'lacks' | null;
    triggerName: string | null;
    triggerState: 'set' | 'unset' | null;
    isDeleted: boolean;
  }[];
  effects: {
    entityType: 'Scene' | 'Choice';
    entityId: string;
    effectType: 'itemGrant' | 'itemTake' | 'triggerSet' | 'triggerUnset';
    itemId: string | null;
    triggerName: string | null;
    isDeleted: boolean;
  }[];
  items: { id: string; name: string }[];
};

export type CompileStoryReaderInput = CompileStoryManuscriptInput & { rules?: ReaderRules };

/** Everything the branching reader knows about a story, embedded in its page as JSON. */
export type ReaderStoryData = {
  title: string;
  author: string | null;
  labels: ReaderLabels;
  /** How a reading begins: one scene, or a prompt offering several. */
  start: { prompt: string | null; options: { text: string; to: string }[] };
  scenes: Record<
    string,
    {
      name: string;
      /** The scene's number in the gamebook (the manuscript's own): what says which scene it is when names are left out. */
      number: number;
      html: string;
      choices: { i: string; text: string; to: string | null }[];
      effects: { effectType: string; itemId: string | null; triggerName: string | null }[];
    }
  >;
  choiceRules: Record<
    string,
    { combinator: 'AND' | 'OR'; checks: Record<string, string | number | null>[] }[]
  >;
  choiceEffects: Record<
    string,
    { effectType: string; itemId: string | null; triggerName: string | null }[]
  >;
  /** Names of the items that can ever be held; triggers are the story's own business. */
  items: Record<string, string>;
};

/**
 * The blocks of a presented gamebook, regrouped as scenes: the paragraphs and choices after each
 * scene heading. What comes before the first heading is the opening page of a story with several
 * starts (its prompt and one "begin" choice per start).
 */
function scenesOfBlocks(manuscript: CompiledManuscript, beginLabel: string) {
  const { blocks } = manuscript;
  const scenes: ReaderStoryData['scenes'] = {};
  const order: string[] = [];
  const prompt: string[] = [];
  const opening: { to: string }[] = [];
  let current: ReaderStoryData['scenes'][string] | null = null;
  // Consecutive items share one list element inside the scene's html.
  let openList: 'ul' | 'ol' | null = null;
  const closeList = () => {
    if (current && openList) current.html += `</${openList}>`;
    openList = null;
  };
  const pushListItem = (tag: 'ul' | 'ol', inner: string) => {
    if (!current) return;
    if (openList !== tag) {
      if (openList) current.html += `</${openList}>`;
      current.html += `<${tag}>`;
      openList = tag;
    }
    current.html += `<li>${inner}</li>`;
  };
  for (const block of blocks) {
    if (block.kind === 'scene-heading') {
      closeList();
      current = { name: block.name, number: block.number, html: '', choices: [], effects: [] };
      scenes[block.id] = current;
      order.push(block.id);
    } else if (block.kind === 'paragraph') {
      closeList();
      if (current) current.html += `<p>${spansToHtml(block.spans)}</p>`;
      else prompt.push(block.spans.map((span) => span.text).join(''));
    } else if (block.kind === 'page') {
      closeList();
      // The reader is one file with no requests: a page's picture rides inside it.
      if (current) {
        current.html += pageFigureMarkup(
          block,
          manuscript,
          (_mediaId, image) => `data:${image.mimeType};base64,${bytesToBase64(image.bytes)}`,
        );
      }
    } else if (block.kind === 'bullet' || block.kind === 'ordered') {
      if (current) pushListItem(block.kind === 'bullet' ? 'ul' : 'ol', spansToHtml(block.spans));
      else prompt.push(`- ${block.spans.map((span) => span.text).join('')}`);
    } else if (block.kind === 'choice') {
      closeList();
      if (current) {
        current.choices.push({
          i: block.id,
          text: block.text,
          to: block.targetBookmarkId ? block.targetSceneId : null,
        });
      } else if (block.targetBookmarkId) {
        opening.push({ to: block.targetSceneId });
      }
    }
  }
  closeList();
  const promptText = prompt.join(' ').trim();
  const options =
    opening.length > 0
      ? opening.map((entry, index) => ({
          to: entry.to,
          text: scenes[entry.to]?.name || `${beginLabel} ${index + 1}`,
        }))
      : order.length > 0
        ? [{ to: order[0], text: beginLabel }]
        : [];
  return { scenes, start: { prompt: opening.length > 0 ? promptText : null, options } };
}

const KEPT_CHECK_FIELDS = [
  'mode',
  'type',
  'sceneId',
  'minVisits',
  'itemId',
  'itemPresence',
  'triggerName',
  'triggerState',
] as const;

function attachRules(data: ReaderStoryData, rules: ReaderRules | undefined): void {
  if (!rules) return;
  const effectOf = (effect: ReaderRules['effects'][number]) => ({
    effectType: effect.effectType,
    itemId: effect.itemId,
    triggerName: effect.triggerName,
  });
  const liveEffects = rules.effects.filter((effect) => !effect.isDeleted);
  const held = new Set<string>();
  for (const effect of liveEffects) {
    if (effect.itemId && (effect.effectType === 'itemGrant' || effect.effectType === 'itemTake')) {
      held.add(effect.itemId);
    }
  }
  for (const [id, scene] of Object.entries(data.scenes)) {
    scene.effects = liveEffects
      .filter((effect) => effect.entityType === 'Scene' && effect.entityId === id)
      .map(effectOf);
    for (const choice of scene.choices) {
      const own = liveEffects.filter(
        (effect) => effect.entityType === 'Choice' && effect.entityId === choice.i,
      );
      if (own.length > 0) data.choiceEffects[choice.i] = own.map(effectOf);
      const groups = rules.groups
        .filter((group) => group.choiceId === choice.i && !group.isDeleted)
        .map((group) => ({
          combinator: group.combinator,
          checks: rules.checks
            .filter((check) => check.groupId === group.id && !check.isDeleted)
            .map((check) =>
              Object.fromEntries(KEPT_CHECK_FIELDS.map((field) => [field, check[field]])),
            ),
        }));
      if (groups.length > 0) data.choiceRules[choice.i] = groups;
    }
  }
  for (const item of rules.items) {
    if (held.has(item.id)) data.items[item.id] = item.name;
  }
}

/** JSON that can sit inside a `<script>` element: no `</script>`, no line separators. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const READER_CSS = `
:root { --bg: #fdfcf9; --fg: #1c1b19; --muted: #6b665d; --accent: #2b5cb8; --line: #ddd8ce; --card: #ffffff; --scale: 1; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme]) { --bg: #16171b; --fg: #e7e3da; --muted: #9c978c; --accent: #8fb0ff; --line: #33343b; --card: #1e1f25; color-scheme: dark; } }
[data-theme='light'] { --bg: #fdfcf9; --fg: #1c1b19; --muted: #6b665d; --accent: #2b5cb8; --line: #ddd8ce; --card: #ffffff; color-scheme: light; }
[data-theme='dark'] { --bg: #16171b; --fg: #e7e3da; --muted: #9c978c; --accent: #8fb0ff; --line: #33343b; --card: #1e1f25; color-scheme: dark; }
[data-theme='sepia'] { --bg: #f3ead7; --fg: #3b2f22; --muted: #7a6a55; --accent: #8a4b16; --line: #d9c9a8; --card: #f8f1e1; color-scheme: light; }
html { font-size: calc(100% * var(--scale)); scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body { margin: 0; padding: 0; max-width: none; background: var(--bg); color: var(--fg); font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif; line-height: 1.75; text-rendering: optimizeLegibility; }
::selection { background: color-mix(in srgb, var(--accent) 28%, transparent); }
a { color: var(--accent); text-underline-offset: 0.15em; }
button { font: inherit; color: inherit; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
[id] { scroll-margin-top: 4.5rem; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

#bar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.55rem max(1rem, calc((100% - 42rem) / 2 + 1.25rem)); background: var(--bg); background: color-mix(in srgb, var(--bg) 88%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); font-family: system-ui, sans-serif; font-size: 0.85rem; line-height: 1.4; }
#bar .spacer { flex: 1; }
#bar .here { flex: 1 1 0; min-width: 4rem; align-self: center; text-align: center; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#bar button, .pill { background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 0.3rem 0.9rem; cursor: pointer; transition: border-color 0.15s; }
#bar button:hover:not(:disabled), .pill:hover { border-color: var(--accent); }
#bar button:disabled { opacity: 0.4; cursor: default; }
.pill.on { background: var(--accent); color: var(--bg); border-color: var(--accent); }
#progress { position: absolute; left: 0; bottom: -1px; height: 2px; width: 0; background: var(--accent); transition: width 0.15s; }

/* The path read back: the scenes walked, in order, each followed by the choice taken. */
.sheet-box.wide { width: min(44rem, 100%); max-height: 92vh; }
.journey { font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif; line-height: 1.75; }
.journey p { margin: 0 0 0.85rem; text-indent: 1.5em; }
.stop { padding: 1rem 0 0.4rem; border-bottom: 1px solid var(--line); }
.stop-name { text-align: center; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.8rem; }
.journey p.taken { font-family: system-ui, sans-serif; text-indent: 0; border-left: 3px solid var(--accent); padding: 0.3rem 0.8rem; margin: 1rem 0; color: var(--muted); }
.journey p.taken::before { content: '→  '; }
#view { max-width: 42rem; margin: 0 auto; padding: 0 1.25rem 6rem; }
.title, .story-title { text-align: center; font-size: clamp(2rem, 7vw, 2.9rem); line-height: 1.15; font-weight: 700; margin: 4rem 0 0.6rem; }
.subtitle, .byline, .prompt { text-align: center; color: var(--muted); font-style: italic; margin: 0 0 3rem; }
.chapter { text-align: center; font-size: 1.7rem; line-height: 1.25; margin: 5rem 0 2rem; }
.chapter::before { content: ''; display: block; width: 3rem; height: 1px; background: var(--line); margin: 0 auto 1.6rem; }
.title + .chapter, .subtitle + .chapter { margin-top: 3rem; }
h3.scene, .scene-name { text-align: center; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin: 3rem 0 1.4rem; }
/* The scene page keeps its own space above, name or not: without a name the text would sit against the bar. */
article.scene { padding-top: 3rem; }
.scene-name { margin-top: 0; }
:where(#view) p { margin: 0 0 0.85rem; text-indent: 1.5em; hyphens: auto; overflow-wrap: break-word; }
@media (min-width: 40rem) { :where(#view) .text p, :where(#view) > p { text-align: justify; } }
p.subtitle, p.byline, p.prompt, p.note, p.end-mark, p.scene-break, p.choice, p.choice-detail, .chapter + p, h3.scene + p, .scene-name + .text > p:first-child { text-indent: 0; }
p.scene-break { text-align: center; color: var(--muted); letter-spacing: 0.4em; margin: 1.8rem 0; }
nav.toc { display: none; }
.end-mark { text-align: center; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); margin: 1rem 0 0; }
.choices, .start, .the-end { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 2.5rem; font-family: system-ui, sans-serif; }
.choice { text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: 0.7rem; padding: 0.85rem 1.1rem; cursor: pointer; line-height: 1.45; transition: border-color 0.15s, transform 0.15s; }
.choice.primary { border-color: var(--accent); }
.choice:hover:not(:disabled) { border-color: var(--accent); transform: translateY(-1px); }
.choice.closed { opacity: 0.45; cursor: default; }
.note { color: var(--muted); font-family: system-ui, sans-serif; font-size: 0.9rem; }
.veil { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 10; font-family: system-ui, sans-serif; line-height: 1.5; }
.veil[hidden] { display: none; }
.sheet-box { background: var(--bg); color: var(--fg); width: min(34rem, 100%); max-height: 80vh; overflow: auto; border-radius: 1rem 1rem 0 0; padding: 1rem; }
.sheet-box header { display: flex; justify-content: space-between; align-items: center; }
.sheet-box h2 { margin: 0; font-size: 1.1rem; }
.sheet-box header button { background: none; border: 0; font-size: 1.4rem; cursor: pointer; }
.row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.4rem 0 0.8rem; }
.row .name { flex: 1; min-width: 8rem; padding: 0.3rem 0.6rem; border: 1px solid var(--line); border-radius: 0.4rem; background: var(--card); color: var(--fg); font: inherit; }
.trail, .bag, .saves { padding-left: 1.2rem; }
.trail li.here { font-weight: bold; }
.saves, .contents { list-style: none; padding: 0; margin: 0.6rem 0 0; }
.contents li { border-bottom: 1px solid var(--line); }
.contents li.toc-scene { padding-left: 1.2rem; font-size: 0.92rem; }
.contents button { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 0.6rem 0; cursor: pointer; }
.contents button:hover { color: var(--accent); }
.save { display: flex; gap: 0.4rem; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
.save .info { flex: 1; display: flex; flex-direction: column; }
.save .meta { color: var(--muted); font-size: 0.8rem; }
`;

function pageOf(args: {
  title: string;
  language: string;
  css: string;
  bar: string;
  main: string;
  labels: ReaderLabels;
  data: unknown;
  scripts: string;
}): string {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(args.language)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'" />
<title>${escapeHtml(args.title)}</title>
<style>
${args.css}
</style>
</head>
<body>
${args.bar}
${args.main}
<div id="sheet" class="veil" hidden><div class="sheet-box" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header><h2 id="sheet-title"></h2><button id="sheet-close" aria-label="${escapeHtml(args.labels.close)}">&times;</button></header><div id="sheet-body"></div></div></div>
<script type="application/json" id="story-data">${jsonForScript(args.data)}</script>
<script>${args.scripts}</script>
</body>
</html>`;
}

const button = (id: string, label: string) => `<button id="${id}">${escapeHtml(label)}</button>`;

/** The branching reader page for a presented gamebook. */
export function buildBranchingReaderHtml(
  manuscript: CompiledManuscript,
  data: ReaderStoryData,
  options: { language: string; css: string },
): string {
  const labels = data.labels;
  return pageOf({
    title: manuscript.title,
    language: options.language,
    css: options.css,
    labels,
    data,
    bar: `<header id="bar">${button('act-back', labels.back)}${button('act-path', labels.path)}${button('act-bag', labels.inventory)}${button('act-saves', labels.saves)}<span id="here" class="here"></span>${button('act-home', labels.restart)}${button('act-look', labels.appearance)}</header>`,
    main: '<main id="view"></main>',
    scripts: [READER_ENGINE_SOURCE, READER_COMMON_SOURCE, READER_BRANCHING_SOURCE].join('\n'),
  });
}

/** The linear reader page: the manuscript's own HTML, with the reader's bar around it. */
export function buildLinearReaderHtml(
  manuscript: CompiledManuscript,
  labels: ReaderLabels,
  options: {
    language: string;
    css: string;
    tocHeading: string;
    goToScene: string;
    render: Parameters<typeof buildManuscriptHtml>[2];
  },
): string {
  const html = buildManuscriptHtml(
    manuscript,
    { goToScene: options.goToScene, tocHeading: options.tocHeading },
    { ...options.render, includeToc: true },
  );
  const between = (open: string, close: string) => {
    const from = html.indexOf(open);
    const to = html.lastIndexOf(close);
    return from === -1 || to === -1 ? '' : html.slice(from + open.length, to);
  };
  return pageOf({
    title: manuscript.title,
    language: options.language,
    css: `${between('<style>\n', '\n</style>')}\n${options.css}`,
    labels,
    data: { labels },
    bar: `<header id="bar">${button('act-contents', labels.contents)}<span id="here" class="here"></span>${button('act-look', labels.appearance)}<span id="progress"></span></header>`,
    main: `<main id="view">${between('<body>\n', '\n</body>')}</main>`,
    scripts: [READER_COMMON_SOURCE, READER_LINEAR_SOURCE].join('\n'),
  });
}

/**
 * Compiles a story's online reader: one self-contained HTML page (no requests, its own engine
 * inside), made from the same blocks a manuscript is - so the same options shape it (arc, names,
 * typography, quotes, placeholders). A linear story reads as its manuscript page; a branching
 * story reads one scene at a time over the reading rules (checks and effects) in `input.rules`.
 * Throws past `MAX_MANUSCRIPT_BYTES`.
 */
export function compileStoryReader(
  input: CompileStoryReaderInput,
  options: ReaderOptionsInput,
): { bytes: Uint8Array; mimeType: string } {
  const parsed = ReaderOptionsSchema.parse(options);
  const manuscriptOptions = ManuscriptOptionsSchema.parse({ ...parsed, format: 'html' });
  const labels = { ...DEFAULT_MANUSCRIPT_LABELS, ...manuscriptOptions.labels };
  const readerLabels: ReaderLabels = { ...DEFAULT_READER_LABELS, ...parsed.readerLabels };
  const presented = presentedManuscriptOf(input, manuscriptOptions, labels);
  const language = manuscriptOptions.language ?? 'en';
  // The reader has its own size control, so the writer's point size does not apply.
  const renderOptions = { ...renderOptionsOf(manuscriptOptions.style), fontSize: undefined };
  const pagesCss = hasPages(presented.blocks) ? `\n${PAGE_CSS}` : '';
  const css = `${READER_CSS}\n${typographyCss(renderOptions, false)}${pagesCss}`;

  let html: string;
  if (input.storyType === 'branching') {
    const { scenes, start } = scenesOfBlocks(presented, labels.beginAt);
    const data: ReaderStoryData = {
      title: presented.title,
      author: manuscriptOptions.author ?? null,
      labels: readerLabels,
      start,
      scenes,
      choiceRules: {},
      choiceEffects: {},
      items: {},
    };
    attachRules(data, input.rules);
    html = buildBranchingReaderHtml(presented, data, { language, css });
  } else {
    html = buildLinearReaderHtml(presented, readerLabels, {
      language,
      css,
      tocHeading: labels.tocHeading,
      goToScene: labels.goToScene,
      render: { ...renderOptionsOf(manuscriptOptions.style, true), fontSize: undefined },
    });
  }
  const bytes = new TextEncoder().encode(html);
  if (bytes.length > MAX_MANUSCRIPT_BYTES) {
    throw new Error(
      `Reader exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit (${bytes.length} bytes).`,
    );
  }
  return { bytes, mimeType: 'text/html; charset=utf-8' };
}
