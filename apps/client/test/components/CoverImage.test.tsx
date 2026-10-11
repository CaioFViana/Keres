import { act, cleanup, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import CoverImage from '../../src/components/common/display/CoverImage/CoverImage';

let mockRow: { localPath: string; title: string | null; fileName: string } | null = null;
let mockUri: string | null = null;
const mockGalleryRow = jest.fn();

jest.mock('expo-image', () => ({
  __esModule: true,
  Image: 'ExpoImage',
}));
jest.mock('../../src/hooks/useGalleryMedia', () => ({
  __esModule: true,
  useGalleryRow: (...args: unknown[]) => {
    mockGalleryRow(...args);
    return mockRow;
  },
}));
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({
  __esModule: true,
  useResolvedMediaUri: () => mockUri,
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { border: '#ccc' } }),
}));

const fallback = <Text testID="fallback">no cover</Text>;

beforeEach(() => {
  mockRow = null;
  mockUri = null;
  mockGalleryRow.mockClear();
});

afterEach(async () => {
  await act(async () => cleanup());
});

describe('CoverImage', () => {
  it('draws the picture of the cover in its frame', async () => {
    mockRow = { localPath: '/m/c.png', title: 'Cover', fileName: 'c.png' };
    mockUri = 'file:///m/c.png';

    const view = await render(
      <CoverImage galleryId="g1" width={84} height={120} testID="cover" fallback={fallback} />,
    );

    const image = view.getByTestId('cover');
    expect(image.props.source).toEqual({ uri: 'file:///m/c.png' });
    expect(image.props.accessibilityLabel).toBe('Cover');
    expect(view.queryByTestId('fallback')).toBeNull();
  });

  it('draws the fallback, and looks nothing up, when there is no cover', async () => {
    const view = await render(
      <CoverImage galleryId={null} width={84} height={120} fallback={fallback} />,
    );

    expect(view.getByTestId('fallback')).toBeTruthy();
    expect(mockGalleryRow).not.toHaveBeenCalled();
  });

  it('draws the fallback while the file is not on this device', async () => {
    mockRow = { localPath: '/m/c.png', title: null, fileName: 'c.png' };
    mockUri = null;

    const view = await render(
      <CoverImage galleryId="g1" width={84} height={120} fallback={fallback} />,
    );

    expect(view.getByTestId('fallback')).toBeTruthy();
  });

  it('draws nothing at all when there is neither a cover nor a fallback', async () => {
    const view = await render(<CoverImage galleryId={undefined} width={84} height={120} />);

    expect(view.toJSON()).toBeNull();
  });
});
