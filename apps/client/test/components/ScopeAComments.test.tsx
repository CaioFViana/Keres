import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import CommentableDetailField from '../../src/components/features/comments/CommentableDetailField/CommentableDetailField';
import CommentList from '../../src/components/features/comments/CommentList/CommentList';
import type CommentThreadModal from '../../src/components/features/comments/CommentThreadModal/CommentThreadModal';
import type { CommentSelect } from '../../src/db/schema';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      notification: '#fa0',
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

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
}));

// FlatList internals are invisible to host queries, so stand in a list that keeps
// the props under test (`data`, `onEndReached`) while rendering every row.
// (Prototype-chained, not spread: spreading `react-native` trips native-only getters.)
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  const mocked = Object.create(actual);
  // defineProperty: the prototype's exports are setter-less getters, so plain
  // assignment would silently keep the real component.
  Object.defineProperty(mocked, 'FlatList', {
    value: ({
      data,
      renderItem,
      onEndReached,
      ListFooterComponent,
    }: {
      data: { id: string }[];
      renderItem: (info: { item: { id: string }; index: number }) => React.ReactNode;
      onEndReached?: () => void;
      ListFooterComponent?: React.ComponentType;
    }) =>
      React.createElement(
        actual.View,
        { testID: 'mock-flat-list', data, onEndReached },
        (data ?? []).map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: item.id ?? index },
            renderItem({ item, index }),
          ),
        ),
        ListFooterComponent ? React.createElement(ListFooterComponent) : null,
      ),
  });
  return mocked;
});

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

const mockKeyboardAwareScreen = jest.fn();
jest.mock('../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => {
  const actual = jest.requireActual(
    '../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen',
  );
  return {
    __esModule: true,
    ...actual,
    default: (props: { children: React.ReactNode; footer?: React.ReactNode }) => {
      mockKeyboardAwareScreen(props);
      return (
        <>
          {props.children}
          {props.footer}
        </>
      );
    },
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

const mockDetailField = jest.fn();
jest.mock('../../src/components/common/display/DetailField/DetailField', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: { label: string; value: string }) => {
      mockDetailField(props);
      return (
        <RN.View testID="detail-field">
          <RN.Text>{props.label}</RN.Text>
          <RN.Text>{props.value}</RN.Text>
        </RN.View>
      );
    },
  };
});

const mockThreadModal = jest.fn();
jest.mock('../../src/components/features/comments/CommentThreadModal/CommentThreadModal', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockThreadModal(props);
    return null;
  },
}));

const mockUseStoryComments = jest.fn();
jest.mock('../../src/hooks/useStoryComments', () => ({
  useStoryComments: (...args: unknown[]) => mockUseStoryComments(...args),
}));

jest.mock('../../src/components/features/list-items/CommentListItem', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ comment }: { comment: { commentText: string } }) => (
      <RN.Text>{comment.commentText}</RN.Text>
    ),
  };
});

const mockUseAuthorProfiles = jest.fn();
jest.mock('../../src/hooks/useAuthorProfiles', () => ({
  useAuthorProfiles: (...args: unknown[]) => mockUseAuthorProfiles(...args),
}));

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const comment = (overrides: Partial<CommentSelect> = {}): CommentSelect =>
  ({
    id: 'comment-1',
    storyId: 'story-1',
    entityType: 'Scene',
    entityId: 'scene-1',
    authorUserId: 'user-1',
    commentText: 'Tighten this beat',
    excerptText: null,
    criticality: 3,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  }) as CommentSelect;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthorProfiles.mockReturnValue({});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('CommentableDetailField', () => {
  const baseProps = {
    storyId: 'story-1',
    label: 'Summary',
    value: 'A quiet arrival',
    comments: [] as CommentSelect[],
    canComment: false,
    isStoryOwner: false,
    currentUserId: 'user-1',
    onAddComment: jest.fn(async () => {}),
    onDeleteComment: jest.fn(async () => {}),
    onUpdateComment: jest.fn(async () => {}),
  };

  it('falls back to a plain field when nobody can comment and none exist', async () => {
    const view = await render(<CommentableDetailField {...baseProps} />);

    expect(view.getByTestId('detail-field')).toBeTruthy();
    expect(
      view.container.queryAll((node) => node.type === 'Icon'),
    ).toHaveLength(0);
    expect(mockThreadModal).not.toHaveBeenCalled();
  });

  it('opens the thread with a counter', async () => {
    const comments = [comment(), comment({ id: 'comment-2', commentText: 'Agreed' })];
    const view = await render(
      <CommentableDetailField {...baseProps} comments={comments} canComment />,
    );

    expect(view.getByText('2')).toBeTruthy();
    expect(mockThreadModal.mock.calls[0][0]).toMatchObject({ visible: false });

    await fireEvent.press(view.getByText('2'));

    const last = mockThreadModal.mock.calls[mockThreadModal.mock.calls.length - 1][0] as {
      visible: boolean;
      fieldLabel: string;
      fieldValueSnapshot: string;
      comments: CommentSelect[];
      onClose: () => void;
    };
    expect(last).toMatchObject({
      visible: true,
      fieldLabel: 'Summary',
      fieldValueSnapshot: 'A quiet arrival',
    });
    expect(last.comments).toHaveLength(2);

    await act(async () => {
      last.onClose();
    });
    const closed = mockThreadModal.mock.calls[mockThreadModal.mock.calls.length - 1][0] as {
      visible: boolean;
    };
    expect(closed.visible).toBe(false);
  });

  it('marks excerpt passages and taps open the thread', async () => {
    const comments = [comment({ excerptText: 'quiet' })];
    await render(<CommentableDetailField {...baseProps} comments={comments} canComment />);

    const field = mockDetailField.mock.calls[mockDetailField.mock.calls.length - 1][0] as {
      commentRanges: { start: number; length: number }[];
      selectable: boolean;
      onCommentPress: () => void;
    };
    expect(field.commentRanges).toEqual([{ start: 2, length: 5 }]);
    expect(field.selectable).toBe(true);

    await act(async () => {
      field.onCommentPress();
    });
    const last = mockThreadModal.mock.calls[mockThreadModal.mock.calls.length - 1][0] as {
      visible: boolean;
      initialExcerpt: string | null;
    };
    expect(last.visible).toBe(true);
    // No document outside web: the opener reads null, manual excerpt as before.
    expect(last.initialExcerpt).toBeNull();
  });
});

describe('CommentList', () => {
  const comments = [
    comment({ id: 'comment-1', commentText: 'Tighten this beat' }),
    comment({ id: 'comment-2', commentText: 'Love the landing' }),
  ];

  it('loads, searches and paginates', async () => {
    const loadMore = jest.fn();
    mockUseStoryComments.mockReturnValue({ comments, loading: false, loadMore });
    const view = await render(<CommentList storyId="story-1" />);

    expect(mockUseStoryComments).toHaveBeenCalledWith('story-1', 20);
    expect(view.getByText('Tighten this beat')).toBeTruthy();

    await fireEvent.changeText(view.getByPlaceholderText('search'), 'landing');
    expect(view.queryByText('Tighten this beat')).toBeNull();
    expect(view.getByText('Love the landing')).toBeTruthy();

    const list = view.getByTestId('mock-flat-list');
    expect(list.props.data).toHaveLength(1);
    await act(async () => {
      list.props.onEndReached();
    });
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state', async () => {
    mockUseStoryComments.mockReturnValue({ comments: [], loading: false, loadMore: jest.fn() });
    const view = await render(<CommentList storyId="story-1" />);

    expect(view.getByText('no_comments_yet')).toBeTruthy();
  });
});

describe('CommentThreadModal', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    storyId: 'story-1',
    fieldLabel: 'Summary',
    fieldValueSnapshot: 'A quiet arrival at dawn',
    comments: [] as CommentSelect[],
    canComment: true,
    isStoryOwner: false,
    currentUserId: 'user-1',
    onSubmit: jest.fn(async () => {}),
    onDelete: jest.fn(async () => {}),
    onUpdate: jest.fn(async () => {}),
  };

  const pressOwnedText = async (view: Awaited<ReturnType<typeof render>>, text: string) => {
    await fireEvent.press(view.getByText(text));
  };

  it('renders nothing when hidden', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(<RealModal {...baseProps} visible={false} />);

    expect(view.toJSON()).toBeNull();
  });

  it('pre-fills the excerpt from a fresh selection on open', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(<RealModal {...baseProps} visible={false} />);

    await view.rerender(<RealModal {...baseProps} visible initialExcerpt="quiet arrival" />);

    expect(view.getByTestId('comment-excerpt-input').props.value).toBe('quiet arrival');
  });

  it('lists the thread oldest-first with excerpts', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    mockUseAuthorProfiles.mockReturnValue({
      'user-1': { id: 'user-1', name: 'Ari', isCurrentUser: true },
    });
    const view = await render(
      <RealModal
        {...baseProps}
        comments={[
          comment({
            id: 'comment-2',
            commentText: 'Second',
            excerptText: 'quiet arrival',
            createdAt: new Date('2024-01-03T00:00:00Z'),
          }),
          comment({ id: 'comment-1', commentText: 'First' }),
        ]}
      />,
    );

    const texts = view.getAllByText(/^(First|Second)$/).map((node) => node.children.join(''));
    expect(texts).toEqual(['First', 'Second']);
    expect(view.getByText('quiet arrival')).toBeTruthy();
    expect(view.getAllByText(/Ari/)).toHaveLength(2);
    expect(view.getByText('A quiet arrival at dawn')).toBeTruthy();
  });

  it('posts a comment with the chosen criticality and resets the form', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const onSubmit = jest.fn(async () => {});
    const view = await render(<RealModal {...baseProps} onSubmit={onSubmit} />);

    expect(view.getByTestId('add_comment').props.disabled).toBe(true);
    await fireEvent.press(view.getByLabelText('comment_criticality_5'));
    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'quiet arrival');
    await fireEvent.changeText(
      view.getByPlaceholderText('comment_text_placeholder'),
      '  Trim me  ',
    );

    await act(async () => {
      await view.getByTestId('add_comment').props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      commentText: 'Trim me',
      excerptText: 'quiet arrival',
      criticality: 5,
    });
    expect(view.getByPlaceholderText('comment_text_placeholder').props.value).toBe('');
    expect(view.getByPlaceholderText('excerpt_placeholder').props.value).toBe('');
  });

  it('warns when the excerpt no longer matches the snapshot', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(<RealModal {...baseProps} />);

    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'stale words');
    expect(view.getByText('excerpt_not_found_warning')).toBeTruthy();
  });

  it('marks the typed excerpt where it first anchors in the snapshot', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(<RealModal {...baseProps} />);

    // Case-insensitive: 'QUIET' anchors 'quiet'.
    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'QUIET');
    const marked = view.getByText('quiet');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#aaf');
    expect(view.queryByText('excerpt_not_found_warning')).toBeNull();
  });

  it('shows the prose snapshot rendered and anchors excerpts in it', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(
      <RealModal
        {...baseProps}
        showExcerptAnchorNotice
        fieldValueSnapshot="A **quiet** arrival"
      />,
    );

    // Rendered, like the document: no markdown symbols in the preview.
    expect(view.queryByText('A **quiet** arrival')).toBeNull();
    expect(view.getByText('A quiet arrival')).toBeTruthy();

    await fireEvent.changeText(
      view.getByPlaceholderText('excerpt_placeholder'),
      'quiet arrival',
    );
    const marked = view.getByText('quiet arrival');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#aaf');
    expect(view.queryByText('excerpt_not_found_warning')).toBeNull();
  });

  it('frames a long prose preview around the anchored excerpt', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(
      <RealModal
        {...baseProps}
        showExcerptAnchorNotice
        fieldValueSnapshot={`Head ${'filler '.repeat(40)}needle ${'tail '.repeat(40)}`}
      />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'needle');
    const marked = view.getByText('needle');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#aaf');
    expect(view.queryByText('excerpt_not_found_warning')).toBeNull();
    // Framed, like backlinks: the head is cut, both context sides show.
    expect(view.queryByText(/Head/)).toBeNull();
    expect(view.getAllByText(/…/)).toHaveLength(2);
  });

  it('flows line breaks as spaces and anchors across them', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(
      <RealModal
        {...baseProps}
        showExcerptAnchorNotice
        fieldValueSnapshot={'A **bold**\nnew line.'}
      />,
    );

    // Rendered and flowing: no symbols, no line break in the preview.
    expect(view.getByText('A bold new line.')).toBeTruthy();

    // A typed excerpt spans the break like it spans a space.
    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'bold new line');
    const marked = view.getByText('bold new line');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#aaf');
    expect(view.queryByText('excerpt_not_found_warning')).toBeNull();
  });

  it('keeps literal markers literal outside prose mode', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(
      <RealModal {...baseProps} fieldValueSnapshot="Score: 2 * 3 = 6" />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), '2 * 3');
    const marked = view.getByText('2 * 3');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#aaf');
    expect(view.queryByText('excerpt_not_found_warning')).toBeNull();
  });

  it('marks only the first anchor when the excerpt repeats', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(
      <RealModal {...baseProps} fieldValueSnapshot="Waves. Waves again." />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'waves');
    // Only the first anchor splits out marked; the repeat stays inside the plain tail.
    const marked = view.getByText('Waves');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#aaf');
    const tail = view.getByText('. Waves again.');
    expect(StyleSheet.flatten(tail.props.style ?? {}).backgroundColor).toBeUndefined();
    expect(view.queryByText('excerpt_not_found_warning')).toBeNull();
  });

  it('anchors accents and leaves a stale excerpt unmarked with its warning', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(
      <RealModal {...baseProps} fieldValueSnapshot="Eles chegaram de manhã cedo" />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'manha');
    expect(StyleSheet.flatten(view.getByText('manhã').props.style).backgroundColor).toBe('#aaf');
    expect(view.queryByText('excerpt_not_found_warning')).toBeNull();

    await fireEvent.changeText(view.getByPlaceholderText('excerpt_placeholder'), 'stale words');
    expect(view.getByText('excerpt_not_found_warning')).toBeTruthy();
    // No anchor, no split: the snapshot still renders as one bare text node.
    expect(view.getByText('Eles chegaram de manhã cedo')).toBeTruthy();
  });

  it('renders saved excerpts as highlighter marks', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    mockUseAuthorProfiles.mockReturnValue({
      'user-1': { id: 'user-1', name: 'Ari', isCurrentUser: true },
    });
    const view = await render(
      <RealModal {...baseProps} comments={[comment({ excerptText: 'quiet arrival' })]} />,
    );

    const block = view.getByText('quiet arrival').parent!;
    expect(StyleSheet.flatten(block.props.style).backgroundColor).toBe('#aaf');
  });

  it('explains the first-match anchor only in the manuscript composer', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const manuscript = await render(<RealModal {...baseProps} showExcerptAnchorNotice />);
    expect(manuscript.getByText('excerpt_anchor_notice')).toBeTruthy();

    const field = await render(<RealModal {...baseProps} />);
    expect(field.queryByText('excerpt_anchor_notice')).toBeNull();
  });

  it('alerts when posting fails', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const onSubmit = jest.fn(async () => {
      throw new Error('db down');
    });
    const view = await render(<RealModal {...baseProps} onSubmit={onSubmit} />);

    await fireEvent.changeText(view.getByPlaceholderText('comment_text_placeholder'), 'Hello');
    await act(async () => {
      await view.getByTestId('add_comment').props.onPress();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_post_comment');
  });

  it('deletes a comment after confirmation', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const onDelete = jest.fn(async () => {});
    const view = await render(
      <RealModal {...baseProps} comments={[comment()]} onDelete={onDelete} />,
    );

    await pressOwnedText(view, 'delete');
    expect(mockAlert).toHaveBeenCalledWith('delete_comment_confirm', undefined, expect.any(Array));

    const buttons = mockAlert.mock.calls[0][2] as { onPress?: () => Promise<void> }[];
    await act(async () => {
      await buttons[1].onPress?.();
    });
    expect(onDelete).toHaveBeenCalledWith('comment-1');
  });

  it('hides deletion for uninvolved readers and the composer for readers', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(
      <RealModal
        {...baseProps}
        comments={[comment()]}
        currentUserId="stranger"
        canComment={false}
      />,
    );

    expect(view.queryByText('delete')).toBeNull();
    expect(view.queryByPlaceholderText('comment_text_placeholder')).toBeNull();
    expect(view.queryByText('no_comments_yet')).toBeNull();
  });

  it('pins the composer through the footer slot instead of the scroll content', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(<RealModal {...baseProps} />);

    const calls = mockKeyboardAwareScreen.mock.calls as { footer?: unknown }[][];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1][0].footer).toBeTruthy();
    // The composer still renders (post button reachable) from the slot.
    expect(view.getByTestId('comment-composer')).toBeTruthy();
    expect(view.getByTestId('add_comment')).toBeTruthy();
  });

  it('grows the composer inputs with their measured content', async () => {
    const RealModal = (
      jest.requireActual(
        '../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
      ) as { default: typeof CommentThreadModal }
    ).default;
    const view = await render(<RealModal {...baseProps} />);

    await fireEvent(view.getByTestId('comment-text-input'), 'contentSizeChange', {
      nativeEvent: { contentSize: { width: 100, height: 220 } },
    });

    expect(StyleSheet.flatten(view.getByTestId('comment-text-input').props.style).minHeight).toBe(
      220,
    );
  });
});
