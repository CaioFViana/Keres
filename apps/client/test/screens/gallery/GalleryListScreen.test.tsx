import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
const mockToggleFavorite = jest.fn();
const mockRefetch = jest.fn();
const mockShowNotification = jest.fn();
const mockUseEntityListScreen = jest.fn();
const mockCreateGalleryLink = jest.fn();
const mockImportPickedMediaAssets = jest.fn();
const mockPick = jest.fn();
const mockPickDocuments = jest.fn();
const mockPromptGalleryAddKind = jest.fn();
const mockUseScreenTour = jest.fn();
const mockHeaderConfig: { current: { actions: { onPress: () => void; busy?: boolean }[] } | null } =
  { current: null };
const mockBreakpoint: { current: string } = { current: 'narrow' };
let mockListState = {
  listProps: {},
  items: [] as { id: string }[],
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
  refetch: mockRefetch,
};
let mockListProps: {
  data: { id: string }[];
  renderItem: (info: { item: { id: string } }) => React.ReactNode;
  numColumns?: number;
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  emptyStateActions?: { label: string; onPress: () => void }[];
} | null = null;
let mockLinkModalVisible = false;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      dispatch: mockDispatch,
      getParent: () => ({ setOptions: jest.fn() }),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
    DrawerActions: { closeDrawer: () => ({ type: 'CLOSE_DRAWER' }) },
  };
});
jest.mock('@/src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => {
    mockHeaderConfig.current = config as never;
  },
}));
jest.mock('@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList', () => ({
  __esModule: true,
  default: (props: {
    data: { id: string }[];
    renderItem: (info: { item: { id: string } }) => React.ReactNode;
    numColumns?: number;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockListProps = props;
    return react.createElement(
      native.View,
      { testID: 'gallery-list-stub' },
      props.data.map((item) =>
        react.createElement(react.Fragment, { key: item.id }, props.renderItem({ item })),
      ),
    );
  },
}));
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-error', onPress: onGoBack }, message);
  },
}));
jest.mock('@/src/components/features/gallery/GalleryAddLinkModal', () => ({
  __esModule: true,
  default: (props: {
    visible: boolean;
    onCancel: () => void;
    onConfirm: (url: string, title: string | null) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockLinkModalVisible = props.visible;
    if (!props.visible) return null;
    return react.createElement(
      native.View,
      { testID: 'link-modal' },
      react.createElement(
        native.Text,
        {
          testID: 'link-confirm',
          onPress: () => props.onConfirm('https://example.com', 'Example'),
        },
        'confirm',
      ),
      react.createElement(
        native.Text,
        { testID: 'link-cancel', onPress: props.onCancel },
        'cancel',
      ),
    );
  },
}));
jest.mock('@/src/components/features/gallery/promptGalleryAddKind', () => ({
  __esModule: true,
  promptGalleryAddKind: (...args: unknown[]) => mockPromptGalleryAddKind(...args),
}));
jest.mock('@/src/components/features/list-items/GalleryGridItem', () => ({
  __esModule: true,
  default: ({
    media,
    onPress,
    onToggleFavorite,
  }: {
    media: { id: string; isFavorite?: boolean };
    onPress: (id: string) => void;
    onToggleFavorite: (id: string, isFavorite: boolean) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        { testID: `open-${media.id}`, onPress: () => onPress(media.id) },
        `open ${media.id}`,
      ),
      react.createElement(
        native.Text,
        {
          testID: `fav-${media.id}`,
          onPress: () => onToggleFavorite(media.id, !media.isFavorite),
        },
        `fav ${media.id}`,
      ),
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityListScreen', () => ({
  __esModule: true,
  useEntityListScreen: (...args: unknown[]) => mockUseEntityListScreen(...args),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ breakpoint: mockBreakpoint.current }),
}));
jest.mock('../../../src/services/galleryLink', () => ({
  __esModule: true,
  createGalleryLink: (...args: unknown[]) => mockCreateGalleryLink(...args),
}));
jest.mock('../../../src/services/galleryMediaImport', () => ({
  __esModule: true,
  importPickedMediaAssets: (...args: unknown[]) => mockImportPickedMediaAssets(...args),
}));
jest.mock('../../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: {
    pick: (...args: unknown[]) => mockPick(...args),
    pickDocuments: (...args: unknown[]) => mockPickDocuments(...args),
  },
}));
jest.mock('../../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: () => ({}),
}));
jest.mock('../../../src/state/galleryStore', () => ({
  __esModule: true,
  useGalleryStore: jest.fn(),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
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
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import GalleryListScreen from '../../../src/screens/gallery/GalleryListScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const freshListState = () => ({
  listProps: {},
  items: [] as { id: string }[],
  error: null as string | null,
  storyId: 'story-1' as string | undefined,
  toggleFavorite: mockToggleFavorite,
  refetch: mockRefetch,
});

describe('GalleryListScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListState = freshListState();
    mockListProps = null;
    mockLinkModalVisible = false;
    mockHeaderConfig.current = null;
    mockBreakpoint.current = 'narrow';
    mockUseEntityListScreen.mockImplementation(() => mockListState);
  });

  it('requests its guided tour', async () => {
    await render(<GalleryListScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('GalleryStack');
  });

  it('guides the empty list toward adding media', async () => {
    await render(<GalleryListScreen />);

    expect(mockListProps?.emptyStateTitle).toBe('galleries_empty_title');
    expect(mockListProps?.emptyStateMessage).toBe('galleries_empty_message');
    expect(mockListProps?.emptyStateActions?.map((action) => action.label)).toEqual([
      'galleries_empty_create',
    ]);
    mockListProps?.emptyStateActions?.[0].onPress();
    expect(mockPromptGalleryAddKind).toHaveBeenCalled();
  });

  it('binds the gallery store and sizes columns by breakpoint', async () => {
    mockBreakpoint.current = 'wide';
    const view = await render(<GalleryListScreen />);

    expect(mockUseEntityListScreen).toHaveBeenCalledWith(
      expect.objectContaining({ collectionKey: 'galleries', changeEvent: 'gallery_changed' }),
    );
    expect(view.getByTestId('gallery-list-stub')).toBeTruthy();
    expect(mockListProps?.numColumns).toBe(5);
  });

  it('shows the error state from the list hook', async () => {
    mockListState = { ...freshListState(), error: 'load failed' };
    const view = await render(<GalleryListScreen />);

    await fireEvent.press(view.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('opens details and toggles favorites through grid items', async () => {
    mockListState = { ...freshListState(), items: [{ id: 'media-1' }] };
    const view = await render(<GalleryListScreen />);

    await fireEvent.press(view.getByTestId('open-media-1'));
    expect(mockNavigate).toHaveBeenCalledWith('GalleryDetail', { galleryId: 'media-1' });

    await fireEvent.press(view.getByTestId('fav-media-1'));
    expect(mockToggleFavorite).toHaveBeenCalledWith('media-1', true);
  });

  it('imports picked media and reports the summary', async () => {
    const view = await render(<GalleryListScreen />);

    mockHeaderConfig.current?.actions[0].onPress();
    expect(mockPromptGalleryAddKind).toHaveBeenCalled();
    const choose = mockPromptGalleryAddKind.mock.calls[0][1] as (kind: string) => void;

    mockPick.mockResolvedValue([{ uri: 'file://a.jpg' }]);
    mockImportPickedMediaAssets.mockResolvedValue({ added: 1, duplicates: 1, rejected: 1 });
    await act(async () => {
      choose('playable');
    });

    await waitFor(() => expect(mockImportPickedMediaAssets).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('media_added_successfully'),
        'success',
      ),
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('media_already_in_gallery'),
      'info',
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('media_unsupported_skipped'),
      'warning',
    );
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
    expect(view.getByTestId('gallery-list-stub')).toBeTruthy();
    // The drawer is put away before the picker covers the app and once it returns.
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLOSE_DRAWER' });
  });

  it('surfaces picker failures without importing', async () => {
    await withSilencedConsole(['log'], async () => {
      await render(<GalleryListScreen />);

      mockHeaderConfig.current?.actions[0].onPress();
      const choose = mockPromptGalleryAddKind.mock.calls[0][1] as (kind: string) => void;
      mockPickDocuments.mockRejectedValue(new Error('denied'));
      await act(async () => {
        choose('document');
      });

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.stringContaining('media_picker_failed'),
          'error',
        ),
      );
      expect(mockImportPickedMediaAssets).not.toHaveBeenCalled();
    });
  });

  it('adds a link through the modal and handles duplicates', async () => {
    mockCreateGalleryLink.mockResolvedValue({ duplicate: true });
    const view = await render(<GalleryListScreen />);

    mockHeaderConfig.current?.actions[0].onPress();
    const choose = mockPromptGalleryAddKind.mock.calls[0][1] as (kind: string) => void;
    await act(async () => {
      choose('link');
    });

    await waitFor(() => expect(view.getByTestId('link-modal')).toBeTruthy());
    expect(mockLinkModalVisible).toBe(true);
    await fireEvent.press(view.getByTestId('link-confirm'));

    await waitFor(() => expect(mockCreateGalleryLink).toHaveBeenCalled());
    expect(mockCreateGalleryLink.mock.calls[0].slice(1, 5)).toEqual([
      'story-1',
      'user-1',
      'https://example.com',
      'Example',
    ]);
    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('media_already_in_gallery'),
        'info',
      ),
    );
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it('warns on invalid links and closes the modal on cancel', async () => {
    mockCreateGalleryLink.mockResolvedValue(null);
    const view = await render(<GalleryListScreen />);

    mockHeaderConfig.current?.actions[0].onPress();
    const choose = mockPromptGalleryAddKind.mock.calls[0][1] as (kind: string) => void;
    await act(async () => {
      choose('link');
    });
    await waitFor(() => expect(view.getByTestId('link-modal')).toBeTruthy());

    await fireEvent.press(view.getByTestId('link-cancel'));
    await waitFor(() => expect(view.queryByTestId('link-modal')).toBeNull());
    expect(mockLinkModalVisible).toBe(false);

    mockHeaderConfig.current?.actions[0].onPress();
    const chooseAgain = mockPromptGalleryAddKind.mock.calls[1][1] as (kind: string) => void;
    await act(async () => {
      chooseAgain('link');
    });
    await waitFor(() => expect(view.getByTestId('link-modal')).toBeTruthy());
    await fireEvent.press(view.getByTestId('link-confirm'));

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('gallery_link_invalid'),
        'warning',
      ),
    );
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});
