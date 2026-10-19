import type { Story } from '@keres/shared/entities/story/Story';
import { act, cleanup, render } from '@testing-library/react-native';
import StorySelectionListItem from '@/src/components/features/list-items/StorySelectionListItem';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@/src/theme/useThemeColors', () => ({
  useThemeColors: () => ({
    primary: '#B58500',
    text: '#171C22',
    textSecondary: '#52606E',
    card: '#E7F1FA',
    border: '#BFCBDA',
    star: '#8A6500',
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/src/components/common/display/CoverImage/CoverImage', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ galleryId, testID }: { galleryId?: string | null; testID?: string }) =>
      galleryId ? <Text testID={testID}>{galleryId}</Text> : null,
  };
});

const story = {
  id: 'story-1',
  title: 'Sea Chronicle',
  type: 'linear',
  description: null,
  genre: null,
  serverId: null,
  isFavorite: false,
  theme: 'seaOfStars',
} as unknown as Story;

const renderItem = (override: Partial<Story>) =>
  render(
    <StorySelectionListItem
      story={{ ...story, ...override } as Story}
      serverName={undefined}
      onSelectStory={jest.fn()}
      onToggleFavorite={jest.fn()}
      onEditStory={jest.fn()}
    />,
  );

afterEach(async () => {
  await act(async () => cleanup());
});

describe('the cover on the card of a story', () => {
  it('shows the cover of the story when it has one', async () => {
    const view = await renderItem({ coverGalleryId: 'gal-1' });

    expect(view.getByTestId('story-cover-story-1')).toBeTruthy();
  });

  it('keeps the card as it was when the story has none', async () => {
    const view = await renderItem({ coverGalleryId: null });

    expect(view.queryByTestId('story-cover-story-1')).toBeNull();
  });
});
