import { describe, expect, it } from 'vitest';
import {
  compileLinearManuscript,
  type ManuscriptChoice,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import { buildManuscriptHtml } from '../../../manuscript/compile/export/manuscriptHtml';
import {
  buildManuscriptMarkdown,
  buildManuscriptText,
} from '../../../manuscript/compile/export/manuscriptText';
import type {
  ManuscriptChapter,
  ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';

const chapter: ManuscriptChapter = { id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter' };

const scenes: ManuscriptScene[] = [
  {
    id: 's-1',
    chapterId: 'ch-1',
    name: 'Opening',
    index: 1,
    body: '# Prologue\n\nA **bold**, __lined__ & <tricky> line.',
    isDeleted: false,
  },
  {
    id: 's-2',
    chapterId: 'ch-1',
    name: 'Next',
    index: 2,
    body: null,
    isDeleted: false,
  },
];

const choices: ManuscriptChoice[] = [
  { id: 'choice-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Go on' },
];

const manuscript = compileLinearManuscript({
  title: 'My Story',
  chapters: [chapter],
  scenes,
  choices,
  includeLooseScenes: true,
  looseHeadingLabel: 'Loose',
});

const struckManuscript = compileLinearManuscript({
  title: 'My Story',
  chapters: [chapter],
  scenes: [{ ...scenes[0], body: 'A ~~cut~~ line.' }],
  choices: [],
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
    expect(html).toContain('<p>Prologue</p>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<u>lined</u>');
    expect(html).toContain('&amp; &lt;tricky&gt;');
    expect(html).toContain('<a href="#scene-s2">Next</a>');
    expect(html).toContain('page-break-before');
  });

  it('wraps ~~ spans in s-tags', () => {
    const html = buildManuscriptHtml(struckManuscript, { goToScene: 'See' });

    expect(html).toContain('<s>cut</s>');
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
    expect(md).toContain('Prologue\n\nA **bold**');
    expect(md).toContain('A **bold**, <u>lined</u> & <tricky> line.');
    expect(md).toContain('- Go on — See Next');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('emits ~~ spans as paired tildes', () => {
    const md = buildManuscriptMarkdown(struckManuscript, { goToScene: 'See' });

    expect(md).toContain('A ~~cut~~ line.');
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

  it('strips ~~ markers from plain text', () => {
    const text = buildManuscriptText(struckManuscript, { goToScene: 'See' });

    expect(text).toContain('A cut line.');
    expect(text).not.toContain('~~');
  });
});
