import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import GalleryAddLinkModal from '../../src/components/features/gallery/GalleryAddLinkModal';
import GalleryAddMediaModal from '../../src/components/features/gallery/GalleryAddMediaModal';
import GalleryAttachExistingModal from '../../src/components/features/gallery/GalleryAttachExistingModal';
import { promptGalleryAddKind } from '../../src/components/features/gallery/promptGalleryAddKind';
import type { GallerySelect } from '../../src/db/schema';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#aaf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <RN.View
        testID={typeof children === 'string' ? children : 'mock-button'}
        onPress={onPress}
        disabled={disabled}
      >
        <RN.Text>{children}</RN.Text>
      </RN.View>
    ),
  };
});

const mockUseResolvedMediaUri = jest.fn();
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({
  useResolvedMediaUri: (...args: unknown[]) => mockUseResolvedMediaUri(...args),
}));

const mockImage = jest.fn();
jest.mock('expo-image', () => ({
  Image: (props: Record<string, unknown>) => mockImage(props) ?? null,
}));

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const media = (overrides: Partial<GallerySelect> = {}): GallerySelect =>
  ({
    id: 'gallery-1',
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'map.png',
    title: 'World map',
    localPath: 'file:///map.png',
    thumbnailPath: null,
    ...overrides,
  }) as GallerySelect;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseResolvedMediaUri.mockReturnValue('file:///resolved.png');
});

describe('GalleryAddLinkModal', () => {
  it('renders nothing when hidden', async () => {
    const view = await render(
      <GalleryAddLinkModal visible={false} onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('confirms a normalized link with an optional title', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <GalleryAddLinkModal visible onCancel={jest.fn()} onConfirm={onConfirm} />,
    );

    expect(view.getByText('gallery_add_link_title')).toBeTruthy();
    expect(view.getByTestId('save').props.disabled).toBe(true);

    await fireEvent.changeText(view.getByPlaceholderText('https://'), 'not a url');
    expect(view.getByTestId('save').props.disabled).toBe(true);

    await fireEvent.changeText(view.getByPlaceholderText('https://'), 'https://notes.example/lore');
    expect(view.getByTestId('save').props.disabled).toBe(false);

    await act(async () => {
      view.getByTestId('save').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith('https://notes.example/lore', null);

    await fireEvent.changeText(view.getByPlaceholderText('title_optional'), '  Lore notes  ');
    await act(async () => {
      view.getByTestId('save').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith('https://notes.example/lore', 'Lore notes');
  });

  it('resets its fields every time it opens', async () => {
    const view = await render(
      <GalleryAddLinkModal visible onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('https://'), 'https://notes.example/lore');
    await view.rerender(
      <GalleryAddLinkModal visible={false} onCancel={jest.fn()} onConfirm={jest.fn()} />,
    );
    await view.rerender(<GalleryAddLinkModal visible onCancel={jest.fn()} onConfirm={jest.fn()} />);

    expect(view.getByPlaceholderText('https://').props.value).toBe('');
    expect(view.getByTestId('save').props.disabled).toBe(true);
  });

  it('cancels without confirming', async () => {
    const onCancel = jest.fn();
    const view = await render(
      <GalleryAddLinkModal visible onCancel={onCancel} onConfirm={jest.fn()} />,
    );

    await act(async () => {
      view.getByTestId('cancel').props.onPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('GalleryAddMediaModal', () => {
  it('renders nothing when hidden', async () => {
    const view = await render(
      <GalleryAddMediaModal visible={false} onClose={jest.fn()} onPick={jest.fn()} />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it.each([
    ['gallery_add_playable', 'playable'],
    ['gallery_add_document', 'document'],
    ['gallery_add_link', 'link'],
    ['gallery_attach_existing', 'existing'],
  ] as const)('picks %s', async (label, kind) => {
    const onPick = jest.fn();
    const view = await render(<GalleryAddMediaModal visible onClose={jest.fn()} onPick={onPick} />);

    expect(view.getByText('gallery_add_title')).toBeTruthy();
    await fireEvent.press(view.getByLabelText(label));
    expect(onPick).toHaveBeenCalledWith(kind);
  });

  it('closes without picking', async () => {
    const onClose = jest.fn();
    const view = await render(
      <GalleryAddMediaModal visible onClose={onClose} onPick={jest.fn()} />,
    );

    await fireEvent.press(view.getByLabelText('cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('promptGalleryAddKind', () => {
  it('offers the three add paths plus cancel', () => {
    const onPick = jest.fn();
    promptGalleryAddKind((key: string) => key, onPick);

    expect(mockAlert).toHaveBeenCalledWith(
      'gallery_add_title',
      'gallery_add_message',
      expect.any(Array),
    );
    const buttons = mockAlert.mock.calls[0][2] as {
      text: string;
      style?: string;
      onPress?: () => void;
    }[];
    expect(buttons.map((button) => button.text)).toEqual([
      'gallery_add_playable',
      'gallery_add_document',
      'gallery_add_link',
      'cancel',
    ]);
    expect(buttons[3].style).toBe('cancel');

    buttons[0].onPress?.();
    expect(onPick).toHaveBeenCalledWith('playable');
    buttons[1].onPress?.();
    expect(onPick).toHaveBeenCalledWith('document');
    buttons[2].onPress?.();
    expect(onPick).toHaveBeenCalledWith('link');
  });
});

describe('GalleryAttachExistingModal', () => {
  const items = [
    media(),
    media({
      id: 'gallery-2',
      mediaType: 'video',
      fileName: 'clip.mp4',
      title: null,
      thumbnailPath: 'file:///thumb.jpg',
    }),
    media({
      id: 'gallery-3',
      mediaType: 'document',
      mimeType: 'application/pdf',
      fileName: 'lore.pdf',
      title: null,
      localPath: null,
    }),
  ];

  it('renders nothing when hidden', async () => {
    const view = await render(
      <GalleryAttachExistingModal
        visible={false}
        media={items}
        loading={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('shows a spinner while loading', async () => {
    const view = await render(
      <GalleryAttachExistingModal
        visible
        media={[]}
        loading
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(view.container.queryAll((node: any) => node.type === 'ActivityIndicator')).toHaveLength(
      1,
    );
  });

  it('shows the empty state', async () => {
    const view = await render(
      <GalleryAttachExistingModal
        visible
        media={[]}
        loading={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(view.getByText('gallery_attach_existing_empty')).toBeTruthy();
  });

  it('selects rows and confirms their ids', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <GalleryAttachExistingModal
        visible
        media={items}
        loading={false}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(view.getByText('World map')).toBeTruthy();
    expect(view.getByText('map.png')).toBeTruthy();
    expect(view.getByText('clip.mp4')).toBeTruthy();
    // The confirm starts disabled with nothing selected.
    expect(view.getByTestId('gallery_attach_existing_confirm').props.disabled).toBe(true);

    const rows = view.getAllByRole('checkbox');
    expect(rows[0].props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(rows[0]);
    expect(view.getAllByRole('checkbox')[0].props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(rows[2]);

    await act(async () => {
      view.getByTestId('gallery_attach_existing_confirm').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith(['gallery-1', 'gallery-3']);

    // Toggling again deselects.
    await fireEvent.press(view.getAllByRole('checkbox')[0]);
    expect(view.getAllByRole('checkbox')[0].props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('filters by title or file name', async () => {
    const view = await render(
      <GalleryAttachExistingModal
        visible
        media={items}
        loading={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('gallery_attach_existing_search'), 'CLIP');
    expect(view.queryByText('World map')).toBeNull();
    expect(view.getByText('clip.mp4')).toBeTruthy();
  });

  it('previews images and falls back to icons without a uri', async () => {
    const view = await render(
      <GalleryAttachExistingModal
        visible
        media={[items[0]]}
        loading={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(mockImage).toHaveBeenCalled();
    expect(mockUseResolvedMediaUri).toHaveBeenCalledWith('file:///map.png');
    expect(view.getByText('World map')).toBeTruthy();

    mockUseResolvedMediaUri.mockReturnValue(null);
    await view.rerender(
      <GalleryAttachExistingModal
        visible
        media={[items[2]]}
        loading={false}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    // A document has no picture: the row still renders with its fallback icon.
    expect(view.getByText('lore.pdf')).toBeTruthy();
  });
});
