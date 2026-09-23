import { describe, expect, it } from 'vitest';
import {
  compileLinearManuscript,
  type CompiledManuscript,
  type ManuscriptChoice,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import { parseManuscriptMarkdown } from '../../../manuscript/compile/parseManuscriptMarkdown';
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
    const html = buildManuscriptHtml(manuscript, { goToScene: 'See', tocHeading: 'Contents' });

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
    const html = buildManuscriptHtml(struckManuscript, {
      goToScene: 'See',
      tocHeading: 'Contents',
    });

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
    const html = buildManuscriptHtml(orphaned, { goToScene: 'See', tocHeading: 'Contents' });

    expect(html).not.toContain('<a href');
    expect(html).toContain('• Go on');
  });

  it('renders a clickable index when enabled', () => {
    const html = buildManuscriptHtml(
      manuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
      { includeToc: true },
    );

    expect(html).toContain('<nav class="toc">');
    expect(html).toContain('<a href="#chapter-ch1">1. Arrival</a>');
    expect(html).toContain('<a href="#scene-s1">1. Opening</a>');
    expect(html).toContain('<h2 class="chapter" id="chapter-ch1">1. Arrival</h2>');
    expect(html).toContain('nav.toc + *');
  });

  it('omits the index and chapter anchors unless enabled', () => {
    const html = buildManuscriptHtml(manuscript, { goToScene: 'See', tocHeading: 'Contents' });

    expect(html).not.toContain('<nav class="toc">');
    expect(html).not.toContain('Contents');
    expect(html).not.toContain('id="chapter-ch1"');
    expect(html).not.toContain('nav.toc + *');
  });

  it('renders underline and strikethrough spans', () => {
    const html = buildManuscriptHtml(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              { text: 'under', bold: false, italic: false, underline: true, strikethrough: false },
              { text: 'struck', bold: false, italic: false, underline: false, strikethrough: true },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(html).toContain('<u>under</u>');
    expect(html).toContain('<s>struck</s>');
  });
});

describe('buildManuscriptMarkdown', () => {
  it('round-trips structure and inline styles', () => {
    const md = buildManuscriptMarkdown(manuscript, { goToScene: 'See', tocHeading: 'Contents' });

    expect(md).toContain('# My Story');
    expect(md).toContain('## 1. Arrival');
    expect(md).toContain('### 1. Opening');
    expect(md).toContain('Prologue\n\nA **bold**');
    expect(md).toContain('A **bold**, <u>lined</u> & <tricky> line.');
    expect(md).toContain('- Go on — See Next');
    expect(md.endsWith('\n')).toBe(true);
  });

  it('emits ~~ spans as paired tildes', () => {
    const md = buildManuscriptMarkdown(struckManuscript, {
      goToScene: 'See',
      tocHeading: 'Contents',
    });

    expect(md).toContain('A ~~cut~~ line.');
  });

  it('renders a clickable index when enabled', () => {
    const md = buildManuscriptMarkdown(
      manuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
      { includeToc: true },
    );

    expect(md).toContain('## Contents');
    expect(md).toContain('- [1. Arrival](#chapter-ch1)');
    expect(md).toContain('  - [1. Opening](#scene-s1)');
    expect(md).toContain('<a id="chapter-ch1"></a>');
    expect(md).toContain('<a id="scene-s1"></a>');
  });

  it('omits the index and anchors unless enabled', () => {
    const md = buildManuscriptMarkdown(manuscript, { goToScene: 'See', tocHeading: 'Contents' });

    expect(md).not.toContain('## Contents');
    expect(md).not.toContain('](#chapter-ch1)');
    expect(md).not.toContain('<a id=');
  });

  it('renders underline spans as u tags', () => {
    const md = buildManuscriptMarkdown(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              { text: 'under', bold: false, italic: false, underline: true, strikethrough: false },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(md).toContain('<u>under</u>');
  });

  it('escapes unmatched markers so they survive re-reading', () => {
    const md = buildManuscriptMarkdown(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              {
                text: '**unclosed and *single',
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
              },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(md).toContain('\\*\\*unclosed and \\*single');
  });

  it('leaves harmless lone markers readable', () => {
    const md = buildManuscriptMarkdown(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              {
                text: '2 * 3 = 6',
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
              },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(md).toContain('2 * 3 = 6');
    expect(md).not.toContain('\\*');
  });

  it('escapes literal markers beside real ones', () => {
    const md = buildManuscriptMarkdown(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              { text: 'a', bold: false, italic: true, underline: false, strikethrough: false },
              {
                text: ' and 5 * 3',
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
              },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(md).toContain('*a* and 5 \\* 3');
  });

  it('escapes a literal leading hash so it is not a heading', () => {
    const md = buildManuscriptMarkdown(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              {
                text: '# head',
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
              },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(md).toContain('\\# head');
  });

  it('moves boundary spaces outside emphasis markers', () => {
    const md = buildManuscriptMarkdown(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              { text: 'Test ', bold: false, italic: false, underline: false, strikethrough: false },
              { text: 'of ', bold: false, italic: true, underline: false, strikethrough: false },
              { text: 'scene', bold: false, italic: true, underline: true, strikethrough: false },
              {
                text: ' "like this"',
                bold: false,
                italic: true,
                underline: false,
                strikethrough: false,
              },
              { text: ' ', bold: false, italic: false, underline: false, strikethrough: false },
              {
                text: 'that will be a failure',
                bold: false,
                italic: false,
                underline: false,
                strikethrough: true,
              },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(md).toContain('Test *of* <u>*scene*</u> *"like this"* ~~that will be a failure~~');
  });

  it('keeps markers verbatim on whitespace-only spans', () => {
    const md = buildManuscriptMarkdown(
      {
        title: 'My Story',
        blocks: [
          { kind: 'title', text: 'My Story' },
          {
            kind: 'paragraph',
            spans: [
              { text: 'a', bold: false, italic: false, underline: false, strikethrough: false },
              { text: ' ', bold: false, italic: true, underline: false, strikethrough: false },
              { text: 'b', bold: false, italic: false, underline: false, strikethrough: false },
            ],
          },
        ],
      } as unknown as CompiledManuscript,
      { goToScene: 'See', tocHeading: 'Contents' },
    );

    expect(md).toContain('a* *b');
  });

  it('exports nested source marks exactly as the reader shows them', () => {
    const compiled = compileLinearManuscript({
      title: 'My Story',
      chapters: [{ id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter' }],
      scenes: [
        {
          id: 's-1',
          chapterId: 'ch-1',
          name: 'Opening',
          index: 1,
          body: 'Test *of __scene__ "like this"* ~~that will be a failure~~',
          isDeleted: false,
        },
      ],
      choices: [],
      includeLooseScenes: false,
      looseHeadingLabel: 'Appendix',
      includeSceneNames: false,
    });
    const md = buildManuscriptMarkdown(compiled, { goToScene: 'See', tocHeading: 'Contents' });

    expect(md).toContain('Test *of* <u>*scene*</u> *"like this"* ~~that will be a failure~~');
  });

  it('round-trips nested and literal marks through markdown', () => {
    const bodies = ['*a **b** c*', '***x***', '**unclosed and *single', '2 * 3 = 6', '\\*x\\*'];
    for (const body of bodies) {
      const [original] = parseManuscriptMarkdown(body);
      const md = buildManuscriptMarkdown(
        {
          title: 'T',
          blocks: [
            { kind: 'title', text: 'T' },
            {
              kind: 'paragraph',
              spans: original.inlines.map((inline) => ({
                text: inline.text,
                bold: inline.bold ?? false,
                italic: inline.italic ?? false,
                underline: inline.underline ?? false,
                strikethrough: inline.strikethrough ?? false,
              })),
            },
          ],
        } as unknown as CompiledManuscript,
        { goToScene: 'See', tocHeading: 'Contents' },
      );

      // Underline cannot round-trip: `<u>` renders in external readers but is
      // not parser syntax, and markdown export is a terminal artifact.
      expect(parseManuscriptMarkdown(md)[1].inlines).toEqual(original.inlines);
    }
  });
});

describe('buildManuscriptText', () => {
  it('renders plain text without markup', () => {
    const text = buildManuscriptText(manuscript, { goToScene: 'See', tocHeading: 'Contents' });

    expect(text).toContain('My Story\n========');
    expect(text).toContain('1. Arrival\n----------');
    expect(text).toContain('1. Opening');
    expect(text).toContain('A bold, lined & <tricky> line.');
    expect(text).toContain('* Go on — See Next');
    expect(text).not.toContain('**');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('strips ~~ markers from plain text', () => {
    const text = buildManuscriptText(struckManuscript, {
      goToScene: 'See',
      tocHeading: 'Contents',
    });

    expect(text).toContain('A cut line.');
    expect(text).not.toContain('~~');
  });
});

describe('choice requirements and effects', () => {
  const annotated = compileLinearManuscript({
    title: 'My Story',
    chapters: [chapter],
    scenes,
    choices: [
      {
        ...choices[0],
        requirements: ['Requires all of:', '• Requires the Brass Key'],
        effects: ['Effects', '• Gain the Rusty Key'],
      },
    ],
    includeLooseScenes: true,
    looseHeadingLabel: 'Loose',
  });

  it('renders one indented line per annotation in markdown', () => {
    const md = buildManuscriptMarkdown(annotated, { goToScene: 'See', tocHeading: 'Contents' });

    expect(md).toContain(
      '- Go on — See Next\n  Requires all of:\n  • Requires the Brass Key\n  Effects\n  • Gain the Rusty Key\n',
    );
  });

  it('renders one indented line per annotation in plain text', () => {
    const text = buildManuscriptText(annotated, { goToScene: 'See', tocHeading: 'Contents' });

    expect(text).toContain(
      '* Go on — See Next\n  Requires all of:\n  • Requires the Brass Key\n  Effects\n  • Gain the Rusty Key\n',
    );
  });

  it('renders escaped detail paragraphs in html', () => {
    const html = buildManuscriptHtml(annotated, { goToScene: 'See', tocHeading: 'Contents' });

    expect(html).toContain('<p class="choice-detail">Requires all of:</p>');
    expect(html).toContain('<p class="choice-detail">• Requires the Brass Key</p>');
    expect(html).toContain('<p class="choice-detail">Effects</p>');
    expect(html).toContain('<p class="choice-detail">• Gain the Rusty Key</p>');
    expect(html).toContain('.choice-detail');
  });

  it('emits no annotation lines for open choices', () => {
    const md = buildManuscriptMarkdown(manuscript, { goToScene: 'See', tocHeading: 'Contents' });
    const text = buildManuscriptText(manuscript, { goToScene: 'See', tocHeading: 'Contents' });
    const html = buildManuscriptHtml(manuscript, { goToScene: 'See', tocHeading: 'Contents' });

    expect(md).toContain('- Go on — See Next\n\n');
    expect(text).toContain('* Go on — See Next\n\n');
    expect(html).not.toContain('choice-detail">');
  });
});
