import { isFountainSceneHeading } from './fountain';

/*
 * Reads Fountain text into the elements a screenplay is made of. Tolerant on purpose, like the
 * manuscript markdown reader: it never throws, and whatever it cannot classify is action.
 */

export type FountainTitleEntry = { key: string; value: string };

export type FountainElement =
  | { type: 'scene-heading'; text: string; number: string | null }
  | { type: 'action'; lines: string[] }
  | { type: 'character'; name: string; extension: string | null; dual: boolean }
  | { type: 'parenthetical'; text: string }
  | { type: 'dialogue'; lines: string[] }
  | { type: 'lyrics'; lines: string[] }
  | { type: 'transition'; text: string }
  | { type: 'centered'; text: string }
  | { type: 'page-break' }
  | { type: 'section'; depth: number; text: string }
  | { type: 'synopsis'; text: string };

export type FountainDocument = {
  titlePage: FountainTitleEntry[];
  elements: FountainElement[];
};

/** A line is blank unless it is exactly two spaces: that keeps a paragraph break inside dialogue. */
function isBlank(line: string): boolean {
  return line.trim() === '' && line.length !== 2;
}

/** Boneyard (`/* *\/`) and notes (`[[ ]]`) are for the writer; they never reach the page. */
export function stripFountainHiddenText(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
}

const TITLE_KEY = /^([A-Za-z][A-Za-z ]*):\s*(.*)$/;

/** What a title page may open with. Any key is accepted after it, but a transition (`CUT TO:`) must not open one. */
const TITLE_OPENING_KEYS = new Set([
  'title',
  'credit',
  'author',
  'authors',
  'source',
  'draft date',
  'date',
  'contact',
  'copyright',
  'notes',
  'revision',
  'format',
]);

function readTitlePage(lines: string[]): { entries: FountainTitleEntry[]; rest: string[] } {
  const opening = lines.length > 0 ? TITLE_KEY.exec(lines[0]) : null;
  if (!opening || !TITLE_OPENING_KEYS.has(opening[1].trim().toLowerCase())) {
    return { entries: [], rest: lines };
  }
  const entries: FountainTitleEntry[] = [];
  let at = 0;
  for (; at < lines.length; at += 1) {
    const line = lines[at];
    if (isBlank(line)) break;
    const key = /^\S/.test(line) ? TITLE_KEY.exec(line) : null;
    if (key) {
      entries.push({ key: key[1].trim(), value: key[2].trim() });
    } else if (entries.length > 0) {
      const last = entries[entries.length - 1];
      last.value = last.value ? `${last.value}\n${line.trim()}` : line.trim();
    } else {
      return { entries: [], rest: lines };
    }
  }
  return { entries, rest: lines.slice(at) };
}

const EXTENSION = /\s*\(([^()]*)\)\s*(\^)?\s*$/;

function isUppercaseCue(name: string): boolean {
  return /\p{L}/u.test(name) && name === name.toUpperCase();
}

/** `MOM (O.S.) ^` -> the name, its extension and whether it is the second voice of a dual dialogue. */
function readCue(line: string): { name: string; extension: string | null; dual: boolean } | null {
  let text = line.trim();
  const forced = text.startsWith('@');
  if (forced) text = text.slice(1).trim();
  let dual = false;
  if (text.endsWith('^')) {
    dual = true;
    text = text.slice(0, -1).trim();
  }
  let extension: string | null = null;
  const match = EXTENSION.exec(text);
  if (match) {
    extension = match[1].trim() || null;
    text = text.slice(0, match.index).trim();
  }
  if (!text) return null;
  if (!forced && !isUppercaseCue(text)) return null;
  return { name: text, extension, dual };
}

function sceneNumberOf(text: string): { text: string; number: string | null } {
  const match = /\s#([^#\n]+)#\s*$/.exec(text);
  return match
    ? { text: text.slice(0, match.index).trim(), number: match[1].trim() }
    : { text: text.trim(), number: null };
}

function blocksOf(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (isBlank(line)) {
      if (current.length > 0) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

function dialogueElements(cue: ReturnType<typeof readCue>, rest: string[]): FountainElement[] {
  const elements: FountainElement[] = [
    { type: 'character', name: cue!.name, extension: cue!.extension, dual: cue!.dual },
  ];
  for (const raw of rest) {
    const line = raw.trim();
    const last = elements[elements.length - 1];
    if (/^\(.*\)$/.test(line)) {
      elements.push({ type: 'parenthetical', text: line });
    } else if (last.type === 'dialogue') {
      last.lines.push(line);
    } else {
      elements.push({ type: 'dialogue', lines: [line] });
    }
  }
  return elements;
}

function blockElements(block: string[]): FountainElement[] {
  const first = block[0];
  const trimmed = first.trim();

  if (block.length === 1 && /^={3,}$/.test(trimmed)) return [{ type: 'page-break' }];

  // Outline lines: sections and synopses, never printed. A block of them is read line by line.
  if (trimmed.startsWith('#') || (trimmed.startsWith('=') && !trimmed.startsWith('=='))) {
    const elements: FountainElement[] = [];
    const leftover: string[] = [];
    for (const line of block) {
      const text = line.trim();
      const section = /^(#+)\s*(.*)$/.exec(text);
      if (section) {
        elements.push({ type: 'section', depth: section[1].length, text: section[2].trim() });
      } else if (text.startsWith('=') && !text.startsWith('==')) {
        elements.push({ type: 'synopsis', text: text.slice(1).trim() });
      } else {
        leftover.push(line);
      }
    }
    if (leftover.length > 0) elements.push({ type: 'action', lines: leftover });
    return elements;
  }

  // A heading stands for its line even with text right under it: a writer who forgets the blank line
  // still means a heading and an action, not a character cue.
  if (/^\.(?=[^.\s])/.test(trimmed)) {
    const heading = sceneNumberOf(trimmed.slice(1));
    const elements: FountainElement[] = [
      { type: 'scene-heading', text: heading.text, number: heading.number },
    ];
    if (block.length > 1) elements.push({ type: 'action', lines: block.slice(1) });
    return elements;
  }
  if (isFountainSceneHeading(trimmed)) {
    const heading = sceneNumberOf(trimmed);
    const elements: FountainElement[] = [
      { type: 'scene-heading', text: heading.text, number: heading.number },
    ];
    if (block.length > 1) elements.push({ type: 'action', lines: block.slice(1) });
    return elements;
  }

  if (trimmed.startsWith('!')) {
    return [{ type: 'action', lines: [first.replace('!', ''), ...block.slice(1)] }];
  }

  if (trimmed.startsWith('>') && trimmed.endsWith('<')) {
    return [{ type: 'centered', text: trimmed.slice(1, -1).trim() }];
  }
  if (block.length === 1) {
    if (trimmed.startsWith('>')) return [{ type: 'transition', text: trimmed.slice(1).trim() }];
    if (/\p{L}/u.test(trimmed) && trimmed === trimmed.toUpperCase() && /TO:$/.test(trimmed)) {
      return [{ type: 'transition', text: trimmed }];
    }
  }

  if (trimmed.startsWith('~')) {
    return [{ type: 'lyrics', lines: block.map((line) => line.trim().replace(/^~\s?/, '')) }];
  }

  // A cue needs dialogue under it - alone, a line in capitals is just action - unless it is forced.
  if (block.length > 1 || trimmed.startsWith('@')) {
    const cue = readCue(first);
    if (cue) return dialogueElements(cue, block.slice(1));
  }

  return [{ type: 'action', lines: block.map((line) => line.replace(/\s+$/, '')) }];
}

/** Reads Fountain text. Never throws: what is not recognised is action. */
export function parseFountain(source: string): FountainDocument {
  const text = stripFountainHiddenText(source.replace(/\r\n|\r/g, '\n').replace(/\t/g, '    '));
  const { entries, rest } = readTitlePage(text.split('\n'));
  const elements = blocksOf(rest).flatMap(blockElements);
  return { titlePage: entries, elements };
}

export type EmphasisRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

type EmphasisMarker = {
  kind: '***' | '**' | '*' | '_';
  at: number;
  length: number;
  canOpen: boolean;
  canClose: boolean;
};

/**
 * Splits a line into runs of `*italic*`, `**bold**`, `***both***` and `_underline_`. A marker needs a
 * partner and has to hug its text (`2 * 3` and `snake_case_name` stay as typed), and a backslash keeps
 * the next character as typed.
 */
export function emphasisRuns(line: string): EmphasisRun[] {
  const markers: EmphasisMarker[] = [];
  const pattern = /\\[\s\S]|\*+|_/g;
  for (let match = pattern.exec(line); match !== null; match = pattern.exec(line)) {
    const text = match[0];
    if (text.startsWith('\\')) continue;
    if (text.startsWith('*') && text.length > 3) continue;
    const at = match.index;
    const before = line[at - 1];
    const after = line[at + text.length];
    const hugsAfter = after !== undefined && !/\s/.test(after);
    const hugsBefore = before !== undefined && !/\s/.test(before);
    const underscore = text === '_';
    markers.push({
      kind: text as EmphasisMarker['kind'],
      at,
      length: text.length,
      // An underscore opens only at the start of a word and closes only at its end: snake_case stays whole.
      canOpen: hugsAfter && (!underscore || before === undefined || !/\w/.test(before)),
      canClose: hugsBefore && (!underscore || after === undefined || !/\w/.test(after)),
    });
  }

  const matched = new Set<number>();
  const open: number[] = [];
  markers.forEach((marker, index) => {
    if (marker.canClose) {
      let partner = -1;
      for (let at = open.length - 1; at >= 0; at -= 1) {
        if (markers[open[at]].kind === marker.kind) {
          partner = at;
          break;
        }
      }
      if (partner !== -1) {
        matched.add(open[partner]);
        matched.add(index);
        open.splice(partner, 1);
        return;
      }
    }
    if (marker.canOpen) open.push(index);
  });

  const runs: EmphasisRun[] = [];
  const state = { bold: false, italic: false, underline: false };
  const push = (value: string) => {
    if (value === '') return;
    const last = runs[runs.length - 1];
    if (
      last &&
      last.bold === state.bold &&
      last.italic === state.italic &&
      last.underline === state.underline
    ) {
      last.text += value;
    } else {
      runs.push({ text: value, ...state });
    }
  };
  const unescape = (text: string) => text.replace(/\\([*_\\])/g, '$1');
  let cursor = 0;
  markers.forEach((marker, index) => {
    if (!matched.has(index)) return;
    push(unescape(line.slice(cursor, marker.at)));
    cursor = marker.at + marker.length;
    if (marker.kind === '***') {
      state.bold = !state.bold;
      state.italic = !state.italic;
    } else if (marker.kind === '**') {
      state.bold = !state.bold;
    } else if (marker.kind === '*') {
      state.italic = !state.italic;
    } else {
      state.underline = !state.underline;
    }
  });
  push(unescape(line.slice(cursor)));
  return runs;
}
