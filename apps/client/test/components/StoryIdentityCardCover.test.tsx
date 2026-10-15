import { act, cleanup, render } from '@testing-library/react-native';
import StoryIdentityCard from '@/src/components/features/story/StoryIdentityCard';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/src/theme', () => ({
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
jest.mock('@/src/components/common/display/CoverImage/CoverImage', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ galleryId, testID }: { galleryId?: string | null; testID?: string }) =>
      galleryId ? <Text testID={testID}>{galleryId}</Text> : null,
  };
});

afterEach(async () => {
  await act(async () => cleanup());
});

describe('the cover on the story card of the dashboard', () => {
  it('shows the cover beside what the story is, and keeps what the story says', async () => {
    const view = await render(
      <StoryIdentityCard type="linear" genre="Fantasy" coverGalleryId="gal-1" />,
    );

    expect(view.getByTestId('story-cover')).toBeTruthy();
    expect(view.getByText('Fantasy')).toBeTruthy();
  });

  it('is the card it was without one', async () => {
    const view = await render(<StoryIdentityCard type="linear" genre="Fantasy" />);

    expect(view.queryByTestId('story-cover')).toBeNull();
    expect(view.getByText('Fantasy')).toBeTruthy();
  });
});
