import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { StoryArcSelect } from '../../src/db/schema';
import UniverseWorksSection from '../../src/components/features/arcs/UniverseWorksSection';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      primaryContainer: '#ddf',
      onPrimaryContainer: '#008',
      surface: '#fff',
      border: '#ccc',
    },
  }),
}));
jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  useStoryVocabulary: () => ({
    term: (_type: string, plural?: boolean) => (plural ? 'Arcs' : 'Arc'),
  }),
}));

const arc = (id: string, title: string, medium = 'generic', author: string | null = null) =>
  ({ id, title, medium, author }) as unknown as StoryArcSelect;

afterEach(async () => {
  await act(async () => cleanup());
});

describe('UniverseWorksSection', () => {
  it('shows one card per work with its form and author', async () => {
    const view = await render(
      <UniverseWorksSection
        arcs={[arc('a', 'Book One', 'comic', 'Ana'), arc('b', 'Season 1', 'screenplay')]}
        onOpenArcs={jest.fn()}
      />,
    );

    expect(view.getByText('Book One')).toBeTruthy();
    expect(view.getByText('arc_medium_comic · Ana')).toBeTruthy();
    expect(view.getByText('arc_medium_screenplay')).toBeTruthy();
  });

  it('says what a universe is while there is a single work', async () => {
    const view = await render(
      <UniverseWorksSection arcs={[arc('a', 'One')]} onOpenArcs={jest.fn()} />,
    );

    expect(view.queryByText(/universe_works_intro/)).toBeTruthy();
  });

  it('does not repeat it once there are several works', async () => {
    const view = await render(
      <UniverseWorksSection arcs={[arc('a', 'One'), arc('b', 'Two')]} onOpenArcs={jest.fn()} />,
    );

    expect(view.queryByText(/universe_works_intro/)).toBeNull();
  });

  it('opens a work from its card, and all of them from Manage', async () => {
    const onOpenArc = jest.fn();
    const onOpenArcs = jest.fn();
    const view = await render(
      <UniverseWorksSection
        arcs={[arc('a', 'One')]}
        onOpenArcs={onOpenArcs}
        onOpenArc={onOpenArc}
      />,
    );

    await fireEvent.press(view.getByTestId('universe-work-a'));
    expect(onOpenArc).toHaveBeenCalledWith('a');
    await fireEvent.press(view.getByText('universe_works_manage_short'));
    expect(onOpenArcs).toHaveBeenCalledTimes(1);
  });

  it('has no card to add a work for someone who cannot add one', async () => {
    const view = await render(
      <UniverseWorksSection arcs={[arc('a', 'One')]} onOpenArcs={jest.fn()} />,
    );

    expect(view.queryByTestId('universe-work-add')).toBeNull();
  });

  it('adds a work from its last card', async () => {
    const onAddArc = jest.fn();
    const view = await render(
      <UniverseWorksSection arcs={[arc('a', 'One')]} onOpenArcs={jest.fn()} onAddArc={onAddArc} />,
    );

    await fireEvent.press(view.getByTestId('universe-work-add'));
    expect(onAddArc).toHaveBeenCalledTimes(1);
  });

  it('draws an unknown form as a generic one instead of failing', async () => {
    const view = await render(
      <UniverseWorksSection arcs={[arc('a', 'Odd', 'hologram')]} onOpenArcs={jest.fn()} />,
    );

    expect(view.getByText('arc_medium_generic')).toBeTruthy();
  });
});
