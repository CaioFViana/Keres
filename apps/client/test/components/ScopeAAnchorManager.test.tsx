import { act, render } from '@testing-library/react-native';
import React from 'react';
import AnchorManager from '../../src/components/features/chapters/AnchorManager/AnchorManager';
import type { AnchorDraft } from '../../src/components/features/chapters/AnchorManager/AnchorEditModal';
import type { ChapterAnchorRow } from '../../src/hooks/useChapterAnchors';

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
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

jest.mock('../../src/components/common/display/CollapsibleCard/CollapsibleCard', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      children,
      initialExpanded,
    }: {
      title: string;
      children: React.ReactNode;
      initialExpanded?: boolean;
    }) => (
      <RN.View testID="collapsible-card" title={title} initialExpanded={initialExpanded}>
        {children}
      </RN.View>
    ),
  };
});

const mockRelationList = jest.fn();
jest.mock('../../src/components/common/display/EntityRelationList/EntityRelationList', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: {
      items: { id: string; details?: React.ReactNode; trailing?: React.ReactNode }[];
      emptyText: string;
    }) => {
      mockRelationList(props);
      if (props.items.length === 0) return <RN.Text>{props.emptyText}</RN.Text>;
      return (
        <RN.View testID="relation-list">
          {props.items.map((item) => (
            <RN.View key={item.id} testID={`anchor-row-${item.id}`}>
              {item.details}
              {item.trailing}
            </RN.View>
          ))}
        </RN.View>
      );
    },
  };
});

const mockEditModal = jest.fn();
jest.mock('../../src/components/features/chapters/AnchorManager/AnchorEditModal', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockEditModal(props);
    return null;
  },
}));

const mockUseChapterAnchors = jest.fn();
jest.mock('../../src/hooks/useChapterAnchors', () => ({
  useChapterAnchors: (...args: unknown[]) => mockUseChapterAnchors(...args),
}));

const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: (selector: (state: unknown) => unknown) =>
    selector({ showNotification: mockShowNotification }),
}));

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const anchor = (overrides: Partial<ChapterAnchorRow> = {}): ChapterAnchorRow =>
  ({
    id: 'anchor-1',
    order: 1,
    startSceneId: 'scene-1',
    startPosition: 'start',
    startOffset: null,
    startOffsetUnit: null,
    endSceneId: 'scene-2',
    endPosition: 'end',
    endOffset: null,
    endOffsetUnit: null,
    ...overrides,
  }) as ChapterAnchorRow;

const hookState = (overrides: Record<string, unknown> = {}) => ({
  anchors: [] as ChapterAnchorRow[],
  scenes: [{ id: 'scene-1', label: 'Arrival' }],
  sceneNames: new Map([['scene-1', 'Arrival']]),
  hasContents: true,
  save: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
  ...overrides,
});

/** Edit/remove handlers of a row, read off the recorded relation items. */
const trailingPressOf = (rowId: string) => {
  const calls = mockRelationList.mock.calls;
  const items = calls[calls.length - 1][0].items as {
    id: string;
    trailing?: { props?: { children?: unknown } };
  }[];
  const row = items.find((item) => item.id === rowId);
  const buttons = React.Children.toArray(row?.trailing?.props?.children) as {
    props: { onPress: () => void };
  }[];
  return buttons.map((button) => button.props.onPress);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AnchorManager', () => {
  it('shows the empty state and opens a blank draft', async () => {
    mockUseChapterAnchors.mockReturnValue(hookState());
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    expect(view.getByTestId('collapsible-card').props.initialExpanded).toBe(false);
    expect(view.getByText('anchor_empty')).toBeTruthy();
    expect(view.getByText('anchor_add')).toBeTruthy();
    expect(mockEditModal.mock.calls[0][0]).toMatchObject({ visible: false });
  });

  it('hides the add action when read-only', async () => {
    mockUseChapterAnchors.mockReturnValue(hookState());
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable={false} />,
    );

    expect(view.queryByText('anchor_add')).toBeNull();
  });

  it('reads a closed stretch back as a sentence', async () => {
    mockUseChapterAnchors.mockReturnValue(hookState({ anchors: [anchor()] }));
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    expect(view.getByTestId('collapsible-card').props.initialExpanded).toBe(true);
    const sentence = view.getByText(/^anchor_sentence /);
    expect(sentence.children.join('')).toContain('Arrival');
  });

  it('reads an open stretch and offsets with direction', async () => {
    mockUseChapterAnchors.mockReturnValue(
      hookState({
        anchors: [
          anchor({
            id: 'anchor-2',
            endSceneId: null,
            endPosition: null,
            startOffset: -3,
            startOffsetUnit: 'days',
          }),
          anchor({ id: 'anchor-3', endSceneId: 'scene-9' }),
        ],
      }),
    );
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    // More than one stretch: each is numbered.
    expect(view.getAllByText(/^anchor_stretch /)).toHaveLength(2);
    const openSentence = view.getByText(/^anchor_sentence_open /);
    const openText = openSentence.children.join('');
    expect(openText).toContain('anchor_point_offset');
    expect(openText).toContain('anchor_direction_before');
    // Unknown scenes degrade to the shared placeholder.
    expect(view.getByText(/^anchor_sentence /)).toBeTruthy();
  });

  it('edits an anchor and saves the draft', async () => {
    const save = jest.fn(async () => {});
    mockUseChapterAnchors.mockReturnValue(hookState({ anchors: [anchor()], save }));
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    const [edit] = trailingPressOf('anchor-1');
    await act(async () => {
      edit();
    });

    const modalProps = mockEditModal.mock.calls[mockEditModal.mock.calls.length - 1][0] as {
      visible: boolean;
      initial: AnchorDraft;
      allowOpenStretch: boolean;
      onConfirm: (draft: AnchorDraft) => Promise<void>;
      onCancel: () => void;
    };
    expect(modalProps.visible).toBe(true);
    expect(modalProps.initial).toMatchObject({ startSceneId: 'scene-1', endSceneId: 'scene-2' });
    expect(modalProps.allowOpenStretch).toBe(true);

    const draft: AnchorDraft = { ...modalProps.initial, startPosition: 'middle' };
    await act(async () => {
      await modalProps.onConfirm(draft);
    });
    expect(save).toHaveBeenCalledWith(draft, 'anchor-1');
    const last = mockEditModal.mock.calls[mockEditModal.mock.calls.length - 1][0] as {
      visible: boolean;
    };
    expect(last.visible).toBe(false);
  });

  it('notifies when saving fails', async () => {
    const save = jest.fn(async () => {
      throw new Error('db down');
    });
    mockUseChapterAnchors.mockReturnValue(hookState({ anchors: [anchor()], save }));
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    const [edit] = trailingPressOf('anchor-1');
    await act(async () => {
      edit();
    });
    const modalProps = mockEditModal.mock.calls[mockEditModal.mock.calls.length - 1][0] as {
      onConfirm: (draft: AnchorDraft) => Promise<void>;
      initial: AnchorDraft;
    };
    await act(async () => {
      await modalProps.onConfirm(modalProps.initial);
    });

    expect(mockShowNotification).toHaveBeenCalledWith('anchor_save_failed', 'error');
  });

  it('deletes an anchor after confirmation', async () => {
    const erase = jest.fn(async () => {});
    mockUseChapterAnchors.mockReturnValue(hookState({ anchors: [anchor()], remove: erase }));
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    const [, remove] = trailingPressOf('anchor-1');
    await act(async () => {
      remove();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'anchor_delete_title',
      'anchor_delete_message',
      expect.any(Array),
    );
    const buttons = mockAlert.mock.calls[0][2] as {
      text: string;
      style?: string;
      onPress?: () => Promise<void>;
    }[];
    expect(buttons.map((button) => button.text)).toEqual(['cancel', 'delete']);
    await act(async () => {
      await buttons[1].onPress?.();
    });
    expect(erase).toHaveBeenCalledWith('anchor-1');
  });

  it('notifies when deletion fails', async () => {
    const erase = jest.fn(async () => {
      throw new Error('db down');
    });
    mockUseChapterAnchors.mockReturnValue(hookState({ anchors: [anchor()], remove: erase }));
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    const [, remove] = trailingPressOf('anchor-1');
    await act(async () => {
      remove();
    });
    const buttons = mockAlert.mock.calls[0][2] as { onPress?: () => Promise<void> }[];
    await act(async () => {
      await buttons[1].onPress?.();
    });

    expect(mockShowNotification).toHaveBeenCalledWith('anchor_save_failed', 'error');
  });

  it('forbids a second open stretch', async () => {
    mockUseChapterAnchors.mockReturnValue(
      hookState({ anchors: [anchor({ endSceneId: null, endPosition: null })] }),
    );
    const view = await render(
      <AnchorManager storyId="story-1" chapterId="ch-1" currentUserId="u1" editable />,
    );

    expect(view.queryByText('anchor_add')).toBeNull();
    expect(mockEditModal.mock.calls[0][0]).toMatchObject({ allowOpenStretch: false });
  });
});
