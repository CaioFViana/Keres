import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import ScenePagesEntry from '../../../../src/components/features/scenes/ScenePages/ScenePagesEntry';

const mockOnOpen = jest.fn();
let mockMedium: string | null = null;
let mockPageCount = 0;

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
  }),
}));
jest.mock('../../../../src/hooks/useSceneArcMedium', () => ({
  __esModule: true,
  useSceneArcMedium: () => mockMedium,
}));
jest.mock('../../../../src/hooks/useScenePages', () => ({
  __esModule: true,
  useScenePages: () => ({
    pages: Array.from({ length: mockPageCount }, (_, index) => ({ page: { id: `p${index}` } })),
  }),
}));
jest.mock('../../../../src/components/common/display/DetailField/DetailField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onPress,
    }: {
      label: string;
      value: string;
      onPress?: () => void;
    }) => <Text testID="entry" onPress={onPress}>{`${label}|${value}`}</Text>,
  };
});

const scene = { id: 's1', storyId: 'story-1', chapterId: null };

afterEach(async () => {
  await act(async () => cleanup());
  mockMedium = null;
  mockPageCount = 0;
  mockOnOpen.mockReset();
});

describe('ScenePagesEntry', () => {
  it('stays out of the way of a prose scene with no pages', async () => {
    const view = await render(<ScenePagesEntry scene={scene} onOpen={mockOnOpen} />);

    expect(view.queryByTestId('entry')).toBeNull();
  });

  it('is offered in a comic, even with no pages yet', async () => {
    mockMedium = 'comic';
    const view = await render(<ScenePagesEntry scene={scene} onOpen={mockOnOpen} />);

    expect(view.getByTestId('entry').props.children).toBe(
      'scene_pages|scene_pages_empty_short_page',
    );
  });

  it('counts frames in a storyboard and opens the pages', async () => {
    mockMedium = 'storyboard';
    mockPageCount = 3;
    const view = await render(<ScenePagesEntry scene={scene} onOpen={mockOnOpen} />);

    expect(view.getByTestId('entry').props.children).toBe('scene_frames|scene_pages_count_frame:3');
    await fireEvent.press(view.getByTestId('entry'));
    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });

  it('never hides pages that exist, whatever the medium', async () => {
    mockMedium = 'generic';
    mockPageCount = 2;
    const view = await render(<ScenePagesEntry scene={scene} onOpen={mockOnOpen} />);

    expect(view.getByTestId('entry').props.children).toBe('scene_pages|scene_pages_count_page:2');
  });
});
