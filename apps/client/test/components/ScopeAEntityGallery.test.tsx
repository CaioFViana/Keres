import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import React from 'react';
import GalleryMediaViewerOverlay from '../../src/components/features/gallery/GalleryManager/GalleryMediaViewerOverlay';
import EntityGalleryManager from '../../src/components/features/gallery/GalleryManager/EntityGalleryManager';
import type { GallerySelect } from '../../src/db/schema';
import { useGalleryMediaViewerStore } from '../../src/state/galleryMediaViewerStore';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      primary: '#00f',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-image', () => ({ Image: () => null }));

const mockUseResolvedMediaUri = jest.fn();
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({
  useResolvedMediaUri: (...args: unknown[]) => mockUseResolvedMediaUri(...args),
}));

const mockUseEntityGalleryMedia = jest.fn();
jest.mock('../../src/hooks/useEntityGalleryMedia', () => ({
  useEntityGalleryMedia: (...args: unknown[]) => mockUseEntityGalleryMedia(...args),
}));

const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) => {
    const state = { showNotification: mockShowNotification };
    return selector ? selector(state) : state;
  },
}));

const mockAddMediaModal = jest.fn();
jest.mock('../../src/components/features/gallery/GalleryAddMediaModal', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockAddMediaModal(props);
    return null;
  },
}));

const mockAddLinkModal = jest.fn();
jest.mock('../../src/components/features/gallery/GalleryAddLinkModal', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockAddLinkModal(props);
    return null;
  },
}));

const mockAttachExistingModal = jest.fn();
jest.mock('../../src/components/features/gallery/GalleryAttachExistingModal', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockAttachExistingModal(props);
    return null;
  },
}));

const mockFullscreenModal = jest.fn();
jest.mock('../../src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: { visible: boolean; children: React.ReactNode }) => {
      mockFullscreenModal(props);
      return props.visible ? <RN.View testID="fullscreen-modal">{props.children}</RN.View> : null;
    },
  };
});

const mockGalleryDetailContent = jest.fn();
jest.mock('../../src/screens/gallery/GalleryDetailContent', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockGalleryDetailContent(props);
    return null;
  },
}));

const media = (overrides: Partial<GallerySelect> = {}): GallerySelect =>
  ({
    id: 'gallery-1',
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'map.png',
    title: 'World map',
    localPath: 'file:///map.png',
    ...overrides,
  }) as GallerySelect;

const galleryHook = (overrides: Record<string, unknown> = {}) => ({
  media: [] as GallerySelect[],
  importing: false,
  addPlayableMedia: jest.fn(async () => ({ added: 1, duplicates: 0, rejected: 0 })),
  addDocuments: jest.fn(async () => ({ added: 1, duplicates: 0, rejected: 0 })),
  addLink: jest.fn(async () => ({ added: 1, duplicates: 0, rejected: 0 })),
  getUnlinkedMedia: jest.fn(async () => [] as GallerySelect[]),
  linkExistingMedia: jest.fn(async () => 0),
  removeMedia: jest.fn(async () => {}),
  ...overrides,
});

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** TouchableOpacity composites never appear in the host tree; their host Views carry the responders. */
const touchablesOf = (view: RenderResult) =>
  view.container.queryAll(
    (node) => node.type === 'View' && typeof node.props?.onStartShouldSetResponder === 'function',
  );

const spinnersOf = (view: RenderResult) =>
  view.container.queryAll((node) => node.type === 'ActivityIndicator');

beforeEach(() => {
  jest.clearAllMocks();
  mockUseResolvedMediaUri.mockReturnValue(null);
  mockUseEntityGalleryMedia.mockReturnValue(galleryHook());
  useGalleryMediaViewerStore.getState().close();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  useGalleryMediaViewerStore.getState().close();
});

describe('EntityGalleryManager', () => {
  it('hides the add tile when read-only', async () => {
    const view = await render(
      <EntityGalleryManager
        ownerId="scene-1"
        ownerType="Scene"
        onPressMedia={jest.fn()}
        editable={false}
      />,
    );

    expect(view.queryByText('media_add_button')).toBeNull();
    expect(view.getByText('no_media_linked')).toBeTruthy();
  });

  it('spins while importing and disables the tile without an owner', async () => {
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ importing: true }));
    const busy = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={jest.fn()} />,
    );
    expect(spinnersOf(busy)).toHaveLength(1);

    const ownerless = await render(
      <EntityGalleryManager ownerId={undefined} ownerType="Scene" onPressMedia={jest.fn()} />,
    );
    const [tile] = touchablesOf(ownerless);
    expect(tile.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('opens media and unlinks it', async () => {
    const removeMedia = jest.fn(async () => {});
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ media: [media()], removeMedia }));
    const onPressMedia = jest.fn();
    const view = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={onPressMedia} />,
    );

    const [, thumb, remove] = touchablesOf(view);
    await fireEvent.press(thumb);
    expect(onPressMedia).toHaveBeenCalledWith('gallery-1');

    await fireEvent.press(remove);
    await flush();
    expect(removeMedia).toHaveBeenCalledWith('gallery-1');
  });

  it('notifies when unlinking fails', async () => {
    const removeMedia = jest.fn(async () => {
      throw new Error('db down');
    });
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ media: [media()], removeMedia }));
    const view = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={jest.fn()} />,
    );

    const [, , remove] = touchablesOf(view);
    await fireEvent.press(remove);
    await flush();
    expect(mockShowNotification).toHaveBeenCalledWith('media_save_failed', 'error');
  });

  it('imports playable media with summary notifications', async () => {
    const addPlayableMedia = jest.fn(async () => ({ added: 2, duplicates: 1, rejected: 1 }));
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ addPlayableMedia }));
    const view = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={jest.fn()} />,
    );

    await fireEvent.press(view.getByText('media_add_button'));
    const addProps = mockAddMediaModal.mock.calls[mockAddMediaModal.mock.calls.length - 1][0] as {
      visible: boolean;
      onPick: (kind: string) => void;
    };
    expect(addProps.visible).toBe(true);

    await act(async () => {
      addProps.onPick('playable');
    });
    await flush();

    expect(addPlayableMedia).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith('media_linked_to_entity', 'success');
    expect(mockShowNotification).toHaveBeenCalledWith('media_unsupported_skipped', 'warning');
  });

  it('alerts when the picker fails', async () => {
    const addDocuments = jest.fn(async () => {
      throw new Error('no picker');
    });
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ addDocuments }));
    const view = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={jest.fn()} />,
    );

    await fireEvent.press(view.getByText('media_add_button'));
    const addProps = mockAddMediaModal.mock.calls[mockAddMediaModal.mock.calls.length - 1][0] as {
      onPick: (kind: string) => void;
    };
    await act(async () => {
      addProps.onPick('document');
    });
    await flush();

    expect(mockShowNotification).toHaveBeenCalledWith('media_picker_failed', 'error');
  });

  it('links a typed URL', async () => {
    const addLink = jest.fn(async () => ({ added: 1, duplicates: 0, rejected: 0 }));
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ addLink }));
    const view = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={jest.fn()} />,
    );

    await fireEvent.press(view.getByText('media_add_button'));
    const addProps = mockAddMediaModal.mock.calls[mockAddMediaModal.mock.calls.length - 1][0] as {
      onPick: (kind: string) => void;
    };
    await act(async () => {
      addProps.onPick('link');
    });

    const linkProps = mockAddLinkModal.mock.calls[mockAddLinkModal.mock.calls.length - 1][0] as {
      visible: boolean;
      onConfirm: (url: string, title: string | null) => void;
    };
    expect(linkProps.visible).toBe(true);
    await act(async () => {
      linkProps.onConfirm('https://notes.example/lore', null);
    });
    await flush();

    expect(addLink).toHaveBeenCalledWith('https://notes.example/lore', null);
    expect(mockShowNotification).toHaveBeenCalledWith('media_linked_to_entity', 'success');
  });

  it('attaches already-catalogued media', async () => {
    const getUnlinkedMedia = jest.fn(async () => [media({ id: 'gallery-9' })]);
    const linkExistingMedia = jest.fn(async () => 2);
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ getUnlinkedMedia, linkExistingMedia }));
    const view = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={jest.fn()} />,
    );

    await fireEvent.press(view.getByText('media_add_button'));
    const addProps = mockAddMediaModal.mock.calls[mockAddMediaModal.mock.calls.length - 1][0] as {
      onPick: (kind: string) => void;
    };
    await act(async () => {
      addProps.onPick('existing');
    });
    await flush();

    const attachProps = mockAttachExistingModal.mock.calls[
      mockAttachExistingModal.mock.calls.length - 1
    ][0] as {
      visible: boolean;
      loading: boolean;
      media: GallerySelect[];
      onConfirm: (ids: string[]) => void;
    };
    expect(attachProps.visible).toBe(true);
    expect(attachProps.loading).toBe(false);
    expect(attachProps.media).toHaveLength(1);

    await act(async () => {
      attachProps.onConfirm(['gallery-9']);
    });
    await flush();
    expect(linkExistingMedia).toHaveBeenCalledWith(['gallery-9']);
    expect(mockShowNotification).toHaveBeenCalledWith('media_linked_to_entity', 'success');
  });

  it('reports catalogue failures on both sides', async () => {
    const getUnlinkedMedia = jest.fn(async () => {
      throw new Error('db down');
    });
    const linkExistingMedia = jest.fn(async () => {
      throw new Error('db down');
    });
    mockUseEntityGalleryMedia.mockReturnValue(galleryHook({ getUnlinkedMedia, linkExistingMedia }));
    const view = await render(
      <EntityGalleryManager ownerId="scene-1" ownerType="Scene" onPressMedia={jest.fn()} />,
    );

    await fireEvent.press(view.getByText('media_add_button'));
    const addProps = mockAddMediaModal.mock.calls[mockAddMediaModal.mock.calls.length - 1][0] as {
      onPick: (kind: string) => void;
    };
    await act(async () => {
      addProps.onPick('existing');
    });
    await flush();
    expect(mockShowNotification).toHaveBeenCalledWith('media_load_failed', 'error');

    const attachProps = mockAttachExistingModal.mock.calls[
      mockAttachExistingModal.mock.calls.length - 1
    ][0] as { onConfirm: (ids: string[]) => void };
    await act(async () => {
      attachProps.onConfirm(['gallery-9']);
    });
    await flush();
    expect(mockShowNotification).toHaveBeenCalledWith('media_save_failed', 'error');
  });
});

describe('GalleryMediaViewerOverlay', () => {
  it('stays hidden without a peeked medium', async () => {
    const view = await render(<GalleryMediaViewerOverlay />);

    expect(mockFullscreenModal.mock.calls[0][0]).toMatchObject({ visible: false });
    expect(mockGalleryDetailContent).not.toHaveBeenCalled();
    expect(view.toJSON()).toBeNull();
  });

  it('mounts the peeked medium and closes it', async () => {
    const view = await render(<GalleryMediaViewerOverlay />);

    await act(async () => {
      useGalleryMediaViewerStore.getState().open('gallery-1');
    });

    expect(
      mockFullscreenModal.mock.calls[mockFullscreenModal.mock.calls.length - 1][0],
    ).toMatchObject({
      visible: true,
    });
    expect(mockGalleryDetailContent).toHaveBeenCalledWith(
      expect.objectContaining({ galleryId: 'gallery-1', showCloseButton: true }),
    );
    expect(view.getByTestId('fullscreen-modal')).toBeTruthy();

    const { onRequestClose } = mockFullscreenModal.mock.calls[
      mockFullscreenModal.mock.calls.length - 1
    ][0] as { onRequestClose: () => void };
    await act(async () => {
      onRequestClose();
    });
    expect(
      mockFullscreenModal.mock.calls[mockFullscreenModal.mock.calls.length - 1][0],
    ).toMatchObject({
      visible: false,
    });
  });
});
