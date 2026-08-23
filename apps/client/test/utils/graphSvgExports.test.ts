import { buildLocationGraphLayout } from '../../src/utils/locationGraphLayout';
import {
  renderLocationGraphMapSvg,
  type LocationGraphSvgOptions,
} from '../../src/utils/locationGraphSvg';
import { buildStoryGraphLayout } from '../../src/utils/storyGraphLayout';
import { renderStoryMapSvg, type StoryMapSvgOptions } from '../../src/utils/storyGraphSvg';

const COLORS = {
  background: '#ffffff',
  surface: '#f2f2f2',
  text: '#111111',
  textSecondary: '#666666',
  border: '#cccccc',
  accent: '#0055ff',
  error: '#cc0000',
  primaryContainer: '#dde7ff',
  primary: '#0033aa',
};

const storyOptions = (overrides: Partial<StoryMapSvgOptions> = {}): StoryMapSvgOptions => ({
  title: 'A Queda',
  subtitle: '3 cenas, 2 escolhas',
  showEdgeLabels: true,
  labels: { start: 'Início', finish: 'Fim', loops: 'Ciclos', detached: 'Desconectadas' },
  colors: COLORS,
  ...overrides,
});

const locationOptions = (
  overrides: Partial<LocationGraphSvgOptions> = {},
): LocationGraphSvgOptions => ({
  title: 'A Queda',
  subtitle: '3 locais',
  labels: { isolated: 'Sem relações', contains: 'Contém', connectedTo: 'Conectado a' },
  colors: COLORS,
  ...overrides,
});

const scene = (
  id: string,
  name: string,
  chapterId = 'c1',
  index = 0,
  extra: Record<string, unknown> = {},
) => ({
  id,
  name,
  chapterId,
  index,
  isStart: index === 0,
  isFinish: false,
  ...extra,
});

const storyLayout = (names: string[] = ['Abertura', 'Encontro']) => {
  const scenes = names.map((name, index) => scene(`s${index}`, name, 'c1', index));
  const choices = scenes.slice(1).map((target, index) => ({
    id: `ch${index}`,
    sceneId: `s${index}`,
    nextSceneId: target.id,
    text: 'seguir',
  }));
  return buildStoryGraphLayout(scenes as never, choices, [
    { id: 'c1', name: 'Capítulo 1', index: 1 },
  ]);
};

const locationLayout = () =>
  buildLocationGraphLayout(
    [
      { id: 'reino', name: 'Reino' },
      { id: 'cidade', name: 'Cidade' },
    ],
    [{ id: 'r1', locationAId: 'reino', locationBId: 'cidade', relationType: 'contains' }],
  );

/**
 * Os dois mapas são exportados como arquivo SVG, aberto fora do app. Um `&` no nome de uma
 * cena inviabiliza o documento inteiro, e o erro só aparece quando a pessoa tenta abrir o
 * arquivo - longe do momento em que exportou.
 */
const RENDERERS = [
  {
    name: 'story map',
    render: () => renderStoryMapSvg(storyLayout(), storyOptions()),
    renderWith: (title: string) => renderStoryMapSvg(storyLayout(), storyOptions({ title })),
    renderNamed: (sceneName: string) => renderStoryMapSvg(storyLayout([sceneName]), storyOptions()),
    renderEmpty: () => renderStoryMapSvg(buildStoryGraphLayout([], [], []), storyOptions()),
  },
  {
    name: 'location map',
    render: () => renderLocationGraphMapSvg(locationLayout(), locationOptions()),
    renderWith: (title: string) =>
      renderLocationGraphMapSvg(locationLayout(), locationOptions({ title })),
    renderNamed: (locationName: string) =>
      renderLocationGraphMapSvg(
        buildLocationGraphLayout([{ id: 'a', name: locationName }], []),
        locationOptions(),
      ),
    renderEmpty: () =>
      renderLocationGraphMapSvg(buildLocationGraphLayout([], []), locationOptions()),
  },
];

describe.each(RENDERERS)('$name SVG export', ({ render, renderWith, renderNamed, renderEmpty }) => {
  it('emits a standalone document with an XML declaration', () => {
    const svg = render();

    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('opens and closes every tag it emits', () => {
    const svg = render();

    for (const tag of ['svg', 'title', 'g']) {
      expect(svg.split(`<${tag}`).length - 1).toBe(svg.split(`</${tag}>`).length - 1);
    }
  });

  it('declares a viewBox matching its width and height', () => {
    const svg = render();
    const [, width, height] = svg.match(/<svg [^>]*width="([\d.]+)" height="([\d.]+)"/)!;

    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
  });

  it('escapes XML metacharacters in the title', () => {
    const svg = renderWith('Tolkien & <Cia>');

    expect(svg).toContain('<title>Tolkien &amp; &lt;Cia&gt;</title>');
    expect(svg).not.toContain('<Cia>');
  });

  it.each([
    ['ampersand', '&', '&amp;'],
    ['less than', '<', '&lt;'],
    ['greater than', '>', '&gt;'],
  ])('escapes a bare %s typed by the author', (_label, raw, escaped) => {
    const svg = renderNamed(`x${raw}y`);

    expect(svg).toContain(`x${escaped}y`);
  });

  it('renders an empty story without producing a broken document', () => {
    const svg = renderEmpty();

    expect(svg).toContain('<svg');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('uses the caller-provided theme colours', () => {
    expect(render()).toContain('fill="#ffffff"');
  });

  it('is deterministic for the same input', () => {
    expect(render()).toBe(render());
  });
});

describe('story map specifics', () => {
  it('exports the same left-to-right geometry used by wide screens', () => {
    const scenes = [scene('start', 'Início', 'c1', 0), scene('end', 'Fim', 'c1', 1)];
    const layout = buildStoryGraphLayout(
      scenes as never,
      [{ id: 'choice', sceneId: 'start', nextSceneId: 'end', text: 'seguir' }],
      [{ id: 'c1', name: 'Capítulo 1', index: 1 }],
      'left-to-right',
    );

    expect(layout.nodes.find((node) => node.id === 'end')!.x).toBeGreaterThan(
      layout.nodes.find((node) => node.id === 'start')!.x,
    );
    expect(renderStoryMapSvg(layout, storyOptions())).toContain(`d="${layout.edges[0].path}"`);
  });

  it('reserves room for the header above the graph', () => {
    const layout = storyLayout();
    const svg = renderStoryMapSvg(layout, storyOptions());
    const [, height] = svg.match(/<svg [^>]*height="([\d.]+)"/)!;

    expect(Number(height)).toBeGreaterThan(layout.height);
  });

  it('draws a path for every edge of the layout', () => {
    const layout = storyLayout(['Abertura', 'Encontro', 'Desfecho']);
    const svg = renderStoryMapSvg(layout, storyOptions());

    for (const edge of layout.edges) {
      expect(svg).toContain(`d="${edge.path}"`);
    }
  });

  it('omits choice labels when the caller turns them off', () => {
    const layout = storyLayout();

    expect(renderStoryMapSvg(layout, storyOptions({ showEdgeLabels: true }))).toContain('seguir');
    expect(renderStoryMapSvg(layout, storyOptions({ showEdgeLabels: false }))).not.toContain(
      'seguir',
    );
  });

  it('shows the legend labels the caller passed', () => {
    const svg = renderStoryMapSvg(storyLayout(), storyOptions());

    expect(svg).toContain('Início');
  });
});

describe('location map specifics', () => {
  it('labels both relation kinds in the legend', () => {
    const svg = renderLocationGraphMapSvg(locationLayout(), locationOptions());

    expect(svg).toContain('Contém');
  });

  it('only shows the isolated legend when there is an isolated location', () => {
    const isolated = buildLocationGraphLayout([{ id: 'a', name: 'Ávalon' }], []);

    expect(renderLocationGraphMapSvg(isolated, locationOptions())).toContain('Sem relações');
    expect(renderLocationGraphMapSvg(locationLayout(), locationOptions())).not.toContain(
      'Sem relações',
    );
  });

  it('draws a path for every relation', () => {
    const layout = locationLayout();
    const svg = renderLocationGraphMapSvg(layout, locationOptions());

    for (const edge of layout.edges) {
      expect(svg).toContain(`d="${edge.path}"`);
    }
  });
});
