import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockNavigateToDetail = jest.fn();
const mockUseScreenTour = jest.fn();
let mockSelectedStory: { id: string } | null = { id: 'story-1' };
let mockCommentListProps: {
  storyId: string;
  pageSize?: number;
  onPressItem?: (comment: { entityType: string; entityId: string }) => void;
} | null = null;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({ getParent: () => ({ setOptions: jest.fn() }) }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigateToDetail,
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: { background: '#fff', text: '#111', textSecondary: '#555' },
  }),
}));
jest.mock('../../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: () => undefined,
}));
jest.mock('@/src/components/features/comments/CommentList/CommentList', () => ({
  __esModule: true,
  default: (props: {
    storyId: string;
    pageSize?: number;
    onPressItem?: (comment: { entityType: string; entityId: string }) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockCommentListProps = props;
    return react.createElement(
      native.Text,
      {
        testID: 'comment-list-stub',
        onPress: () => props.onPressItem?.({ entityType: 'Character', entityId: 'character-1' }),
      },
      `comments for ${props.storyId}`,
    );
  },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import CommentListScreen from '../../../src/screens/comments/CommentListScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedStory = { id: 'story-1' };
  mockCommentListProps = null;
});

it('renders the story comment list for the selected story', async () => {
  const screen = await render(<CommentListScreen />);

  expect(screen.getByTestId('comment-list-stub')).toBeTruthy();
  expect(mockCommentListProps).toMatchObject({ storyId: 'story-1', pageSize: 20 });
});

it('navigates to the tapped comment target entity', async () => {
  const screen = await render(<CommentListScreen />);

  fireEvent.press(screen.getByTestId('comment-list-stub'));

  expect(mockNavigateToDetail).toHaveBeenCalledWith('Character', 'character-1');
});

it('shows an explicit empty state without a selected story', async () => {
  mockSelectedStory = null;
  const screen = await render(<CommentListScreen />);

  expect(screen.getByText('no_story_selected')).toBeTruthy();
  expect(screen.queryByTestId('comment-list-stub')).toBeNull();
});

it('requests its guided tour', async () => {
  await render(<CommentListScreen />);

  expect(mockUseScreenTour).toHaveBeenCalledWith('CommentsStack');
});
