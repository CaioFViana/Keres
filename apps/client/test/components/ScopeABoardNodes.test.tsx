import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import type { BoardContentType, BoardNodeType } from '@keres/shared';
import { MAX_BOARD_BODY_LENGTH, MAX_BOARD_TITLE_LENGTH } from '@keres/shared';
import React from 'react';
import { StyleSheet } from 'react-native';
import BoardNode from '../../src/components/features/boards/BoardNode';
import BoardNodeSheet from '../../src/components/features/boards/BoardNodeSheet';

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

jest.mock('expo-image', () => ({
  Image: (props: Record<string, unknown>) => mockImage(props) ?? null,
}));

const mockUseResolvedMediaUri = jest.fn();
jest.mock('../../src/hooks/useResolvedMediaUri', () => ({
  useResolvedMediaUri: (...args: unknown[]) => mockUseResolvedMediaUri(...args),
}));

const mockImage = jest.fn();

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
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

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const RN = jest.requireActual('react-native');
  const pill = (testID: string) => {
    const MockPill = (props: Record<string, unknown>) => <RN.View testID={testID} {...props} />;
    return MockPill;
  };
  return {
    __esModule: true,
    SingleSelectPill: pill('single-select-pill'),
    default: pill('multi-select-pill'),
  };
});

jest.mock('../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      value,
      onValueChange,
    }: {
      value: boolean;
      onValueChange: (next: boolean) => void;
    }) => <RN.View testID="themed-switch" value={value} onValueChange={onValueChange} />,
  };
});

const mockGalleryPreview = jest.fn();
jest.mock('../../src/components/features/boards/BoardNodeSheetGalleryPreview', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockGalleryPreview(props);
    return null;
  },
}));

const noteNode = (overrides: Partial<BoardNodeType> = {}): BoardNodeType =>
  ({
    id: 'node-1',
    kind: 'note',
    x: 10,
    y: 20,
    zIndex: 1,
    title: 'Todo',
    body: 'Buy milk',
    ...overrides,
  }) as BoardNodeType;

const entityNode = (overrides: Partial<BoardNodeType> = {}): BoardNodeType =>
  ({
    id: 'node-2',
    kind: 'entity',
    entityType: 'Scene',
    x: 0,
    y: 0,
    zIndex: 0,
    displayMode: 'compact',
    cardNote: null,
    ...overrides,
  }) as BoardNodeType;

const nodeHandlers = () => ({
  onSelect: jest.fn(),
  onMove: jest.fn(),
  onResize: jest.fn(),
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
  onOpenDetails: jest.fn(),
  onBringToFront: jest.fn(),
  onSendToBack: jest.fn(),
  onConnectionStart: jest.fn(),
  onConnectionMove: jest.fn(),
  onConnectionEnd: jest.fn(),
  onConnectionCancel: jest.fn(),
});

/**
 * PanResponder handlers, driven directly: the gesture math without the gesture.
 *
 * PanResponder derives its gestureState from the event's touch history (a second `dx`/`dy`
 * argument would simply be ignored), so the fakes below carry a single touch's positions and
 * let the real centroid math accumulate the deltas.
 */
let touchClock = 0;
const touchHistoryAt = (x: number, y: number, px: number, py: number) => {
  touchClock += 16;
  return {
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: touchClock,
    touchBank: [
      {
        touchActive: true,
        startPageX: x,
        startPageY: y,
        startTimeStamp: touchClock,
        currentPageX: x,
        currentPageY: y,
        currentTimeStamp: touchClock,
        previousPageX: px,
        previousPageY: py,
        previousTimeStamp: touchClock - 16,
      },
    ],
  };
};
const grantEvent = (x = 200, y = 200) => ({
  nativeEvent: {},
  currentTarget: {},
  touchHistory: touchHistoryAt(x, y, x, y),
});
const dragFrom = (x: number, y: number) => {
  let px = x;
  let py = y;
  return {
    grant: () => grantEvent(x, y),
    moveTo: (nx: number, ny: number) => {
      const event = { nativeEvent: {}, touchHistory: touchHistoryAt(nx, ny, px, py) };
      px = nx;
      py = ny;
      return event;
    },
    release: () => grantEvent(px, py),
  };
};

function responderOf(view: RenderResult, label?: string) {
  const responders = view.container.queryAll(
    (node) => typeof node.props?.onStartShouldSetResponder === 'function',
  );
  if (!label) return responders[0].props;
  const found = responders.find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`no responder labeled "${label}"`);
  return found.props;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseResolvedMediaUri.mockReturnValue(null);
});

describe('BoardNode', () => {
  const baseProps = {
    title: 'Todo',
    typeLabel: 'Note',
    selected: false,
    layoutEditing: false,
    connectionMode: false,
    overlayEditing: false,
    scale: 1,
  };

  it('draws a note card at its position', async () => {
    const view = await render(<BoardNode node={noteNode()} {...baseProps} {...nodeHandlers()} />);

    expect(view.getByText('Todo')).toBeTruthy();
    expect(view.getByText('Note')).toBeTruthy();
    const body = view.getByText('Buy milk');
    expect(body.props.numberOfLines).toBe(10);
    const root = responderOf(view);
    expect(StyleSheet.flatten(root.style)).toMatchObject({
      left: 10,
      top: 20,
      opacity: 1,
      borderWidth: 1,
    });
  });

  it('rings the selected card and fades ghosts', async () => {
    const selected = await render(
      <BoardNode node={noteNode()} {...baseProps} selected {...nodeHandlers()} />,
    );
    expect(StyleSheet.flatten(responderOf(selected).style)).toMatchObject({
      borderWidth: 2,
      borderColor: '#00f',
    });

    const ghost = await render(
      <BoardNode node={noteNode()} {...baseProps} ghost {...nodeHandlers()} />,
    );
    expect(StyleSheet.flatten(responderOf(ghost).style)).toMatchObject({ opacity: 0.7 });
    expect(ghost.getByText('Note').props.style).toBeTruthy();
  });

  it('shows the gallery picture with summary and card note', async () => {
    mockUseResolvedMediaUri.mockReturnValue('file:///resolved.png');
    const view = await render(
      <BoardNode
        node={entityNode({
          entityType: 'Gallery',
          displayMode: 'summary-and-note',
          cardNote: 'Pick me',
        })}
        {...baseProps}
        title="Stills"
        typeLabel="Gallery"
        galleryMedia={{
          mediaType: 'image',
          mimeType: 'image/png',
          localPath: 'file:///a.png',
          thumbnailPath: null,
        }}
        summary={{ title: 'Stills', details: 'Twelve frames' }}
        {...nodeHandlers()}
      />,
    );

    expect(mockImage).toHaveBeenCalledWith(
      expect.objectContaining({ source: { uri: 'file:///resolved.png' } }),
    );
    expect(view.getByText('Twelve frames')).toBeTruthy();
    expect(view.getByText('Pick me')).toBeTruthy();
  });

  it('exposes layout controls when a selected card is edited', async () => {
    const handlers = nodeHandlers();
    const node = noteNode();
    const view = await render(
      <BoardNode node={node} {...baseProps} selected layoutEditing {...handlers} />,
    );

    await fireEvent.press(view.getByLabelText('Send board card to back'));
    expect(handlers.onSendToBack).toHaveBeenCalledWith('node-1');
    await fireEvent.press(view.getByLabelText('Bring board card to front'));
    expect(handlers.onBringToFront).toHaveBeenCalledWith('node-1');
    await fireEvent.press(view.getByLabelText('Open board card details'));
    expect(handlers.onOpenDetails).toHaveBeenCalledWith(node);

    const resize = responderOf(view, 'Resize board card');
    const drag = dragFrom(200, 200);
    await act(async () => {
      resize.onResponderGrant(drag.grant());
      resize.onResponderMove(drag.moveTo(220, 210));
      resize.onResponderRelease(drag.release());
    });
    expect(handlers.onDragStart).toHaveBeenCalledWith('node-1');
    expect(handlers.onResize).toHaveBeenCalledWith(
      'node-1',
      expect.any(Number),
      expect.any(Number),
    );
    expect(handlers.onDragEnd).toHaveBeenCalledWith('node-1');
  });

  it('selects on tap and drags with zoom compensation', async () => {
    const handlers = nodeHandlers();
    const node = noteNode();
    const view = await render(<BoardNode node={node} {...baseProps} scale={2} {...handlers} />);

    const root = responderOf(view);
    expect(root.onStartShouldSetResponder()).toBe(true);

    const tap = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(tap.grant());
      root.onResponderRelease(tap.release());
    });
    expect(handlers.onSelect).toHaveBeenCalledWith(node);
    expect(handlers.onDragEnd).toHaveBeenCalledWith('node-1');

    handlers.onSelect.mockClear();
    const drag = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(drag.grant());
      root.onResponderMove(drag.moveTo(203, 200));
      root.onResponderMove(drag.moveTo(210, 204));
      root.onResponderRelease(drag.release());
    });
    // Below the threshold nothing moves; then one zoom-compensated move lands.
    expect(handlers.onMove).toHaveBeenCalledTimes(1);
    expect(handlers.onMove).toHaveBeenCalledWith('node-1', 15, 22);
    expect(handlers.onSelect).not.toHaveBeenCalled();
  });

  it('lets inner controls own the gesture while layout editing', async () => {
    const handlers = nodeHandlers();
    const view = await render(
      <BoardNode node={noteNode()} {...baseProps} selected layoutEditing {...handlers} />,
    );

    expect(responderOf(view).onStartShouldSetResponder()).toBe(false);
    expect(handlers.onDragStart).not.toHaveBeenCalled();
  });

  it('streams connection gestures in connection mode', async () => {
    const handlers = nodeHandlers();
    const node = noteNode();
    const view = await render(
      <BoardNode node={node} {...baseProps} connectionMode scale={2} {...handlers} />,
    );

    const root = responderOf(view);
    const drag = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(drag.grant());
      root.onResponderMove(drag.moveTo(210, 206));
      root.onResponderRelease(drag.release());
    });
    expect(handlers.onConnectionStart).toHaveBeenCalledWith(node);
    expect(handlers.onConnectionMove).toHaveBeenCalledWith('node-1', 5, 3);
    expect(handlers.onConnectionEnd).toHaveBeenCalledWith('node-1', 5, 3);

    await act(async () => {
      root.onResponderTerminate(drag.release());
    });
    expect(handlers.onConnectionCancel).toHaveBeenCalledTimes(1);
  });

  it('ends a normal drag on termination', async () => {
    const handlers = nodeHandlers();
    const view = await render(<BoardNode node={noteNode()} {...baseProps} {...handlers} />);

    await act(async () => {
      responderOf(view).onResponderTerminate(grantEvent());
    });
    expect(handlers.onDragEnd).toHaveBeenCalledWith('node-1');
    expect(handlers.onConnectionCancel).not.toHaveBeenCalled();
  });

  it('ignores taps and drags while overlays are edited', async () => {
    const handlers = nodeHandlers();
    const view = await render(
      <BoardNode node={noteNode()} {...baseProps} overlayEditing {...handlers} />,
    );

    const responder = responderOf(view);
    expect(responder.onStartShouldSetResponder()).toBe(false);
    expect(responder.onMoveShouldSetResponder({}, { dx: 50, dy: 0 })).toBe(false);
  });
});

describe('BoardNodeSheet', () => {
  const other = entityNode({ id: 'node-3', x: 50, y: 50 });
  const content = (edges: BoardContentType['edges'] = []): BoardContentType =>
    ({ nodes: [noteNode(), entityNode(), other], edges }) as BoardContentType;
  const nodeTitles = { 'node-1': 'Todo', 'node-2': 'Arrival', 'node-3': 'Betrayal' };

  const sheetProps = {
    title: 'Todo',
    typeLabel: '',
    ghost: false,
    nodeTitles,
    canEdit: true,
    onClose: jest.fn(),
    onChangeContent: jest.fn(),
    onOpenEntity: jest.fn(),
    onChangeNote: jest.fn(),
    onChangeEntityPresentation: jest.fn(),
  };

  it('falls back to the pin type key and closes', async () => {
    const onClose = jest.fn();
    const view = await render(
      <BoardNodeSheet {...sheetProps} node={entityNode()} content={content()} onClose={onClose} />,
    );

    expect(view.getByText('Todo')).toBeTruthy();
    expect(view.getByText('scene')).toBeTruthy();
    expect(mockGalleryPreview).toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('warns about ghosts and hides their entity row', async () => {
    const view = await render(
      <BoardNodeSheet {...sheetProps} node={entityNode()} content={content()} ghost />,
    );

    expect(view.getByText('board_deleted_entity')).toBeTruthy();
    expect(view.queryByText('board_open_entity')).toBeNull();
  });

  it('opens the entity behind a live pin', async () => {
    const onOpenEntity = jest.fn();
    const view = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={entityNode()}
        content={content()}
        onOpenEntity={onOpenEntity}
      />,
    );

    await fireEvent.press(view.getByText('board_open_entity'));
    expect(onOpenEntity).toHaveBeenCalledTimes(1);
  });

  it('saves edited notes with a nullable body', async () => {
    const onChangeNote = jest.fn();
    const view = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={noteNode()}
        content={content()}
        onChangeNote={onChangeNote}
      />,
    );

    expect(view.getByTestId('save').props.disabled).toBe(true);
    await fireEvent.changeText(view.getByPlaceholderText('title'), 'Todo v2');
    await fireEvent.changeText(view.getByPlaceholderText('board_note_body'), '  ');
    expect(view.getByTestId('save').props.disabled).toBe(false);

    await act(async () => {
      view.getByTestId('save').props.onPress();
    });
    expect(onChangeNote).toHaveBeenCalledWith('Todo v2', null);
  });

  it('resets the note draft when the pin changes', async () => {
    const view = await render(
      <BoardNodeSheet {...sheetProps} node={noteNode()} content={content()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('title'), 'Scratch');
    await view.rerender(
      <BoardNodeSheet
        {...sheetProps}
        node={noteNode({ id: 'node-9', title: 'Other', body: 'Else' })}
        content={content()}
      />,
    );
    expect(view.getByPlaceholderText('title').props.value).toBe('Other');
    expect(view.getByPlaceholderText('board_note_body').props.value).toBe('Else');
  });

  it('clamps text fields to the schema limits', async () => {
    const note = await render(
      <BoardNodeSheet {...sheetProps} node={noteNode()} content={content()} />,
    );

    expect(note.getByPlaceholderText('title').props.maxLength).toBe(MAX_BOARD_TITLE_LENGTH);
    expect(note.getByPlaceholderText('board_note_body').props.maxLength).toBe(
      MAX_BOARD_BODY_LENGTH,
    );
    expect(note.getByPlaceholderText('board_edge_label').props.maxLength).toBe(
      MAX_BOARD_TITLE_LENGTH,
    );

    const entity = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={entityNode({ displayMode: 'note', cardNote: 'Hi' })}
        content={content()}
      />,
    );
    expect(entity.getByPlaceholderText('board_card_note_placeholder').props.maxLength).toBe(
      MAX_BOARD_BODY_LENGTH,
    );
  });

  it('shows the entity summary or its absence', async () => {
    const full = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={entityNode()}
        content={content()}
        summary={{ title: 'Arrival', details: 'They land' }}
      />,
    );
    expect(full.getByText('board_entity_summary')).toBeTruthy();
    expect(full.getByText('They land')).toBeTruthy();

    const empty = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={entityNode()}
        content={content()}
        summary={{ title: 'Arrival', details: null }}
      />,
    );
    expect(empty.getByText('common_na')).toBeTruthy();

    const missing = await render(
      <BoardNodeSheet {...sheetProps} node={entityNode()} content={content()} />,
    );
    expect(missing.queryByText('board_entity_summary')).toBeNull();
  });

  it('changes the card presentation and its note', async () => {
    const onChangeEntityPresentation = jest.fn();
    const view = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={entityNode({ displayMode: 'note', cardNote: 'Hi' })}
        content={content()}
        onChangeEntityPresentation={onChangeEntityPresentation}
      />,
    );

    const [pill] = view.getAllByTestId('single-select-pill');
    expect(pill.props.value).toBe('note');
    await act(async () => {
      pill.props.onValueChange(null);
    });
    expect(onChangeEntityPresentation).toHaveBeenCalledWith('compact', 'Hi');

    await fireEvent.changeText(view.getByPlaceholderText('board_card_note_placeholder'), '');
    expect(onChangeEntityPresentation).toHaveBeenCalledWith('note', null);
  });

  it('lists edges with direction arrows and removes them', async () => {
    const onChangeContent = jest.fn();
    const edges = [
      { id: 'e1', from: 'node-1', to: 'node-2', directed: true, label: 'leads' },
      { id: 'e2', from: 'node-3', to: 'node-1', directed: true, label: null },
      { id: 'e3', from: 'node-1', to: 'ghost', directed: false, label: null },
    ] as BoardContentType['edges'];
    const view = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={noteNode()}
        content={content(edges)}
        onChangeContent={onChangeContent}
      />,
    );

    expect(view.getByText('→ Arrival')).toBeTruthy();
    expect(view.getByText('leads')).toBeTruthy();
    expect(view.getByText('← Betrayal')).toBeTruthy();
    expect(view.getByText('— ghost')).toBeTruthy();

    await fireEvent.press(view.getAllByLabelText('delete')[0]);
    expect(onChangeContent).toHaveBeenCalledWith({
      nodes: expect.any(Array),
      edges: [edges[1], edges[2]],
    });
  });

  it('connects to an unlinked pin once per tap burst', async () => {
    const onChangeContent = jest.fn();
    const base = content([{ id: 'e1', from: 'node-1', to: 'node-2', directed: true, label: null }]);
    const view = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={noteNode()}
        content={base}
        onChangeContent={onChangeContent}
      />,
    );

    const [picker] = view.getAllByTestId('multi-select-pill');
    // Self and the linked pin are out; only the stranger remains.
    expect(picker.props.options).toEqual([{ label: 'Betrayal', value: 'node-3' }]);
    expect(picker.props.placeholder).toBe('board_connect_pick');
    expect(view.getByTestId('board_add_edge').props.disabled).toBe(true);

    await act(async () => {
      picker.props.onSelectionChange(['node-3']);
    });
    expect(view.getByTestId('board_add_edge').props.disabled).toBe(false);
    expect(view.getByTestId('themed-switch').props.value).toBe(true);

    await act(async () => {
      view.getByTestId('themed-switch').props.onValueChange(false);
    });
    await fireEvent.changeText(view.getByPlaceholderText('board_edge_label'), '  next  ');

    await act(async () => {
      view.getByTestId('board_add_edge').props.onPress();
      view.getByTestId('board_add_edge').props.onPress();
    });
    expect(onChangeContent).toHaveBeenCalledTimes(1);
    const next = onChangeContent.mock.calls[0][0] as BoardContentType;
    expect(next.edges).toHaveLength(2);
    expect(next.edges[1]).toMatchObject({
      from: 'node-1',
      to: 'node-3',
      directed: false,
      label: 'next',
    });

    // The form resets for the next link.
    expect(view.getAllByTestId('multi-select-pill')[0].props.selectedValues).toEqual([]);
    expect(view.getByPlaceholderText('board_edge_label').props.value).toBe('');
    expect(view.getByTestId('themed-switch').props.value).toBe(true);
  });

  it('hides connecting when every pin is linked', async () => {
    const base = content([
      { id: 'e1', from: 'node-1', to: 'node-2', directed: true, label: null },
      { id: 'e2', from: 'node-1', to: 'node-3', directed: true, label: null },
    ]);
    const view = await render(<BoardNodeSheet {...sheetProps} node={noteNode()} content={base} />);

    expect(view.queryByText('board_connect_hint')).toBeNull();
    expect(view.queryByTestId('board_add_edge')).toBeNull();
  });

  it('removes the pin with its edges and closes', async () => {
    const onChangeContent = jest.fn();
    const onClose = jest.fn();
    const base = content([
      { id: 'e1', from: 'node-1', to: 'node-2', directed: true, label: null },
      { id: 'e2', from: 'node-2', to: 'node-3', directed: true, label: null },
    ]);
    const view = await render(
      <BoardNodeSheet
        {...sheetProps}
        node={noteNode()}
        content={base}
        onChangeContent={onChangeContent}
        onClose={onClose}
      />,
    );

    await act(async () => {
      view.getByTestId('board_remove_node').props.onPress();
    });
    expect(onChangeContent).toHaveBeenCalledWith({
      nodes: [entityNode(), other],
      edges: [base.edges[1]],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides every edit affordance when read-only', async () => {
    const view = await render(
      <BoardNodeSheet {...sheetProps} node={noteNode()} content={content()} canEdit={false} />,
    );

    expect(view.queryByPlaceholderText('title')).toBeNull();
    expect(view.queryByTestId('board_add_edge')).toBeNull();
    expect(view.queryByTestId('board_remove_node')).toBeNull();
    expect(view.queryByLabelText('delete')).toBeNull();
  });
});
