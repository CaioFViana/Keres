import { act, fireEvent, render } from '@testing-library/react-native';
import type { BoardContentType } from '@keres/shared';
import { MAX_BOARD_TITLE_LENGTH } from '@keres/shared';
import React from 'react';
import BoardCanvasHeaderActions from '../../src/components/features/boards/BoardCanvasHeaderActions';
import BoardConnectionModal from '../../src/components/features/boards/BoardConnectionModal';
import BoardCreateModal from '../../src/components/features/boards/BoardCreateModal';
import LocationMapCreateModal from '../../src/components/features/location-maps/LocationMapCreateModal';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
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

const mockScreenAnchor = jest.fn();
jest.mock('../../src/guides/useGuideAnchor', () => ({
  __esModule: true,
  useGuideAnchor: jest.fn(() => () => {}),
  useScreenAnchor: (...args: unknown[]) => mockScreenAnchor(...args),
}));

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <RNView>{children}</RNView> : null,
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
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <RN.View
        testID={testID ?? (typeof children === 'string' ? children : 'mock-button')}
        onPress={onPress}
        disabled={disabled}
      >
        <RN.Text>{children}</RN.Text>
      </RN.View>
    ),
  };
});

const mockGraphConnectionModal = jest.fn();
jest.mock('../../src/components/features/graphs/GraphConnectionModal/GraphConnectionModal', () => {
  const RN = jest.requireActual('react-native');
  return function MockGraphConnectionModal(props: Record<string, unknown>) {
    mockGraphConnectionModal(props);
    return <RN.View testID="graph-connection-modal" />;
  };
});

beforeEach(() => jest.clearAllMocks());

describe('BoardCanvasHeaderActions', () => {
  const press = async (view: Awaited<ReturnType<typeof render>>, label: string) =>
    fireEvent.press(view.getByLabelText(label));

  it('wires revert and save', async () => {
    const handlers = {
      onRevert: jest.fn(),
      onSave: jest.fn(),
    };
    const view = await render(<BoardCanvasHeaderActions dirty {...handlers} />);

    await press(view, 'board_revert');
    await press(view, 'board_save');

    expect(handlers.onRevert).toHaveBeenCalledTimes(1);
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
  });

  it('keeps only the document actions, the mode toggles live in the tools bar', async () => {
    const view = await render(
      <BoardCanvasHeaderActions dirty onRevert={jest.fn()} onSave={jest.fn()} />,
    );

    expect(view.getByLabelText('board_revert')).toBeTruthy();
    expect(view.getByLabelText('board_save')).toBeTruthy();
    expect(mockScreenAnchor).toHaveBeenCalledWith('BoardCanvas', 'document');
    expect(view.queryByLabelText('graph_connection_mode')).toBeNull();
    expect(view.queryByLabelText('objects_edit')).toBeNull();
    expect(view.queryByLabelText('board_edit_layout')).toBeNull();
  });

  it('disables revert and save while clean', async () => {
    const view = await render(
      <BoardCanvasHeaderActions dirty={false} onRevert={jest.fn()} onSave={jest.fn()} />,
    );

    expect(view.getByLabelText('board_revert').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(view.getByLabelText('board_save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});

describe.each([
  ['BoardCreateModal', BoardCreateModal, 'board_create_title', 'board_description_placeholder'],
  ['LocationMapCreateModal', LocationMapCreateModal, 'location_map_create_title', 'title_optional'],
] as const)('%s', (_name, Modal, titleKey, descriptionPlaceholder) => {
  it('renders nothing when hidden', async () => {
    const view = await render(<Modal visible={false} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    expect(view.toJSON()).toBeNull();
  });

  it('confirms a trimmed name with a nullable description', async () => {
    const onConfirm = jest.fn();
    const view = await render(<Modal visible onCancel={jest.fn()} onConfirm={onConfirm} />);

    expect(view.getByText(titleKey)).toBeTruthy();
    expect(view.getByText('name')).toBeTruthy();
    expect(view.getByTestId('add').props.disabled).toBe(true);

    await fireEvent.changeText(view.getByPlaceholderText('name_placeholder'), '  Atlas  ');
    expect(view.getByTestId('add').props.disabled).toBe(false);

    await act(async () => {
      view.getByTestId('add').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith('Atlas', null);

    await fireEvent.changeText(view.getByPlaceholderText(descriptionPlaceholder), 'Known world');
    await act(async () => {
      view.getByTestId('add').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith('Atlas', 'Known world');
  });

  it('prefills from initial values and honors custom chrome', async () => {
    const onCancel = jest.fn();
    const view = await render(
      <Modal
        visible
        initialValues={{ name: 'Draft', description: 'Drafted' }}
        title="Custom title"
        confirmLabel="Custom confirm"
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />,
    );

    expect(view.getByText('Custom title')).toBeTruthy();
    expect(view.getByTestId('Custom confirm')).toBeTruthy();
    expect(view.getByPlaceholderText('name_placeholder').props.value).toBe('Draft');

    await act(async () => {
      view.getByTestId('cancel').props.onPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('BoardConnectionModal', () => {
  const content = (edges: BoardContentType['edges']): BoardContentType =>
    ({
      nodes: [
        { id: 'a', kind: 'note', x: 0, y: 0, title: 'A' },
        { id: 'b', kind: 'note', x: 10, y: 10, title: 'B' },
      ],
      edges,
    }) as BoardContentType;

  const confirmWith = async (connection: {
    directed: boolean;
    direction: 'forward' | 'reverse';
    label: string | null;
  }) => {
    const props = mockGraphConnectionModal.mock.calls[0][0] as {
      onConfirm: (value: typeof connection) => void;
    };
    await act(async () => {
      props.onConfirm(connection);
    });
  };

  it('resolves node names with id fallbacks', async () => {
    await render(
      <BoardConnectionModal
        pair={{ from: 'a', to: 'missing' }}
        nodeTitles={{ a: 'Alpha' }}
        setContent={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(mockGraphConnectionModal).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceName: 'Alpha',
        targetName: 'missing',
        labelEnabled: true,
        labelMaxLength: MAX_BOARD_TITLE_LENGTH,
      }),
    );
  });

  it('appends a forward edge and closes', async () => {
    let current = content([]);
    const setContent = jest.fn((update: React.SetStateAction<BoardContentType>) => {
      current =
        typeof update === 'function'
          ? (update as (value: BoardContentType) => BoardContentType)(current)
          : update;
    });
    const onClose = jest.fn();
    await render(
      <BoardConnectionModal
        pair={{ from: 'a', to: 'b' }}
        nodeTitles={{ a: 'Alpha', b: 'Beta' }}
        setContent={setContent}
        onClose={onClose}
      />,
    );

    await confirmWith({ directed: true, direction: 'forward', label: 'leads to' });

    expect(current.edges).toHaveLength(1);
    expect(current.edges[0]).toMatchObject({
      from: 'a',
      to: 'b',
      directed: true,
      label: 'leads to',
    });
    expect(typeof current.edges[0].id).toBe('string');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('swaps endpoints for a reversed edge', async () => {
    let current = content([]);
    const setContent = jest.fn((update: React.SetStateAction<BoardContentType>) => {
      current =
        typeof update === 'function'
          ? (update as (value: BoardContentType) => BoardContentType)(current)
          : update;
    });
    await render(
      <BoardConnectionModal
        pair={{ from: 'a', to: 'b' }}
        nodeTitles={{}}
        setContent={setContent}
        onClose={jest.fn()}
      />,
    );

    await confirmWith({ directed: true, direction: 'reverse', label: null });

    expect(current.edges[0]).toMatchObject({ from: 'b', to: 'a' });
  });

  it('keeps the content untouched when the pair is already linked', async () => {
    const before = content([{ id: 'e1', from: 'b', to: 'a', directed: false, label: null }]);
    let current = before;
    const setContent = jest.fn((update: React.SetStateAction<BoardContentType>) => {
      current =
        typeof update === 'function'
          ? (update as (value: BoardContentType) => BoardContentType)(current)
          : update;
    });
    const onClose = jest.fn();
    await render(
      <BoardConnectionModal
        pair={{ from: 'a', to: 'b' }}
        nodeTitles={{}}
        setContent={setContent}
        onClose={onClose}
      />,
    );

    await confirmWith({ directed: false, direction: 'forward', label: null });

    expect(current).toBe(before);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
