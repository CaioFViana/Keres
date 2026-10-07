import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import SceneMusicEntry from '../../../../src/components/features/scenes/SceneMusic/SceneMusicEntry';

const mockOnOpen = jest.fn();
let mockMedium: string | null = null;
let mockCount = 0;

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
jest.mock('../../../../src/hooks/useSceneMusic', () => ({
  __esModule: true,
  useSceneMusic: () => ({
    views: Array.from({ length: mockCount }, (_, index) => ({ music: { id: `m${index}` } })),
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
  mockCount = 0;
  mockOnOpen.mockReset();
});

describe('SceneMusicEntry', () => {
  it('is offered in a novel, with no music yet', async () => {
    const view = await render(<SceneMusicEntry scene={scene} onOpen={mockOnOpen} />);

    expect(view.getByTestId('entry').props.children).toBe(
      'scene_music_word_music|scene_music_empty_short',
    );
  });

  it('counts the music of the scene, under the word of the work', async () => {
    mockMedium = 'screenplay';
    mockCount = 3;
    const view = await render(<SceneMusicEntry scene={scene} onOpen={mockOnOpen} />);

    expect(view.getByTestId('entry').props.children).toBe(
      'scene_music_word_cues|scene_music_count:3',
    );
  });

  it('opens the music of the scene when pressed', async () => {
    const view = await render(<SceneMusicEntry scene={scene} onOpen={mockOnOpen} />);

    await fireEvent.press(view.getByTestId('entry'));

    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });
});
