import { compileLinearManuscript } from '../../../src/components/features/manuscript/export/manuscriptCompiler';
import { buildManuscriptHtml } from '../../../src/components/features/manuscript/export/manuscriptHtml';
import {
  buildManuscriptMarkdown,
  buildManuscriptText,
} from '../../../src/components/features/manuscript/export/manuscriptText';
import type { ChapterSelect, ChoiceSelect, SceneSelect } from '../../../src/db/schema';

const stamp = new Date('2026-01-01T00:00:00.000Z');

const chapter: ChapterSelect = {
  id: 'ch-1',
  storyId: 'story-1',
  name: 'Arrival',
  index: 1,
  type: 'chapter',
  summary: null,
  isFavorite: false,
  extraNotes: null,
  arcId: null,
  createdAt: stamp,
  updatedAt: stamp,
  version: 1,
  isDeleted: false,
  deletedAt: null,
};

const scenes: SceneSelect[] = [
  {
    id: 's-1',
    storyId: 'story-1',
    chapterId: 'ch-1',
    locationId: null,
    name: 'Opening',
    index: 1,
    summary: null,
    body: '# Prologue\n\nA **bold**, __lined__ & <tricky> line.',
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  },
  {
    id: 's-2',
    storyId: 'story-1',
    chapterId: 'ch-1',
    locationId: null,
    name: 'Next',
    index: 2,
    summary: null,
    body: null,
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  },
];

const choices = [
  {
    id: 'choice-1',
    storyId: 'story-1',
    sceneId: 's-1',
    nextSceneId: 's-2',
    text: 'Go on',
    notes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  } as ChoiceSelect,
];

const manuscript = compileLinearManuscript({
  title: 'My Story',
  chapters: [chapter],
  scenes,
  choices,
  includeLooseScenes: true,
  looseHeadingLabel: 'Loose',
});

describe('buildManuscriptHtml', () => {
  it('renders a standalone document with anchors, styles and escaped text', () => {
    const html = buildManuscriptHtml(manuscript, { goToScene: 'See' });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1 class="title">My Story</h1>');
    expect(html).toContain('<h2 class="chapter">1. Arrival</h2>');
    expect(html).toContain('<h3 class="scene" id="scene-s1">1. Opening</h3>');
    expect(html).toContain('<h4>Prologue</h4>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<u>lined</u>');
    expect(html).toContain('&amp; &lt;tricky&gt;');
    expect(html).toContain('<a href="#scene-s2">Next</a>');
    expect(html).toContain('page-break-before');
  });

  it('degrades orphaned choices to name-only text without links', () => {
    const orphaned = compileLinearManuscript({
      title: 'My Story',
      chapters: [chapter],
      scenes: scenes.slice(0, 1),
      choices: [{ ...choices[0], nextSceneId: 'gone' }],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
    });
    const html = buildManuscriptHtml(orphaned, { goToScene: 'See' });

    expect(html).not.toContain('<a href');
    expect(html).toContain('• Go on');
  });
});

describe('buildManuscriptMarkdown', () => {
  it('round-trips structure and inline styles', () => {
    const md = buildManuscriptMarkdown(manuscript, { goToScene: 'See' });

    expect(md).toContain('# My Story');
    expect(md).toContain('## 1. Arrival');
    expect(md).toContain('### 1. Opening');
    expect(md).toContain('#### Prologue');
    expect(md).toContain('A **bold**, <u>lined</u> & <tricky> line.');
    expect(md).toContain('- Go on — See Next');
    expect(md.endsWith('\n')).toBe(true);
  });
});

describe('buildManuscriptText', () => {
  it('renders plain text without markup', () => {
    const text = buildManuscriptText(manuscript, { goToScene: 'See' });

    expect(text).toContain('My Story\n========');
    expect(text).toContain('1. Arrival\n----------');
    expect(text).toContain('1. Opening');
    expect(text).toContain('A bold, lined & <tricky> line.');
    expect(text).toContain('* Go on — See Next');
    expect(text).not.toContain('**');
    expect(text.endsWith('\n')).toBe(true);
  });
});
