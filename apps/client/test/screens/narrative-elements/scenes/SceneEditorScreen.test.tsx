import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { HeaderAction } from '../../../../src/components/common/navigation/HeaderActions/HeaderActions';
import SceneEditorScreen from '../../../../src/screens/narrative-elements/scenes/SceneEditorScreen';
import type { SceneSelect } from '../../../../src/db/schema';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockGetById = jest.fn();
const mockUpdateScene = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockUpdateComment = jest.fn();
const mockOnHtmlChange = jest.fn();
const mockOnMarksChange = jest.fn();
const mockApplyFormat = jest.fn();
const mockSaveBody = jest.fn();
const mockResetBody = jest.fn();
const mockAlert = jest.fn();
const mockEditorFocus = jest.fn();
const mockEditorRef = { current: { focus: mockEditorFocus } };

let mockHeaderArgs: { title: string; actions?: readonly HeaderAction[] } | null = null;
let mockSubscriptions: { event: string; listener: (...args: never[]) => unknown }[] = [];
let mockCanEdit = true;
let mockCommentsByField: Record<string, { id: string }[]> = {};
let mockBodyText = 'Saved prose.';
let mockBodyDirty = false;
let mockActiveMarks: string[] = [];
let mockRestoreSettled = true;
let mockUseSceneBodyDraftOptions: {
  savedBody: string | null;
  persist: (body: string | null) => Promise<void>;
} | null = null;

jest.mock('@react-navigation/native', () => {
  const route = { params: { sceneId: 'scene-1' } };
  let navigation: { navigate: (...args: never[]) => void; goBack: () => void } | null = null;
  return {
    __esModule: true,
    useNavigation: () => (navigation ??= { navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => route,
  };
});

jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));

jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (args: { title: string; actions?: readonly HeaderAction[] }) => {
    mockHeaderArgs = args;
  },
}));

jest.mock('../../../../src/hooks/useEntityRefreshLifecycle', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useEntityInitialLoad: (callback: () => void) => {
      react.useEffect(() => {
        callback();
      }, [callback]);
    },
    useEntityEventSubscriptions: (
      subscriptions: { event: string; listener: (...args: never[]) => unknown }[],
    ) => {
      mockSubscriptions = subscriptions;
    },
  };
});

jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));

jest.mock('../../../../src/hooks/useEntityComments', () => ({
  __esModule: true,
  useEntityComments: () => ({
    commentsByField: mockCommentsByField,
    canComment: true,
    isStoryOwner: true,
    currentUserId: 'user-1',
    addComment: mockAddComment,
    deleteComment: mockDeleteComment,
    updateComment: mockUpdateComment,
  }),
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: { id: 'story-1' } }),
}));

jest.mock('../../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));

// The draft lifecycle itself is covered node-side in `useSceneBodyDraft.test.ts` (the real
// SQLite driver cannot load in this environment); here the hook is a wired seam.
jest.mock('../../../../src/hooks/useSceneBodyDraft', () => ({
  __esModule: true,
  useSceneBodyDraft: (options: {
    savedBody: string | null;
    persist: (body: string | null) => Promise<void>;
  }) => {
    mockUseSceneBodyDraftOptions = options;
    const shared = jest.requireActual('@keres/shared') as typeof import('@keres/shared');
    const doc = shared.parseMarkdownToDocument(mockBodyText);
    const surfaceText = shared.documentTextContent(doc);
    return {
      editorRef: mockEditorRef,
      initialHtml: shared.documentToEnrichedHtml(doc),
      onHtmlChange: mockOnHtmlChange,
      onMarksChange: mockOnMarksChange,
      serializedBody: mockBodyText,
      applyFormat: mockApplyFormat,
      activeMarks: mockActiveMarks,
      wordCount: 2,
      charCount: surfaceText.length,
      sizeStatus: 'ok',
      isDirty: mockBodyDirty,
      overLimit: false,
      canSave: mockBodyDirty,
      save: mockSaveBody,
      saving: false,
      saveError: null,
      clearBodyDraft: jest.fn(),
      resetBody: mockResetBody,
      hasUnsavedChanges: mockBodyDirty,
      draftRestored: false,
      restoreSettled: mockRestoreSettled,
    };
  },
}));

jest.mock('../../../../src/db', () => ({
  __esModule: true,
  useDrizzle: () => ({}),
}));

jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getById: mockGetById, updateScene: mockUpdateScene }),
}));

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      notification: '#fa0',
      onPrimary: '#fff',
      onPrimaryContainer: '#001',
      primary: '#00f',
      primaryContainer: '#ccf',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('../../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../../../src/vocabulary/useVocabularyEntityCopy', () => {
  const copies: Record<string, object> = {};
  return {
    __esModule: true,
    useVocabularyEntityCopy: (kind: string) =>
      (copies[kind] ??= {
        notFound: `notfound-${kind}`,
        failedToLoad: `failed-${kind}`,
        failedToSave: `failed-save-${kind}`,
        loadingDetails: `loading-${kind}`,
        dataMissing: `missing-${kind}`,
      }),
  };
});

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});

jest.mock('../../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message: string }) => (
      <Text testID="screen-loading">{message}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});

jest.mock('../../../../src/components/features/comments/CommentThreadModal/CommentThreadModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      visible: boolean;
      comments: { id: string }[];
      fieldValueSnapshot: string;
      onSubmit: (input: {
        commentText: string;
        excerptText: string | null;
        criticality: number;
      }) => Promise<void>;
    }) =>
      props.visible ? (
        <>
          <Text testID="comments-modal">{`comments:${props.comments.length}`}</Text>
          <Text
            testID="comments-submit"
            onPress={() =>
              props.onSubmit({ commentText: 'Needs a beat', excerptText: null, criticality: 1 })
            }
          >
            submit
          </Text>
        </>
      ) : null,
  };
});

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeScene(overrides: Partial<SceneSelect> = {}): SceneSelect {
  return {
    id: 'scene-1',
    storyId: 'story-1',
    chapterId: 'chapter-1',
    locationId: null,
    name: 'Opening',
    index: 1,
    summary: 'It begins',
    body: 'Saved prose.',
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaderArgs = null;
  mockSubscriptions = [];
  mockCanEdit = true;
  mockCommentsByField = {};
  mockBodyText = 'Saved prose.';
  mockBodyDirty = false;
  mockActiveMarks = [];
  mockRestoreSettled = true;
  mockUseSceneBodyDraftOptions = null;
  mockGetById.mockResolvedValue(makeScene());
  mockUpdateScene.mockImplementation(async (_userId: string, _sceneId: string, data: object) =>
    makeScene({ ...data, updatedAt: new Date('2026-02-01T00:00:00.000Z') }),
  );
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

function headerAction(id: string): HeaderAction {
  const action = mockHeaderArgs?.actions?.find((candidate) => candidate.id === id);
  expect(action).toBeTruthy();
  return action as HeaderAction;
}

async function pressHeaderAction(id: string) {
  await act(async () => {
    headerAction(id).onPress();
  });
}

describe('SceneEditorScreen', () => {
  it('loads the scene and starts in write mode with the saved body', async () => {
    const view = await render(<SceneEditorScreen />);
    const input = await view.findByTestId('scene-body-editor.input');

    expect(input.props.defaultValue).toBe('<html><p>Saved prose.</p></html>');
    expect(mockHeaderArgs?.title).toBe('Opening');
  });

  it('holds a placeholder until the draft restore settles, then seeds it', async () => {
    mockRestoreSettled = false;
    const loading = await render(<SceneEditorScreen />);
    await loading.findByTestId('scene-body-editor-loading');

    expect(loading.queryByTestId('scene-body-editor.input')).toBeNull();
    await loading.unmount();

    // The settle carries the restored prose, so the seed — not a racing
    // imperative push — is what the mounted editor shows.
    mockRestoreSettled = true;
    mockBodyText = 'unsaved prose';
    const view = await render(<SceneEditorScreen />);
    const input = await view.findByTestId('scene-body-editor.input');

    expect(input.props.defaultValue).toBe('<html><p>unsaved prose</p></html>');
    expect(view.queryByTestId('scene-body-editor-loading')).toBeNull();
  });

  it('types through the draft hook and persists through the scene service', async () => {
    mockBodyDirty = true;
    const view = await render(<SceneEditorScreen />);
    const input = await view.findByTestId('scene-body-editor.input');

    await fireEvent(input, 'changeHtml', {
      nativeEvent: { value: '<html><p>Saved prose plus more.</p></html>' },
    });
    expect(mockOnHtmlChange).toHaveBeenCalledWith('<html><p>Saved prose plus more.</p></html>');

    await fireEvent.press(view.getByText('save'));
    expect(mockSaveBody).toHaveBeenCalledTimes(1);

    expect(mockUseSceneBodyDraftOptions?.savedBody).toBe('Saved prose.');
    await mockUseSceneBodyDraftOptions?.persist('Saved prose plus more.');
    expect(mockUpdateScene).toHaveBeenCalledWith('user-1', 'scene-1', {
      body: 'Saved prose plus more.',
    });
  });

  it('toggles between write and read from the header without losing text', async () => {
    const view = await render(<SceneEditorScreen />);
    await view.findByTestId('scene-body-editor.input');

    expect(headerAction('mode-write')).toMatchObject({ icon: 'pencil', active: true });
    expect(headerAction('mode-read')).toMatchObject({ icon: 'book-outline', active: false });
    await pressHeaderAction('mode-read');

    await waitFor(() => expect(view.queryByText('Saved prose.')).toBeTruthy());
    expect(view.queryByTestId('scene-body-editor.input')).toBeNull();
    expect(headerAction('mode-read')).toMatchObject({ icon: 'book', active: true });

    await pressHeaderAction('mode-write');
    const input = await view.findByTestId('scene-body-editor.input');
    expect(input.props.defaultValue).toBe('<html><p>Saved prose.</p></html>');
  });

  it('keeps the header reset disabled while the prose matches the saved body', async () => {
    const view = await render(<SceneEditorScreen />);
    await view.findByTestId('scene-body-editor.input');

    expect(headerAction('reset-body')).toMatchObject({
      icon: 'arrow-undo-outline',
      label: 'reset',
      disabled: true,
    });
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockResetBody).not.toHaveBeenCalled();
  });

  it('resets the prose through a header confirm, like the entity forms', async () => {
    mockBodyDirty = true;
    const view = await render(<SceneEditorScreen />);
    await view.findByTestId('scene-body-editor.input');

    expect(headerAction('reset-body')).toMatchObject({ disabled: false });

    await pressHeaderAction('reset-body');
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = mockAlert.mock.calls[0] as [
      string,
      string,
      { text: string; style?: string; onPress?: () => void }[],
    ];
    expect(title).toBe('form_reset_title');
    expect(message).toBe('form_reset_edit_message');
    expect(buttons.some((button) => button.style === 'cancel')).toBe(true);
    expect(mockResetBody).not.toHaveBeenCalled();

    await act(async () => {
      buttons.find((button) => button.text === 'reset')?.onPress?.();
    });
    expect(mockResetBody).toHaveBeenCalledTimes(1);
  });

  it('formats through the toolbar and refocuses the editor', async () => {
    const view = await render(<SceneEditorScreen />);
    const input = await view.findByTestId('scene-body-editor.input');

    await fireEvent(input, 'changeState', {
      nativeEvent: {
        bold: { isActive: true, isConflicting: false, isBlocking: false },
        italic: { isActive: false, isConflicting: false, isBlocking: false },
        underline: { isActive: false, isConflicting: false, isBlocking: false },
        strikeThrough: { isActive: false, isConflicting: false, isBlocking: false },
      },
    });
    expect(mockOnMarksChange).toHaveBeenCalledWith(['bold']);
    await fireEvent.press(view.getByTestId('scene-body-toolbar.bold'));

    expect(mockApplyFormat).toHaveBeenCalledWith('bold');
    expect(mockEditorFocus).toHaveBeenCalledTimes(1);
  });

  it('reflects the hook actives in the toolbar over the native input', async () => {
    mockBodyText = '**Saved** prose.';
    mockActiveMarks = ['bold'];
    const view = await render(<SceneEditorScreen />);
    const input = await view.findByTestId('scene-body-editor.input');

    expect(input.props.defaultValue).toBe('<html><p><b>Saved</b> prose.</p></html>');
    expect(view.getByTestId('scene-body-toolbar.bold').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByTestId('scene-body-toolbar.italic').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('reviews through the scene comments of the body field', async () => {
    mockCommentsByField = { body: [{ id: 'c-1' }], summary: [{ id: 'c-9' }] };
    const view = await render(<SceneEditorScreen />);
    await view.findByTestId('scene-body-editor.input');

    // The modes themselves are covered by the toggle test; here the mode switches
    // through the captured header action.
    await pressHeaderAction('mode-review');

    await fireEvent.press(await view.findByText('manuscript_comments_button'));
    expect((await view.findByTestId('comments-modal')).props.children).toBe('comments:1');

    await fireEvent.press(view.getByTestId('comments-submit'));
    expect(mockAddComment).toHaveBeenCalledWith(
      { fieldKey: 'body' },
      expect.objectContaining({
        commentText: 'Needs a beat',
        contentSnapshot: 'Saved prose.',
      }),
    );
  });

  it('shows the not-found state for a missing scene', async () => {
    mockGetById.mockResolvedValue(null);
    const view = await render(<SceneEditorScreen />);

    await waitFor(() =>
      expect(view.getByTestId('screen-error').props.children).toBe('notfound-Scene'),
    );
    await fireEvent.press(view.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('refreshes the scene on change events', async () => {
    const view = await render(<SceneEditorScreen />);
    await view.findByTestId('scene-body-editor.input');

    mockGetById.mockResolvedValue(makeScene({ name: 'Rewritten' }));
    const changed = mockSubscriptions.find((sub) => sub.event === 'scene_changed');
    await (changed?.listener as (storyId: string, sceneId: string) => Promise<void>)(
      'story-1',
      'scene-1',
    );

    await waitFor(() => expect(mockHeaderArgs?.title).toBe('Rewritten'));
  });
});
