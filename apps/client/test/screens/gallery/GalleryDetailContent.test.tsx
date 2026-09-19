import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const mockGetById = jest.fn();
const mockUpdateGallery = jest.fn();
const mockUpdateGalleryFavoriteStatus = jest.fn();
const mockDeleteGallery = jest.fn();
const mockGetOwnersForGallery = jest.fn();
const mockSetOwnersForGallery = jest.fn();
const mockDeleteLocal = jest.fn();
const mockShowNotification = jest.fn();
const mockAlert = jest.fn();
const mockOpenGalleryExternally = jest.fn();
const mockOwnerOptions: { current: { label: string; options: unknown[] }[] } = { current: [] };
const mockResolvedUri: { current: string | null } = { current: null };
const mockCanEdit: { current: boolean } = { current: true };
const mockStory: { current: { id: string } | null } = { current: { id: 'story-1' } };
const mockDb = {};
let mockPillProps: {
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
} | null = null;
let mockZoomProps: { visible: boolean; onClose: () => void } | null = null;

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-image', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    Image: (props: { source?: { uri?: string } }) => (
      <Text testID="gallery-image">{props.source?.uri ?? 'no-uri'}</Text>
    ),
  };
});
jest.mock('@/src/components/features/list-items/GalleryGridItem', () => ({
  __esModule: true,
  iconForGalleryMedia: () => 'image-outline',
}));
jest.mock('@/src/components/features/media/MediaPlayer/AudioPreviewPlayer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ uri }: { uri: string }) => <Text testID="audio-player">{uri}</Text>,
  };
});
jest.mock('@/src/components/features/media/MediaPlayer/VideoPreviewPlayer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ uri }: { uri: string }) => <Text testID="video-player">{uri}</Text>,
  };
});
jest.mock('@/src/components/features/media/MediaPlayer/ImageZoomViewer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { visible: boolean; onClose: () => void }) => {
      mockZoomProps = props;
      return <Text testID="zoom-viewer">{props.visible ? 'zoom-open' : 'zoom-closed'}</Text>;
    },
  };
});
jest.mock('@/src/components/features/favorites/FavoritedByList/FavoritedByList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="favorited-marker">favorited</Text>,
  };
});
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { selectedValues: string[]; onSelectionChange: (v: string[]) => void }) => {
      mockPillProps = props;
      return (
        <Text
          testID="owners-pill"
          onPress={() => props.onSelectionChange(['Character:char-2'])}
        >{`owners:${props.selectedValues.join(',')}`}</Text>
      );
    },
  };
});
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useGalleryOwnerOptions', () => {
  const actual = jest.requireActual('../../../src/hooks/useGalleryOwnerOptions');
  return {
    ...actual,
    useGalleryOwnerOptions: () => ({ groupedOptions: mockOwnerOptions.current }),
  };
});
jest.mock('../../../src/hooks/useResolvedMediaUri', () => ({
  __esModule: true,
  useResolvedMediaUri: () => mockResolvedUri.current,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit.current }),
}));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: true }),
}));
jest.mock('../../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { deleteLocal: (...args: unknown[]) => mockDeleteLocal(...args) },
}));
jest.mock('../../../src/services/storymanagement/GalleryRelationService', () => ({
  __esModule: true,
  createGalleryRelationService: () => ({
    getOwnersForGallery: mockGetOwnersForGallery,
    setOwnersForGallery: mockSetOwnersForGallery,
  }),
}));
jest.mock('../../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: () => ({
    getById: mockGetById,
    updateGallery: mockUpdateGallery,
    updateGalleryFavoriteStatus: mockUpdateGalleryFavoriteStatus,
    deleteGallery: mockDeleteGallery,
  }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory.current }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ccf',
      secondary: '#888',
      star: '#fa0',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/utils/openGalleryExternally', () => ({
  __esModule: true,
  openGalleryExternally: (...args: unknown[]) => mockOpenGalleryExternally(...args),
}));
const mockI18n = { t: (key: string) => key };
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockI18n,
}));

import GalleryDetailContent from '../../../src/screens/gallery/GalleryDetailContent';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeMedia(overrides = {}) {
  return {
    id: 'gallery-1',
    storyId: 'story-1',
    fileName: 'cover.jpg',
    mediaType: 'image',
    mimeType: 'image/jpeg',
    sizeBytes: 2048,
    localPath: '/local/cover.jpg',
    thumbnailPath: '/local/cover-thumb.jpg',
    hash: 'hash-1',
    title: 'Cover',
    extraNotes: 'Notes',
    isFavorite: false,
    downloadState: 'ready',
    uploadState: 'uploaded',
    sourceUrl: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    serverId: null,
    ...overrides,
  };
}

describe('GalleryDetailContent', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPillProps = null;
    mockZoomProps = null;
    mockOwnerOptions.current = [];
    mockResolvedUri.current = null;
    mockCanEdit.current = true;
    mockStory.current = { id: 'story-1' };
    mockGetById.mockResolvedValue(makeMedia());
    mockGetOwnersForGallery.mockResolvedValue([]);
    mockUpdateGallery.mockResolvedValue({});
    mockUpdateGalleryFavoriteStatus.mockResolvedValue({});
    mockDeleteGallery.mockResolvedValue({});
    mockSetOwnersForGallery.mockResolvedValue({});
  });

  it('loads the media and renders its metadata', async () => {
    const view = await render(<GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />);

    await waitFor(() => expect(view.getByText('cover.jpg')).toBeTruthy());
    expect(mockGetById).toHaveBeenCalledWith('gallery-1');
    expect(mockGetOwnersForGallery).toHaveBeenCalledWith('story-1', 'gallery-1');
    expect(view.getByText('media_type_image')).toBeTruthy();
    expect(view.getByText('image/jpeg')).toBeTruthy();
    expect(view.getByText('2 KB')).toBeTruthy();
    expect(view.getByText('media_synced')).toBeTruthy();
    expect(view.getByTestId('favorited-marker')).toBeTruthy();
    expect(view.getByTestId('owners-pill')).toBeTruthy();
  });

  it('reports no story and missing media as errors', async () => {
    mockStory.current = null;
    const noStory = await render(
      <GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />,
    );
    await waitFor(() => expect(noStory.getByText('no_story_selected')).toBeTruthy());

    mockStory.current = { id: 'story-1' };
    mockGetById.mockResolvedValue(null);
    const missing = await render(
      <GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />,
    );
    await waitFor(() => expect(missing.getByText('media_not_found')).toBeTruthy());
  });

  it('previews a local image and opens the zoom viewer', async () => {
    mockResolvedUri.current = 'file:///local/cover.jpg';
    const view = await render(<GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />);

    await waitFor(() => expect(view.getByTestId('gallery-image')).toBeTruthy());
    expect(view.getByTestId('gallery-image').props.children).toBe('file:///local/cover.jpg');
    expect(view.getByTestId('zoom-viewer').props.children).toBe('zoom-closed');

    await fireEvent.press(view.getByTestId('gallery-image'));
    await waitFor(() => expect(view.getByTestId('zoom-viewer').props.children).toBe('zoom-open'));
    await act(async () => {
      mockZoomProps?.onClose();
    });
    await waitFor(() => expect(view.getByTestId('zoom-viewer').props.children).toBe('zoom-closed'));
  });

  it('renders audio and video players for local media', async () => {
    mockResolvedUri.current = 'file:///local/clip';
    mockGetById.mockResolvedValue(makeMedia({ mediaType: 'video', fileName: 'clip.mp4' }));
    const video = await render(<GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />);
    await waitFor(() => expect(video.getByTestId('video-player')).toBeTruthy());

    mockGetById.mockResolvedValue(makeMedia({ mediaType: 'audio', fileName: 'clip.mp3' }));
    const audio = await render(<GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />);
    await waitFor(() => expect(audio.getByTestId('audio-player')).toBeTruthy());
  });

  it('opens links outside and warns when nothing handles them', async () => {
    mockGetById.mockResolvedValue(
      makeMedia({ mediaType: 'link', fileName: 'link', sourceUrl: 'https://example.com' }),
    );
    mockOpenGalleryExternally.mockResolvedValue(true);
    const view = await render(<GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />);

    await waitFor(() => expect(view.getByText('https://example.com')).toBeTruthy());
    await fireEvent.press(view.getByText('gallery_open_outside'));
    await waitFor(() => expect(mockOpenGalleryExternally).toHaveBeenCalled());
    expect(mockShowNotification).not.toHaveBeenCalledWith(
      expect.stringContaining('gallery_open_outside_failed'),
      expect.anything(),
    );

    mockOpenGalleryExternally.mockResolvedValue(false);
    await fireEvent.press(view.getByText('gallery_open_outside'));
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('gallery_open_outside_failed'),
        'warning',
      ),
    );
  });

  it('saves title, notes and owners, then closes', async () => {
    const onClose = jest.fn();
    mockGetOwnersForGallery.mockResolvedValue([{ ownerType: 'Character', ownerId: 'char-1' }]);
    const view = await render(<GalleryDetailContent galleryId="gallery-1" onClose={onClose} />);

    await waitFor(() => expect(view.getByText('cover.jpg')).toBeTruthy());
    await fireEvent.changeText(view.getByPlaceholderText('media_title_placeholder'), 'New title');
    await fireEvent.press(view.getByTestId('owners-pill'));
    expect(mockPillProps?.selectedValues).toEqual(['Character:char-2']);
    await fireEvent.press(view.getByText('save_changes'));

    await waitFor(() =>
      expect(mockUpdateGallery).toHaveBeenCalledWith('user-1', 'gallery-1', {
        title: 'New title',
        extraNotes: 'Notes',
      }),
    );
    expect(mockSetOwnersForGallery).toHaveBeenCalledWith('user-1', 'story-1', 'gallery-1', [
      { ownerType: 'Character', ownerId: 'char-2' },
    ]);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('media_updated_successfully'),
      'success',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('reports save failures without closing', async () => {
    await withSilencedConsole(['error'], async () => {
      const onClose = jest.fn();
      mockUpdateGallery.mockRejectedValue(new Error('nope'));
      const view = await render(<GalleryDetailContent galleryId="gallery-1" onClose={onClose} />);

      await waitFor(() => expect(view.getByText('cover.jpg')).toBeTruthy());
      await fireEvent.press(view.getByText('save_changes'));

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.stringContaining('media_save_failed'),
          'error',
        ),
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('deletes the record and its local files after confirmation', async () => {
    const onClose = jest.fn();
    const view = await render(<GalleryDetailContent galleryId="gallery-1" onClose={onClose} />);

    await waitFor(() => expect(view.getByText('cover.jpg')).toBeTruthy());
    await fireEvent.press(view.getByText('delete'));
    expect(mockAlert).toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const confirm = buttons.find((button) => button.text === 'delete');
    await confirm?.onPress?.();

    await waitFor(() => expect(mockDeleteGallery).toHaveBeenCalledWith('user-1', 'gallery-1'));
    expect(mockDeleteLocal).toHaveBeenCalledWith('/local/cover.jpg');
    expect(mockDeleteLocal).toHaveBeenCalledWith('/local/cover-thumb.jpg');
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('media_deleted_successfully'),
      'success',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('closes through the explicit close button when hosted in an overlay', async () => {
    const onClose = jest.fn();
    const view = await render(
      <GalleryDetailContent galleryId="gallery-1" onClose={onClose} showCloseButton />,
    );

    await waitFor(() => expect(view.getByText('cover.jpg')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides editing controls without edit rights', async () => {
    mockCanEdit.current = false;
    const view = await render(<GalleryDetailContent galleryId="gallery-1" onClose={jest.fn()} />);

    await waitFor(() => expect(view.getByText('cover.jpg')).toBeTruthy());
    expect(view.queryByText('save_changes')).toBeNull();
    expect(view.queryByText('delete')).toBeNull();
  });
});
