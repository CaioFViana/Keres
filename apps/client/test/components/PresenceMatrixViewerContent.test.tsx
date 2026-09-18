import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import PresenceMatrixViewerContent from '../../src/components/features/presence-matrix/PresenceMatrixViewerContent';
import { MAX_VISIBLE_SERIES } from '../../src/components/features/presence-matrix/presenceMatrixConstants';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'multi-select', ...props }),
  };
});

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactActual.createElement(View, { testID: 'order-modal' }, children) : null,
  };
});

const mockCanvasProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/features/presence-matrix/PresenceMatrixCanvas', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockCanvasProps.current = props as Record<string, any>;
      return ReactActual.createElement(View, { testID: 'presence-canvas' });
    },
  };
});

const mockSheetProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => {
  const ReactActual = require('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) => {
      mockSheetProps.current = props;
      return ReactActual.createElement(
        View,
        { testID: 'graph-node-sheet' },
        ReactActual.createElement(Text, null, props.title),
      );
    },
  };
});

let mockStory: any = null;
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: any) => unknown) => selector({ selectedStory: mockStory }),
}));

const mockNotify = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector: (state: any) => unknown) =>
    selector({ showNotification: mockNotify }),
}));

jest.mock('../../src/state/userSettingsStore', () => {
  const hook = (selector: (state: any) => unknown) => selector({ exportFormat: 'svg' });
  return {
    __esModule: true,
    useUserSettingsStore: Object.assign(hook, {
      getState: () => ({ exportFormat: 'svg' }),
    }),
  };
});

jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (type: string, plural = false) => (plural ? `${type}s` : type),
  }),
}));

const mockDeliver = jest.fn();
jest.mock('../../src/utils/storyTransfer', () => ({
  __esModule: true,
  deliverMapExport: (...args: unknown[]) => mockDeliver(...args),
}));

let mockCatalog: any = null;
const mockCatalogCalls: unknown[][] = [];
jest.mock('../../src/hooks/usePresenceMatrixCatalog', () => ({
  __esModule: true,
  usePresenceMatrixCatalog: (...args: unknown[]) => {
    mockCatalogCalls.push(args);
    return mockCatalog;
  },
}));

const chapter = (overrides = {}) => ({
  id: 'ch-1',
  storyId: 's-1',
  name: 'Chapter 1',
  type: 'chapter',
  index: 0,
  isDeleted: false,
  ...overrides,
});
const scene = (overrides = {}) => ({
  id: 'sc-1',
  storyId: 's-1',
  name: 'Scene 1',
  chapterId: 'ch-1',
  index: 0,
  summary: 'It begins.',
  isDeleted: false,
  ...overrides,
});
const character = (overrides = {}) => ({
  id: 'c-1',
  storyId: 's-1',
  name: 'Alice',
  description: 'The lead.',
  createdAt: new Date('2024-01-01'),
  isDeleted: false,
  ...overrides,
});
const item = (overrides = {}) => ({
  id: 'i-1',
  storyId: 's-1',
  name: 'Sword',
  description: 'Sharp.',
  initialState: 'new',
  createdAt: new Date('2024-01-01'),
  isDeleted: false,
  ...overrides,
});

const catalogState = (overrides = {}) => ({
  characters: [],
  scenes: [],
  chapters: [],
  presence: [],
  items: [],
  journeys: [],
  loading: false,
  fetchAllItemJourneys: jest.fn().mockResolvedValue([]),
  ...overrides,
});

const storyCatalog = () =>
  catalogState({
    characters: [character(), character({ id: 'c-2', name: 'Bob' })],
    scenes: [scene(), scene({ id: 'sc-2', name: 'Scene 2', index: 1 })],
    chapters: [chapter()],
    presence: [
      { characterId: 'c-1', sceneId: 'sc-1' },
      { characterId: 'c-2', sceneId: 'sc-2' },
    ],
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockCanvasProps.current = null;
  mockSheetProps.current = null;
  mockCatalogCalls.length = 0;
  mockStory = { id: 's-1', type: 'linear', title: 'Story' };
  mockCatalog = storyCatalog();
  mockDeliver.mockResolvedValue({ delivered: true, fileName: 'Story-presenca.svg', uri: '' });
});

describe('PresenceMatrixViewerContent', () => {
  it('asks the catalog for the selected story', async () => {
    await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={jest.fn()}
      />,
    );

    expect(mockCatalogCalls[0]).toEqual(['s-1', [], false]);
  });

  it('refuses branching stories, with a way out', async () => {
    mockStory = { id: 's-1', type: 'branching', title: 'Story' };
    const onClose = jest.fn();
    const screen = await render(
      <PresenceMatrixViewerContent request={{ kind: 'character' }} onClose={onClose} />,
    );

    expect(screen.getByText('presence_matrix_branching_unavailable')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('icon-close').parent!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('spins while the catalog loads', async () => {
    mockCatalog = catalogState({ loading: true });
    const screen = await render(
      <PresenceMatrixViewerContent request={{ kind: 'character' }} onClose={jest.fn()} />,
    );

    // The loading branch is bare: no header, no picker, no canvas, no empty state.
    expect(screen.queryByText('presence_matrix_title')).toBeNull();
    expect(screen.queryByTestId('multi-select')).toBeNull();
    expect(screen.queryByTestId('presence-canvas')).toBeNull();
    expect(screen.queryByText('presence_matrix_start_title')).toBeNull();
  });

  it('invites the reader to pick series when the matrix is empty', async () => {
    const screen = await render(
      <PresenceMatrixViewerContent request={{ kind: 'character' }} onClose={jest.fn()} />,
    );

    expect(screen.getByText('presence_matrix_start_title')).toBeTruthy();
    expect(screen.getByText('presence_matrix_empty_characters')).toBeTruthy();
    expect(screen.queryByTestId('presence-canvas')).toBeNull();
  });

  it('preselects the requested character and draws its row', async () => {
    const screen = await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('multi-select').props.selectedValues).toEqual(['c-1']);
    expect(screen.getByTestId('presence-canvas')).toBeTruthy();
    expect(mockCanvasProps.current?.layout.rows).toHaveLength(1);
    expect(mockCanvasProps.current?.layout.rows[0].label).toBe('Alice');
    expect(mockCanvasProps.current?.showRowCoverage).toBe(true);
  });

  it('labels item rows with their initial state and hides the coverage', async () => {
    mockCatalog = storyCatalog();
    mockCatalog.items = [item()];
    mockCatalog.journeys = [{ itemId: 'i-1', sceneId: 'sc-1', newState: 'used' }];
    await render(
      <PresenceMatrixViewerContent request={{ kind: 'item', itemId: 'i-1' }} onClose={jest.fn()} />,
    );

    expect(mockCatalogCalls[0]).toEqual(['s-1', ['i-1'], true]);
    expect(mockCanvasProps.current?.layout.rows[0].label).toBe('Sword · new');
    expect(mockCanvasProps.current?.layout.rows[0].cells.get('sc-1')).toBe('used');
    expect(mockCanvasProps.current?.showRowCoverage).toBe(false);
  });

  it('caps the selection at the visible series', async () => {
    mockCatalog = storyCatalog();
    mockCatalog.characters = Array.from({ length: 13 }, (_, index) =>
      character({ id: `c-${index}`, name: `Name ${index}` }),
    );
    const screen = await render(
      <PresenceMatrixViewerContent request={{ kind: 'character' }} onClose={jest.fn()} />,
    );

    await act(async () => {
      screen
        .getByTestId('multi-select')
        .props.onSelectionChange(Array.from({ length: 13 }, (_, index) => `c-${index}`));
    });

    expect(screen.getByTestId('multi-select').props.selectedValues).toHaveLength(
      MAX_VISIBLE_SERIES,
    );
  });

  it('offers the event scenes as an opt-in, off by default', async () => {
    mockCatalog = storyCatalog();
    mockCatalog.chapters = [chapter(), chapter({ id: 'ev-1', name: 'Era', type: 'event' })];
    mockCatalog.scenes = [
      ...mockCatalog.scenes,
      scene({ id: 'sc-e', name: 'Era scene', chapterId: 'ev-1' }),
    ];
    const screen = await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={jest.fn()}
      />,
    );

    expect(mockCanvasProps.current?.layout.scenes).toHaveLength(2);
    expect(screen.getByText('presence_matrix_show_events')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('toggle-matrix-events'));

    expect(screen.getByText('presence_matrix_hide_events')).toBeTruthy();
    expect(mockCanvasProps.current?.layout.scenes).toHaveLength(3);
  });

  it('hides the event toggle when the story has no events', async () => {
    const screen = await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('toggle-matrix-events')).toBeNull();
  });

  it('adds every series in alphabetical order', async () => {
    const screen = await render(
      <PresenceMatrixViewerContent request={{ kind: 'character' }} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText('presence_matrix_add_all').parent!);
    await fireEvent.press(screen.getByText('presence_matrix_order_alphabetical'));

    expect(screen.getByTestId('multi-select').props.selectedValues).toEqual(['c-1', 'c-2']);
    expect(screen.queryByTestId('order-modal')).toBeNull();
  });

  it('adds every series in order of first appearance', async () => {
    mockCatalog = storyCatalog();
    // Bob appears in the first scene, Alice only in the second.
    mockCatalog.presence = [
      { characterId: 'c-2', sceneId: 'sc-1' },
      { characterId: 'c-1', sceneId: 'sc-2' },
    ];
    const screen = await render(
      <PresenceMatrixViewerContent request={{ kind: 'character' }} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText('presence_matrix_add_all').parent!);
    await fireEvent.press(screen.getByText('presence_matrix_order_appearance'));

    expect(screen.getByTestId('multi-select').props.selectedValues).toEqual(['c-2', 'c-1']);
  });

  it('offers the compact view back once everything is shown', async () => {
    mockCatalog = storyCatalog();
    mockCatalog.characters = Array.from({ length: 13 }, (_, index) =>
      character({ id: `c-${index}`, name: `Name ${index}` }),
    );
    const screen = await render(
      <PresenceMatrixViewerContent request={{ kind: 'character' }} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText('presence_matrix_add_all').parent!);
    await fireEvent.press(screen.getByText('presence_matrix_order_alphabetical'));

    expect(screen.getByText('presence_matrix_complete_view_hint')).toBeTruthy();
    await fireEvent.press(screen.getByText('presence_matrix_show_compact').parent!);
    expect(screen.getByTestId('multi-select').props.selectedValues).toHaveLength(
      MAX_VISIBLE_SERIES,
    );
  });

  it('opens the tapped scene and closes it from the sheet', async () => {
    const screen = await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      mockCanvasProps.current?.onPressScene('sc-1');
    });

    expect(screen.getByTestId('graph-node-sheet')).toBeTruthy();
    expect(mockSheetProps.current?.title).toBe('Scene 1');

    await act(async () => {
      mockSheetProps.current?.onClose();
    });
    expect(screen.queryByTestId('graph-node-sheet')).toBeNull();
  });

  it('opens the tapped character with its presence', async () => {
    await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      mockCanvasProps.current?.onPressRow('c-1');
    });

    expect(mockSheetProps.current?.title).toBe('Alice');
    expect(mockSheetProps.current?.sections).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'presence_matrix_presence' })]),
    );
  });

  it('exports the drawn matrix and reports the delivery', async () => {
    const screen = await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByTestId('icon-image-outline'));

    expect(mockDeliver).toHaveBeenCalledWith(
      expect.stringContaining('<svg'),
      'Story-presenca.svg',
      'svg',
    );
    expect(mockNotify).toHaveBeenCalledWith('presence_matrix_export_success', 'success');
  });

  it('resets the selection when another matrix is requested', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-1' }}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('multi-select').props.selectedValues).toEqual(['c-1']);

    await screen.rerender(
      <PresenceMatrixViewerContent
        request={{ kind: 'character', characterId: 'c-2' }}
        onClose={onClose}
      />,
    );

    expect(screen.getByTestId('multi-select').props.selectedValues).toEqual(['c-2']);
  });
});
