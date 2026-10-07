import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import FountainImportScreen from '../../../../src/screens/narrative-elements/scenes/FountainImportScreen';

const mockGoBack = jest.fn();
const mockImport = jest.fn();
const mockPick = jest.fn();
const mockNotify = jest.fn();
let mockCanEdit = true;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: () => mockGoBack() }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
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
  useScreenHeader: () => undefined,
}));
jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ term: (type: string) => type }),
}));
jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({
      selectedStory: { id: 'story-1' },
      effectiveArc: { id: 'arc-1', medium: 'screenplay' },
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
jest.mock('../../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  pickTextFile: (...args: unknown[]) => mockPick(...args),
}));
jest.mock('../../../../src/services/storymanagement/FountainImportService', () => ({
  __esModule: true,
  importFountain: (...args: unknown[]) => mockImport(...args),
  titleCase: (name: string) => name.charAt(0) + name.slice(1).toLowerCase(),
}));
jest.mock('../../../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('../../../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      value,
      onValueChange,
      testID,
    }: {
      value: boolean;
      onValueChange: (value: boolean) => void;
      testID?: string;
    }) => (
      <Text testID={testID} onPress={() => onValueChange(!value)}>
        {value ? 'on' : 'off'}
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

const SCRIPT = [
  'Title: Kettle',
  '',
  '# Act One',
  '',
  'INT. KITCHEN - NIGHT',
  '',
  'MOM',
  'Anyone there?',
  '',
  'EXT. GARDEN - DAWN',
  '',
  'Quiet.',
].join('\n');

beforeEach(() => {
  jest.clearAllMocks();
  mockCanEdit = true;
  mockPick.mockResolvedValue({ name: 'kettle.fountain', text: SCRIPT });
  mockImport.mockResolvedValue({ chapters: 1, scenes: 2, places: 0, characters: 0 });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

async function choose(view: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(view.getByTestId('fountain-choose'));
  await waitFor(() => expect(view.getByTestId('fountain-summary')).toBeTruthy());
}

describe('FountainImportScreen', () => {
  it('offers nothing to import before a file is chosen', async () => {
    const view = await render(<FountainImportScreen />);

    expect(view.queryByTestId('fountain-import')).toBeNull();
  });

  it('plans the file and offers its places and characters, all off', async () => {
    const view = await render(<FountainImportScreen />);

    await choose(view);

    expect(view.getByTestId('fountain-summary').props.children).toBe(
      'fountain_import_summary:kettle.fountain/1/2',
    );
    expect(view.getByTestId('fountain-place-KITCHEN').props.children).toBe('off');
    expect(view.getByTestId('fountain-place-GARDEN').props.children).toBe('off');
    expect(view.getByTestId('fountain-character-MOM').props.children).toBe('off');
  });

  it('imports with exactly the places and characters that were switched on', async () => {
    const view = await render(<FountainImportScreen />);
    await choose(view);

    await fireEvent.press(view.getByTestId('fountain-place-KITCHEN'));
    await fireEvent.press(view.getByTestId('fountain-character-MOM'));
    await fireEvent.press(view.getByTestId('fountain-import'));

    await waitFor(() => expect(mockImport).toHaveBeenCalledTimes(1));
    const [, userId, input] = mockImport.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(input.storyId).toBe('story-1');
    expect(input.arcId).toBe('arc-1');
    expect([...input.choices.places]).toEqual(['KITCHEN']);
    expect([...input.choices.characters]).toEqual(['MOM']);
    expect(input.fallbackChapterName).toBe('Kettle');
    expect(input.plan.sections[0].scenes).toHaveLength(2);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockNotify).toHaveBeenCalledWith('fountain_import_done:1/2', 'success');
  });

  it('can switch a place off again', async () => {
    const view = await render(<FountainImportScreen />);
    await choose(view);

    await fireEvent.press(view.getByTestId('fountain-place-GARDEN'));
    await fireEvent.press(view.getByTestId('fountain-place-GARDEN'));
    await fireEvent.press(view.getByTestId('fountain-import'));

    await waitFor(() => expect(mockImport).toHaveBeenCalled());
    expect([...mockImport.mock.calls[0][2].choices.places]).toEqual([]);
  });

  it('says so, and offers no import, for a file with no scenes', async () => {
    mockPick.mockResolvedValue({ name: 'empty.txt', text: '' });
    const view = await render(<FountainImportScreen />);

    await choose(view);

    expect(view.getByTestId('fountain-summary').props.children).toBe('fountain_import_nothing');
    await fireEvent.press(view.getByTestId('fountain-import'));
    expect(mockImport).not.toHaveBeenCalled();
  });

  it('tells the person when a file cannot be read, and when the import fails, and stays', async () => {
    mockPick.mockRejectedValueOnce(new Error('unreadable'));
    const view = await render(<FountainImportScreen />);
    await fireEvent.press(view.getByTestId('fountain-choose'));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('fountain_import_unreadable', 'error'),
    );

    mockImport.mockRejectedValueOnce(new Error('boom'));
    await choose(view);
    await fireEvent.press(view.getByTestId('fountain-import'));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('fountain_import_failed', 'error'));
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('does nothing for someone who cannot edit', async () => {
    mockCanEdit = false;
    const view = await render(<FountainImportScreen />);

    await fireEvent.press(view.getByTestId('fountain-choose'));

    expect(mockPick).not.toHaveBeenCalled();
  });

  it('does nothing when the person cancels the picker', async () => {
    mockPick.mockResolvedValue(null);
    const view = await render(<FountainImportScreen />);

    await fireEvent.press(view.getByTestId('fountain-choose'));

    expect(view.queryByTestId('fountain-summary')).toBeNull();
  });
});
