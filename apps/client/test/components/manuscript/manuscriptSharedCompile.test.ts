/** @jest-environment node */
import {
  buildManuscriptDocxBytes,
  buildManuscriptHtml,
  buildManuscriptMarkdown,
  buildManuscriptText,
  compileLinearManuscript,
  compileRouteManuscript,
} from '@keres/shared';

// Guards the client's shared-compile wiring end to end: the unit coverage of
// each stage lives in @keres/shared; this file pins the pipeline the export
// screen and the publish payload rely on.
const chapters = [{ id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter' as const }];
const scenes = [
  { id: 's-1', chapterId: 'ch-1', name: 'Opening', index: 1, body: 'Waves.', isDeleted: false },
  { id: 's-2', chapterId: null, name: 'Fragment', index: 2, body: 'Lost.', isDeleted: false },
];
const choices = [{ id: 'c-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Drift' }];
const labels = { goToPage: 'Go to page', goToScene: 'See' };

describe('shared manuscript pipeline', () => {
  it('renders the linear manuscript to markdown and text', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices,
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose scenes',
    });

    const markdown = buildManuscriptMarkdown(manuscript, labels);
    expect(markdown).toContain('# My Story');
    expect(markdown).toContain('## 1. Arrival');
    expect(markdown).toContain('### 1. Opening');
    expect(markdown).toContain('Waves.');
    expect(markdown).toContain('- Drift — See Fragment');
    expect(markdown).toContain('## Loose scenes');

    const text = buildManuscriptText(manuscript, labels);
    expect(text).toContain('My Story');
    expect(text).not.toContain('**');
  });

  it('drops the loose appendix when excluded', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices,
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose scenes',
    });

    const markdown = buildManuscriptMarkdown(manuscript, labels);
    expect(markdown).not.toContain('### 2. Fragment');
    expect(markdown).not.toContain('## Loose scenes');
    // The choice outlives its target as a name-only reference, with no link.
    expect(markdown).toContain('- Drift — See Fragment');
  });

  it('follows route steps in position order with the route subtitle', () => {
    const manuscript = compileRouteManuscript({
      title: 'My Story',
      routeName: 'Main',
      steps: [
        { id: 'step-2', routeId: 'r-1', position: 2, sceneId: 's-1', isDeleted: false },
        { id: 'step-1', routeId: 'r-1', position: 1, sceneId: 's-2', isDeleted: false },
      ],
      scenes,
      choices,
      looseHeadingLabel: 'Loose scenes',
    });

    const markdown = buildManuscriptMarkdown(manuscript, labels);
    expect(markdown).toContain('*Main*');
    expect(markdown.indexOf('### 1. Fragment')).toBeLessThan(markdown.indexOf('### 2. Opening'));
  });

  it('renders html anchors and packs a docx', async () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices,
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose scenes',
    });

    const html = buildManuscriptHtml(manuscript, labels);
    expect(html).toContain('<title>My Story</title>');
    expect(html).toContain('— See <a href="#scene-s2">Fragment</a>');

    const bytes = await buildManuscriptDocxBytes(manuscript, labels);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes[0]).toBe(80); // 'P'
    expect(bytes[1]).toBe(75); // 'K'
  });
});
