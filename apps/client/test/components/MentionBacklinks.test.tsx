import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
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
jest.mock('../../src/mentions/MentionContext', () => ({
  __esModule: true,
  useMentionBacklinks: (...args: unknown[]) => mockBacklinks(...args),
}));

const mockNavigate = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigate,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const backlink = (overrides = {}) => ({
  source: { type: 'Scene', id: 'scene-1', name: 'A beginning' },
  fields: ['summary'],
  mentionCount: 2,
  excerpt: 'Alice arrives in Wonderland.',
  ...overrides,
});

describe('MentionBacklinksSection', () => {
  it('asks for the backlinks of the entity it is given', async () => {
    mockBacklinks.mockReturnValue([]);
    await render(<MentionBacklinksSection entityType="Character" entityId="char-1" />);

    expect(mockBacklinks).toHaveBeenCalledWith('Character', 'char-1');
  });

  it('shows the empty state when nothing links back', async () => {
    mockBacklinks.mockReturnValue([]);
    const screen = await render(
      <MentionBacklinksSection entityType="Character" entityId="char-1" />,
    );

    expect(screen.getByText('backlinks_title')).toBeTruthy();
    expect(screen.getByText('backlinks_empty')).toBeTruthy();
  });

  it('lists every source with its excerpt', async () => {
    mockBacklinks.mockReturnValue([
      backlink(),
      backlink({
        source: { type: 'Scene', id: 'scene-2', name: 'A middle' },
        mentionCount: 1,
        excerpt: 'Alice stays.',
      }),
    ]);
    const screen = await render(
      <MentionBacklinksSection entityType="Character" entityId="char-1" />,
    );

    expect(screen.getByText('A beginning')).toBeTruthy();
    expect(screen.getByText('Alice arrives in Wonderland.')).toBeTruthy();
    expect(screen.getByText('A middle')).toBeTruthy();
  });

  it('opens the source when its row is tapped', async () => {
    mockBacklinks.mockReturnValue([backlink()]);
    const screen = await render(
      <MentionBacklinksSection entityType="Character" entityId="char-1" />,
    );

    // The card starts collapsed with its content untouchable; the reader opens it first.
    await fireEvent.press(screen.getByText('backlinks_title'));
    await fireEvent.press(screen.getByText('A beginning'));

    expect(mockNavigate).toHaveBeenCalledWith('Scene', 'scene-1');
  });
});
