import { act, fireEvent, render } from '@testing-library/react-native';
import BoardNodeSheetGalleryPreview from '../../src/components/features/boards/BoardNodeSheetGalleryPreview';
import ImageZoomViewer from '../../src/components/features/media/MediaPlayer/ImageZoomViewer';
import { useResolvedMediaUri } from '../../src/hooks/useResolvedMediaUri';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      border: '#333',
    },
  }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({ useResolvedMediaUri: jest.fn() }));
jest.mock('../../src/components/features/media/MediaPlayer/ImageZoomViewer', () =>
  jest.fn(() => null),
);

const uriMock = useResolvedMediaUri as jest.Mock;
const ViewerMock = ImageZoomViewer as unknown as jest.Mock;

const IMAGE = {
  mediaType: 'image',
  mimeType: 'image/png',
  localPath: 'file:///a.png',
  thumbnailPath: null,
};

function lastViewerProps(): { visible: boolean; uri: string; onClose: () => void } {
  return ViewerMock.mock.calls[ViewerMock.mock.calls.length - 1][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  uriMock.mockReturnValue('file:///resolved.png');
});

it('shows the gallery picture and opens the fullscreen zoom viewer on tap', async () => {
  const view = await render(<BoardNodeSheetGalleryPreview galleryMedia={IMAGE} />);

  expect(uriMock).toHaveBeenCalledWith('file:///a.png');
  expect(view.getByTestId('board-gallery-preview')).toBeTruthy();
  expect(lastViewerProps()).toMatchObject({ visible: false, uri: 'file:///resolved.png' });

  await fireEvent.press(view.getByTestId('board-gallery-preview'));
  expect(lastViewerProps()).toMatchObject({ visible: true, uri: 'file:///resolved.png' });

  await act(async () => {
    lastViewerProps().onClose();
  });
  expect(lastViewerProps()).toMatchObject({ visible: false });
});

it('previews a video pin through its extracted frame', async () => {
  await render(
    <BoardNodeSheetGalleryPreview
      galleryMedia={{
        mediaType: 'video',
        mimeType: 'video/mp4',
        localPath: 'file:///a.mp4',
        thumbnailPath: 'file:///thumb.jpg',
      }}
    />,
  );

  expect(uriMock).toHaveBeenCalledWith('file:///thumb.jpg');
});

it('renders nothing when the pin has no picture', async () => {
  const view = await render(<BoardNodeSheetGalleryPreview galleryMedia={undefined} />);
  expect(view.queryByTestId('board-gallery-preview')).toBeNull();
  expect(ViewerMock).not.toHaveBeenCalled();

  await view.rerender(
    <BoardNodeSheetGalleryPreview
      galleryMedia={{
        mediaType: 'document',
        mimeType: 'application/pdf',
        localPath: null,
        thumbnailPath: null,
      }}
    />,
  );
  expect(view.queryByTestId('board-gallery-preview')).toBeNull();
  expect(ViewerMock).not.toHaveBeenCalled();
});
