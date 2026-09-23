import { fireEvent, render } from '@testing-library/react-native';
import { MentionBacklinksSection } from '../../src/components/features/mentions/MentionBacklinksSection';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockBacklinks = jest.fn();
const mockAmbiguous = jest.fn();
jest.mock('../../src/mentions/MentionContext', () => ({
  __esModule: true,
  useMentionBacklinks: (...args: unknown[]) => mockBacklinks(...args),
  useAmbiguousMentions: (...args: unknown[]) => mockAmbiguous(...args),
}));

const mockNavigate = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigate,
}));

jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: { id: 'story-1' } }),
}));

const mockCanEdit = jest.fn(() => true);
jest.mock('../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit(), loading: false }),
}));

const mockRelations = jest.fn(
  (): { relationId: string; otherType: string; otherId: string }[] => [],
);
jest.mock('../../src/hooks/useSeeAlsoRelations', () => ({
  __esModule: true,
  useSeeAlsoRelations: () => ({ relations: mockRelations(), loading: false }),
}));

const mockResolve = jest.fn();
jest.mock('../../src/hooks/useResolveAmbiguousMention', () => ({
  __esModule: true,
  useResolveAmbiguousMention: () => mockResolve,
}));

jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ term: (type: string) => type }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockBacklinks.mockReturnValue([]);
  mockAmbiguous.mockReturnValue([]);
  mockCanEdit.mockReturnValue(true);
  mockRelations.mockReturnValue([]);
});

const backlink = (overrides = {}) => ({
  source: { type: 'Scene', id: 'scene-1', name: 'A beginning' },
  fields: ['summary'],
  mentionCount: 2,
  excerpt: 'Alice arrives in Wonderland. Alice stays.',
  occurrences: [
    { field: 'summary', mentionCount: 2, excerpt: 'Alice arrives in Wonderland. Alice stays.' },
  ],
  ...overrides,
});

const ambiguous = (overrides = {}) => ({
  name: 'Robin',
  field: 'summary',
  mentionCount: 2,
  excerpt: 'Robin arrives. Robin stays.',
  candidates: [
    { type: 'Character', id: 'c1', name: 'Robin' },
    { type: 'Character', id: 'c2', name: 'Robin' },
  ],
  ...overrides,
});

describe('MentionBacklinksSection', () => {
  it('asks for the backlinks of the entity it is given', async () => {
    await render(<MentionBacklinksSection entityType="Character" entityId="char-1" />);

    expect(mockBacklinks).toHaveBeenCalledWith('Character', 'char-1');
  });

  it('shows the empty state when nothing links back', async () => {
    const screen = await render(
      <MentionBacklinksSection entityType="Character" entityId="char-1" />,
    );

    expect(screen.getByText('backlinks_title')).toBeTruthy();
    expect(screen.getByText('backlinks_empty')).toBeTruthy();
    expect(screen.queryByText('ambiguous_mentions_title')).toBeNull();
  });

  it('lists one row per field occurrence with its excerpt', async () => {
    mockBacklinks.mockReturnValue([
      backlink({
        fields: ['summary', 'extraNotes'],
        mentionCount: 3,
        occurrences: [
          { field: 'summary', mentionCount: 2, excerpt: 'Alice arrives in Wonderland.' },
          { field: 'extraNotes', mentionCount: 1, excerpt: 'Alice stays.' },
        ],
      }),
    ]);
    const screen = await render(
      <MentionBacklinksSection entityType="Character" entityId="char-1" />,
    );

    expect(screen.getAllByText('A beginning')).toHaveLength(2);
    expect(screen.getByText('Alice arrives in Wonderland.')).toBeTruthy();
    expect(screen.getByText('Alice stays.')).toBeTruthy();
  });

  it('opens the source when an occurrence row is tapped', async () => {
    mockBacklinks.mockReturnValue([backlink()]);
    const screen = await render(
      <MentionBacklinksSection entityType="Character" entityId="char-1" />,
    );

    // The card starts collapsed with its content untouchable; the reader opens it first.
    await fireEvent.press(screen.getByText('backlinks_title'));
    await fireEvent.press(screen.getByText('A beginning'));

    expect(mockNavigate).toHaveBeenCalledWith('Scene', 'scene-1');
  });

  it('hides ambiguous suggestions from readers and from sources See also cannot link', async () => {
    mockAmbiguous.mockReturnValue([ambiguous()]);
    mockCanEdit.mockReturnValue(false);
    const readOnly = await render(
      <MentionBacklinksSection entityType="Scene" entityId="scene-1" />,
    );
    expect(readOnly.queryByText('ambiguous_mentions_title')).toBeNull();

    mockCanEdit.mockReturnValue(true);
    const note = await render(<MentionBacklinksSection entityType="Note" entityId="note-1" />);
    expect(note.queryByText('ambiguous_mentions_title')).toBeNull();
  });

  it('offers each claimant of an ambiguous name for one-touch linking', async () => {
    mockAmbiguous.mockReturnValue([ambiguous()]);
    const screen = await render(<MentionBacklinksSection entityType="Scene" entityId="scene-1" />);

    await fireEvent.press(screen.getByText('ambiguous_mentions_title'));
    expect(screen.getByText('Robin arrives. Robin stays.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ambiguous-resolve-Character-c2'));

    expect(mockResolve).toHaveBeenCalledWith(
      'story-1',
      { entityType: 'Scene', entityId: 'scene-1' },
      { entityType: 'Character', entityId: 'c2' },
    );
  });

  it('drops candidates that are already linked in See also', async () => {
    mockAmbiguous.mockReturnValue([ambiguous()]);
    mockRelations.mockReturnValue([{ relationId: 'r1', otherType: 'Character', otherId: 'c1' }]);
    const screen = await render(<MentionBacklinksSection entityType="Scene" entityId="scene-1" />);

    await fireEvent.press(screen.getByText('ambiguous_mentions_title'));
    expect(screen.queryByTestId('ambiguous-resolve-Character-c1')).toBeNull();
    expect(screen.getByTestId('ambiguous-resolve-Character-c2')).toBeTruthy();
  });

  it('drops claimants See also cannot link, and the suggestion with them', async () => {
    mockAmbiguous.mockReturnValue([
      ambiguous({
        candidates: [{ type: 'Note', id: 'n1', name: 'Robin' }],
      }),
    ]);
    const screen = await render(<MentionBacklinksSection entityType="Scene" entityId="scene-1" />);

    expect(screen.queryByText('ambiguous_mentions_title')).toBeNull();
  });
});
