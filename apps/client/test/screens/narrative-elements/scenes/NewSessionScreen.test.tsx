import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import NewSessionScreen from '../../../../src/screens/narrative-elements/scenes/NewSessionScreen';

const mockReplace = jest.fn();
const mockStartSession = jest.fn();
const mockGetChapters = jest.fn();
const mockNotify = jest.fn();
let mockCanEdit = true;
let mockHeader: { title: string } | null = null;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ replace: (...args: unknown[]) => mockReplace(...args) }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key}:${Object.values(options).join('/')}` : key,
  }),
}));
jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { text: '#111', textSecondary: '#555', primary: '#00f' } }),
}));
jest.mock('../../../../src/theme/commonStyles', () => ({
  __esModule: true,
  getCommonContainerStyles: () => ({ container: {} }),
}));
jest.mock('../../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../../src/hooks/useFormScrollBottomPadding', () => ({
  __esModule: true,
  useFormScrollBottomPadding: () => 0,
}));
jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (args: { title: string }) => {
    mockHeader = args;
  },
}));
jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (type: string) => (type === 'Chapter' ? 'Session' : 'Scene'),
  }),
}));
jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({
      selectedStory: { id: 'story-1' },
      effectiveArc: { id: 'arc-1', medium: 'campaign' },
    }),
}));
jest.mock('../../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector: (state: unknown) => unknown) =>
    selector({ showNotification: (...args: unknown[]) => mockNotify(...args) }),
}));
jest.mock('../../../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: () => ({
    getAllByStoryId: (...args: unknown[]) => mockGetChapters(...args),
  }),
}));
jest.mock('../../../../src/services/storymanagement/SessionService', () => ({
  __esModule: true,
  startSession: (...args: unknown[]) => mockStartSession(...args),
}));
jest.mock('../../../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('../../../../src/components/common/forms/FormField/FormField', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, children }: { label: string; children: React.ReactNode }) => (
      <View>
        <Text>{label}</Text>
        {children}
      </View>
    ),
  };
});
jest.mock('../../../../src/components/common/inputs/DatePickerInput/DatePickerInput', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange }: { value: string | null; onChange: (value: string) => void }) => (
      <Text testID="date" onPress={() => onChange('2026-01-15')}>
        {`date:${value}`}
      </Text>
    ),
  };
});
jest.mock('../../../../src/components/common/controls/Button/Button', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      onPress,
      children,
      disabled,
      testID,
    }: {
      onPress: () => void;
      children: React.ReactNode;
      disabled?: boolean;
      testID?: string;
    }) => (
      <Text testID={testID} onPress={disabled ? undefined : onPress}>
        {children}
      </Text>
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCanEdit = true;
  mockHeader = null;
  mockGetChapters.mockResolvedValue([{}, {}, {}]);
  mockStartSession.mockResolvedValue({ chapter: { id: 'c' }, scene: { id: 'scene-9' } });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('NewSessionScreen', () => {
  it('asks for the date alone, starting from today', async () => {
    const view = await render(<NewSessionScreen />);

    expect(view.getByTestId('date').props.children).toBe(
      `date:${new Date().toISOString().slice(0, 10)}`,
    );
    expect(mockHeader?.title).toBe('new_session_title:Session');
  });

  it('opens the next session with its first scene and goes to write in it', async () => {
    const view = await render(<NewSessionScreen />);

    await fireEvent.press(view.getByTestId('date'));
    await fireEvent.press(view.getByTestId('new-session-begin'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('SceneEditor', { sceneId: 'scene-9' }),
    );
    expect(mockStartSession).toHaveBeenCalledWith(expect.anything(), 'user-1', {
      storyId: 'story-1',
      arcId: 'arc-1',
      chapterName: 'Session 4',
      sceneName: 'Scene 1',
      playedOn: '2026-01-15',
    });
  });

  it('says so when the session could not be started, and stays', async () => {
    mockStartSession.mockRejectedValue(new Error('boom'));
    const view = await render(<NewSessionScreen />);

    await fireEvent.press(view.getByTestId('new-session-begin'));

    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('new_session_failed', 'error'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('cannot be started by someone who cannot edit', async () => {
    mockCanEdit = false;
    const view = await render(<NewSessionScreen />);

    await fireEvent.press(view.getByTestId('new-session-begin'));

    expect(mockStartSession).not.toHaveBeenCalled();
  });
});
