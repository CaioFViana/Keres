import type { LocationIntExt } from '../../entities/Location';
import {
  type ManuscriptBlock,
  type ManuscriptMark,
  serializeDocumentToMarkdown,
} from '../ManuscriptDocument';
import { isFountainSceneHeading } from './fountain';
import { emphasisRuns, type FountainElement, parseFountain } from './fountainParser';

/*
 * Reads a Fountain file into what Keres keeps: a section becomes a chapter, a scene heading opens a
 * scene whose text is the script as typed (heading included, so it exports back as the same script),
 * and the places and characters the script names are *offered* - never created here. The person
 * chooses which become Locations and Characters.
 */

export type ImportedPlace = { name: string; intExt: LocationIntExt | null };

export type ImportedScene = {
  /** The heading as written, without its scene number; `null` for what comes before the first heading. */
  heading: string | null;
  place: ImportedPlace | null;
  /** The scene's text as the editor keeps it: markdown, a paragraph per Fountain element. */
  body: string;
  /** A Fountain synopsis (`= text`) given to the scene, if any. */
  synopsis: string | null;
  /** Who speaks in it, in order of first cue. */
  cast: string[];
};

export type ImportedSection = {
  /** The `#` section's title; `null` for scenes that sit under no section. */
  name: string | null;
  scenes: ImportedScene[];
};

export type OfferedPlace = ImportedPlace & { scenes: number };
export type OfferedCharacter = { name: string; cues: number };

export type FountainImportPlan = {
  title: string | null;
  author: string | null;
  sections: ImportedSection[];
  places: OfferedPlace[];
  characters: OfferedCharacter[];
};

const HEADING_PREFIX = /^(INT\.?\s*\/\s*EXT|I\s*\/\s*E|INT|EXT|EST)(?:\.|\s)\s*/i;

/** The place a scene heading names, and whether it is indoors or out; the time of day is left in the text. */
export function placeOfHeading(heading: string): ImportedPlace | null {
  const text = heading.replace(/\s#[^#\n]+#\s*$/, '').trim();
  let intExt: LocationIntExt | null = null;
  let rest = text;
  if (text.startsWith('.') && !text.startsWith('..')) {
    rest = text.slice(1);
  } else {
    const prefix = HEADING_PREFIX.exec(text);
    if (!prefix) return null;
    const kind = prefix[1].toUpperCase().replace(/[\s.]/g, '');
    intExt =
      kind === 'INT' ? 'interior' : kind === 'EXT' ? 'exterior' : kind === 'EST' ? null : 'both';
    rest = text.slice(prefix[0].length);
  }
  // "KITCHEN - NIGHT": the place is what comes before the last dash that opens a time of day.
  const name = rest
    .replace(/\s+[-–—]\s+[^-–—]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name ? { name, intExt } : null;
}

const spansOfLine = (line: string) =>
  emphasisRuns(line).map((run) => ({
    text: run.text,
    marks: (
      [
        run.bold ? 'bold' : null,
        run.italic ? 'italic' : null,
        run.underline ? 'underline' : null,
      ] as (ManuscriptMark | null)[]
    ).filter((mark): mark is ManuscriptMark => mark !== null),
  }));

/** One paragraph: its lines kept as lines, each with its emphasis. */
function paragraphOf(lines: string[]): ManuscriptBlock {
  const spans: { text: string; marks: ManuscriptMark[] }[] = [];
  lines.forEach((line, index) => {
    if (index > 0) spans.push({ text: '\n', marks: [] });
    spans.push(...spansOfLine(line));
  });
  return { kind: 'paragraph', spans };
}

const cueName = (name: string) => name.replace(/\s+/g, ' ').trim();

type Draft = {
  heading: string | null;
  place: ImportedPlace | null;
  blocks: ManuscriptBlock[];
  synopsis: string | null;
  cast: string[];
};

const newDraft = (heading: string | null): Draft => ({
  heading,
  place: heading ? placeOfHeading(heading) : null,
  blocks: heading ? [paragraphOf([heading])] : [],
  synopsis: null,
  cast: [],
});

/** The Fountain a file holds, planned as chapters and scenes, with the places and characters it names. */
export function planFountainImport(source: string): FountainImportPlan {
  const document = parseFountain(source);
  const titleOf = (key: string) =>
    document.titlePage.find((entry) => entry.key.toLowerCase() === key)?.value.trim() || null;

  const sections: ImportedSection[] = [];
  let section: ImportedSection | null = null;
  let draft: Draft | null = null;
  let pendingSynopsis: string | null = null;

  const closeScene = () => {
    if (!draft) return;
    if (!section) {
      section = { name: null, scenes: [] };
      sections.push(section);
    }
    section.scenes.push({
      heading: draft.heading,
      place: draft.place,
      body: serializeDocumentToMarkdown({ blocks: draft.blocks }),
      synopsis: draft.synopsis,
      cast: draft.cast,
    });
    draft = null;
  };
  const current = (): Draft => {
    if (!draft) draft = newDraft(null);
    return draft;
  };

  const push = (element: FountainElement) => {
    switch (element.type) {
      case 'section':
        // Only the top level makes a chapter; deeper levels are the writer's outline and carry no text.
        if (element.depth === 1) {
          closeScene();
          section = { name: element.text.trim() || null, scenes: [] };
          sections.push(section);
        }
        break;
      case 'synopsis':
        if (draft)
          draft.synopsis = draft.synopsis ? `${draft.synopsis} ${element.text}` : element.text;
        else
          pendingSynopsis = pendingSynopsis ? `${pendingSynopsis} ${element.text}` : element.text;
        break;
      case 'scene-heading': {
        closeScene();
        // The reader drops the period of a forced heading; without it the line would stop being one.
        draft = newDraft(
          isFountainSceneHeading(element.text.trim())
            ? element.text.trim()
            : `.${element.text.trim()}`,
        );
        if (pendingSynopsis) {
          draft.synopsis = pendingSynopsis;
          pendingSynopsis = null;
        }
        break;
      }
      case 'action':
        current().blocks.push(paragraphOf(element.lines));
        break;
      case 'character': {
        const name = cueName(element.name);
        const scene = current();
        if (name && !scene.cast.includes(name)) scene.cast.push(name);
        const extension = element.extension ? ` (${element.extension})` : '';
        scene.blocks.push(paragraphOf([`${name}${extension}${element.dual ? ' ^' : ''}`]));
        break;
      }
      case 'parenthetical':
        current().blocks.push(paragraphOf([element.text]));
        break;
      case 'dialogue':
        current().blocks.push(paragraphOf(element.lines));
        break;
      case 'lyrics':
        current().blocks.push(paragraphOf(element.lines.map((line) => `~${line}`)));
        break;
      case 'transition':
        current().blocks.push(paragraphOf([element.text]));
        break;
      case 'centered':
        current().blocks.push(paragraphOf([`> ${element.text} <`]));
        break;
      case 'page-break':
        break;
    }
  };

  for (const element of document.elements) push(element);
  closeScene();

  const places = new Map<string, OfferedPlace>();
  const characters = new Map<string, OfferedCharacter>();
  const cues = document.elements.filter((element) => element.type === 'character');
  for (const cue of cues) {
    const name = cueName(cue.name);
    const known = characters.get(name.toUpperCase());
    if (known) known.cues += 1;
    else characters.set(name.toUpperCase(), { name, cues: 1 });
  }
  for (const { scenes } of sections) {
    for (const scene of scenes) {
      if (!scene.place) continue;
      const key = scene.place.name.toUpperCase();
      const known = places.get(key);
      if (known) {
        known.scenes += 1;
        // The first heading that says indoors or out settles it for the place.
        if (!known.intExt && scene.place.intExt) known.intExt = scene.place.intExt;
      } else {
        places.set(key, { ...scene.place, scenes: 1 });
      }
    }
  }

  return {
    title: titleOf('title'),
    author: titleOf('author') ?? titleOf('authors'),
    sections,
    places: [...places.values()],
    characters: [...characters.values()],
  };
}
