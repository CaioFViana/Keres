import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import { OperationLogEntityType } from '@keres/shared';
import React from 'react';
import CommentListItem from '../../src/components/features/list-items/CommentListItem';
import GalleryGridItem, {
  iconForGalleryMedia,
} from '../../src/components/features/list-items/GalleryGridItem';
import GlobalSearchResultItem from '../../src/components/features/list-items/GlobalSearchResultItem';
import OperationLogListItem from '../../src/components/features/list-items/OperationLogListItem';
import type { CommentSelect, GallerySelect, OperationLogSelect } from '../../src/db/schema';
import type { GlobalSearchResult } from '../../src/services/storymanagement/GlobalSearchService';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#eee',
      error: '#f00',
      notification: '#fa0',
      primary: '#00f',
      secondary: '#0aa',
      shadow: '#000',
      star: '#fc0',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
}));

jest.mock('../../src/components/common/display/Avatar/Avatar', () => () => null);

const mockUseEntityName = jest.fn();
jest.mock('../../src/hooks/useEntityName', () => ({
  useEntityName: (...args: unknown[]) => mockUseEntityName(...args),
}));

const mockUseCommentFieldLabel = jest.fn();
jest.mock('../../src/hooks/useCommentFieldLabel', () => ({
  useCommentFieldLabel: (...args: unknown[]) => mockUseCommentFieldLabel(...args),
}));

const mockUseAuthorProfiles = jest.fn();
jest.mock('../../src/hooks/useAuthorProfiles', () => ({
  useAuthorProfiles: (...args: unknown[]) => mockUseAuthorProfiles(...args),
}));

const mockUseUserDisplayName = jest.fn();
jest.mock('../../src/hooks/useUserDisplayName', () => ({
  useUserDisplayName: (...args: unknown[]) => mockUseUserDisplayName(...args),
}));

const mockUseResolvedMediaUri = jest.fn();
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({
  useResolvedMediaUri: (...args: unknown[]) => mockUseResolvedMediaUri(...args),
}));

const mockImage = jest.fn();
jest.mock('expo-image', () => ({
  Image: (props: Record<string, unknown>) => mockImage(props) ?? null,
}));

/** TouchableOpacity surfaces `disabled` on the host tree as `accessibilityState`. */
function pressableDisabledOf(view: RenderResult, text: string): boolean | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = view.getByText(text);
  while (node && node?.props?.accessibilityState?.disabled === undefined) node = node.parent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (node as any)?.props?.accessibilityState?.disabled;
}

const comment = (overrides: Partial<CommentSelect> = {}): CommentSelect =>
  ({
    id: 'comment-1',
    storyId: 'story-1',
    entityType: 'Scene',
    entityId: 'scene-1',
    fieldKey: 'summary',
    fieldId: null,
    authorUserId: 'user-1',
    commentText: 'Tighten this beat',
    criticality: 3,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  }) as CommentSelect;

const gallery = (overrides: Partial<GallerySelect> = {}): GallerySelect =>
  ({
    id: 'gallery-1',
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'map.png',
    title: 'World map',
    localPath: 'file:///map.png',
    thumbnailPath: null,
    sizeBytes: 2048,
    isFavorite: false,
    uploadState: 'uploaded',
    downloadState: 'downloaded',
    ...overrides,
  }) as GallerySelect;

const operationLog = (overrides: Partial<OperationLogSelect> = {}): OperationLogSelect =>
  ({
    id: 'log-1',
    storyId: 'story-1',
    entityType: OperationLogEntityType.Scene,
    entityId: 'scene-1',
    userId: 'user-1',
    operationType: 'create',
    createdAt: new Date('2024-01-02T03:04:05Z'),
    isSynced: true,
    serverOperationVersion: 3,
    ...overrides,
  }) as OperationLogSelect;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEntityName.mockReturnValue({ entityName: 'Arrival', loading: false });
  mockUseCommentFieldLabel.mockReturnValue('Summary');
  mockUseAuthorProfiles.mockReturnValue({});
  mockUseUserDisplayName.mockReturnValue('Ari');
  mockUseResolvedMediaUri.mockReturnValue('file:///resolved.png');
});

describe('GlobalSearchResultItem', () => {
  const result = {
    entityType: 'Character',
    title: 'Ari',
    context: 'Scene · Arrival',
    snippet: '...weathered sailor...',
  } as GlobalSearchResult;

  it('renders the icon, title, context and snippet', async () => {
    const view = await render(<GlobalSearchResultItem result={result} onPress={jest.fn()} />);

    expect(view.getByText('Ari')).toBeTruthy();
    expect(view.getByText('Scene · Arrival')).toBeTruthy();
    expect(view.getByText('...weathered sailor...')).toBeTruthy();
    const [icon] = view.container.queryAll((node: any) => node.type === Ionicons);
    expect(icon.props.name).toBe('person-outline');
  });

  it('omits blank context and snippet, and presses through', async () => {
    const onPress = jest.fn();
    const searched = { ...result, context: undefined, snippet: '' };
    const view = await render(<GlobalSearchResultItem result={searched} onPress={onPress} />);

    expect(view.queryByText('Scene · Arrival')).toBeNull();
    await fireEvent.press(view.getByText('Ari'));
    expect(onPress).toHaveBeenCalledWith(searched);
  });
});

describe('CommentListItem', () => {
  it('renders the entity, field, text and author', async () => {
    mockUseAuthorProfiles.mockReturnValue({
      'user-1': { id: 'user-1', name: 'Ari', isCurrentUser: false },
    });
    const view = await render(<CommentListItem comment={comment()} onPress={jest.fn()} />);

    expect(mockUseEntityName).toHaveBeenCalledWith('Scene', 'scene-1', 'story-1');
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Summary')).toBeTruthy();
    expect(view.getByText('Tighten this beat')).toBeTruthy();
    expect(view.getByText('Ari')).toBeTruthy();
    const [icon] = view.container.queryAll((node: any) => node.type === Ionicons);
    expect(icon.props.name).toBe('alert-circle-outline');
  });

  it('falls back for unknown entities, fields, authors and levels', async () => {
    mockUseEntityName.mockReturnValue({ entityName: undefined, loading: false });
    mockUseCommentFieldLabel.mockReturnValue('');
    const view = await render(<CommentListItem comment={comment({ criticality: 99 })} />);

    expect(view.getByText('Scene')).toBeTruthy();
    expect(view.queryByText('Summary')).toBeNull();
    expect(view.getByText('user-1')).toBeTruthy();
    const [icon] = view.container.queryAll((node: any) => node.type === Ionicons);
    expect(icon.props.name).toBe('alert-circle-outline');
    expect(pressableDisabledOf(view, 'Tighten this beat')).toBe(true);
  });

  it('presses through to the comment', async () => {
    const onPress = jest.fn();
    const row = comment();
    const view = await render(<CommentListItem comment={row} onPress={onPress} />);

    expect(pressableDisabledOf(view, 'Tighten this beat')).toBe(false);
    await fireEvent.press(view.getByText('Tighten this beat'));
    expect(onPress).toHaveBeenCalledWith(row);
  });
});

describe('iconForGalleryMedia', () => {
  it.each([
    ['image', 'image/png', 'image-outline'],
    ['video', 'video/mp4', 'videocam-outline'],
    ['audio', 'audio/mpeg', 'musical-notes-outline'],
    ['link', 'text/uri-list', 'link-outline'],
    ['document', 'application/vnd.ms-excel', 'grid-outline'],
    ['document', 'text/csv', 'grid-outline'],
    ['document', 'application/vnd.ms-powerpoint', 'easel-outline'],
    ['document', 'application/pdf', 'document-text-outline'],
    ['document', 'text/plain', 'document-text-outline'],
    ['document', 'application/octet-stream', 'document-outline'],
    ['document', null, 'document-outline'],
  ] as const)('maps %s/%s to %s', (mediaType, mimeType, icon) => {
    expect(iconForGalleryMedia(mediaType, mimeType)).toBe(icon);
  });
});

describe('GalleryGridItem', () => {
  it('shows the image itself with size and favorite', async () => {
    const onToggleFavorite = jest.fn();
    const view = await render(
      <GalleryGridItem media={gallery()} onPress={jest.fn()} onToggleFavorite={onToggleFavorite} />,
    );

    expect(mockUseResolvedMediaUri).toHaveBeenCalledWith('file:///map.png');
    expect(mockImage).toHaveBeenCalledWith(
      expect.objectContaining({ source: { uri: 'file:///resolved.png' } }),
    );
    expect(view.getByText('World map')).toBeTruthy();
    expect(view.getByText('media_type_image · 2 KB')).toBeTruthy();

    const icons = view.container.queryAll((node: any) => node.type === Ionicons);
    const favorite = icons.find((icon: any) => icon.props.name === 'star-outline');
    await fireEvent.press(favorite);
    expect(onToggleFavorite).toHaveBeenCalledWith('gallery-1', true);
  });

  it('previews videos through their frame and opens on press', async () => {
    const onPress = jest.fn();
    const view = await render(
      <GalleryGridItem
        media={gallery({ mediaType: 'video', thumbnailPath: 'file:///thumb.jpg', sizeBytes: 0 })}
        onPress={onPress}
      />,
    );

    expect(mockUseResolvedMediaUri).toHaveBeenCalledWith('file:///thumb.jpg');
    expect(view.getByText('media_type_video')).toBeTruthy();
    await fireEvent.press(view.getByText('World map'));
    expect(onPress).toHaveBeenCalledWith('gallery-1');
  });

  it('falls back to the type icon without a thumbnail', async () => {
    mockUseResolvedMediaUri.mockReturnValue(null);
    const view = await render(
      <GalleryGridItem
        media={gallery({ mediaType: 'audio', mimeType: 'audio/mpeg', title: null })}
        onPress={jest.fn()}
      />,
    );

    expect(mockImage).not.toHaveBeenCalled();
    expect(view.getByText('map.png')).toBeTruthy();
    const icons = view.container.queryAll((node: any) => node.type === Ionicons);
    expect(icons.some((icon) => icon.props.name === 'musical-notes-outline')).toBe(true);
  });

  it('reports transfer states', async () => {
    const downloading = await render(
      <GalleryGridItem media={gallery({ downloadState: 'pending' })} onPress={jest.fn()} />,
    );
    expect(downloading.getByText('media_downloading')).toBeTruthy();

    const uploading = await render(
      <GalleryGridItem media={gallery({ uploadState: 'pending' })} onPress={jest.fn()} />,
    );
    expect(uploading.getByText('media_pending_upload')).toBeTruthy();

    const failed = await render(
      <GalleryGridItem media={gallery({ uploadState: 'failed' })} onPress={jest.fn()} />,
    );
    expect(failed.getByText('media_transfer_failed')).toBeTruthy();
  });
});

describe('OperationLogListItem', () => {
  it('describes a plain operation with user and sync state', async () => {
    const view = await render(<OperationLogListItem log={operationLog()} onPress={jest.fn()} />);

    expect(view.getByText('create Arrival')).toBeTruthy();
    expect(view.getByText('Ari')).toBeTruthy();
    expect(view.getByText(/sync_status.*synced/)).toBeTruthy();
    const icons = view.container.queryAll((node: any) => node.type === Ionicons);
    expect(icons.some((icon) => icon.props.name === 'add-circle-outline')).toBe(true);
  });

  it('paints deletions in red and hides anonymous users', async () => {
    const view = await render(
      <OperationLogListItem
        log={operationLog({ operationType: 'delete', userId: undefined, isSynced: false })}
      />,
    );

    expect(view.getByText(/delete Arrival/)).toBeTruthy();
    expect(view.getByText(/pending/)).toBeTruthy();
    expect(view.queryByText('Ari')).toBeNull();
    const icons = view.container.queryAll((node: any) => node.type === Ionicons);
    const marker = icons.find((icon) => icon.props.name === 'trash-outline');
    expect(marker?.props.color).toBe('#f00');
  });

  it('marks relations with a link icon', async () => {
    const view = await render(
      <OperationLogListItem
        log={operationLog({
          entityType: OperationLogEntityType.CharacterRelation,
          operationType: 'update',
        })}
      />,
    );

    const icons = view.container.queryAll((node: any) => node.type === Ionicons);
    const link = icons.find((icon) => icon.props.name === 'link-outline');
    expect(link?.props.color).toBe('#0aa');
  });

  it.each([
    [OperationLogEntityType.TagRelation, 'create', 'operation_tag_relation_added'],
    [OperationLogEntityType.TagRelation, 'delete', 'operation_tag_relation_removed'],
    [OperationLogEntityType.NoteRelation, 'create', 'operation_note_relation_added'],
    [OperationLogEntityType.GalleryRelation, 'delete', 'operation_gallery_relation_removed'],
  ] as const)('phrases %s %s', async (entityType, operationType, key) => {
    const view = await render(
      <OperationLogListItem log={operationLog({ entityType, operationType })} />,
    );

    expect(view.getByText(key)).toBeTruthy();
  });

  it('uses the world-piece appearance for sectioned rules', async () => {
    const view = await render(
      <OperationLogListItem
        log={operationLog({ entityType: OperationLogEntityType.WorldRule })}
        worldPieceSection="rule"
      />,
    );

    expect(view.getByText('create Arrival')).toBeTruthy();
  });

  it('shows a loading placeholder while the name resolves', async () => {
    mockUseEntityName.mockReturnValue({ entityName: undefined, loading: true });
    const view = await render(<OperationLogListItem log={operationLog()} />);

    expect(view.getByText('Loading...')).toBeTruthy();
  });

  it('presses through to the log entry', async () => {
    const onPress = jest.fn();
    const log = operationLog();
    const view = await render(<OperationLogListItem log={log} onPress={onPress} />);

    await fireEvent.press(view.getByText('create Arrival'));
    expect(onPress).toHaveBeenCalledWith('log-1');
  });
});
