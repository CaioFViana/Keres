import { cleanup, configure, fireEvent, render } from '@testing-library/react-native';

import RequiredAccountScreen from '@/src/screens/enter-stack/account/RequiredAccountScreen';

const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockReplace = jest.fn();
const mockNavigation = { replace: (...args: unknown[]) => mockReplace(...args) };
const mockUseDocumentTitle = jest.fn();
const mockFormProps = jest.fn();
const mockColors = {
  primary: '#0000ff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  border: '#cccccc',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => mockI18n,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, colors: mockColors }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/src/utils/nav/documentTitle', () => ({
  useDocumentTitle: (...args: unknown[]) => mockUseDocumentTitle(...args),
}));

/** The form is covered by its own tests; here its two endings are buttons that report what the screen gave it. */
jest.mock('@/src/screens/enter-stack/servers/ServerRegistrationForm', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      title: string;
      description: string;
      onCompleted: (result: unknown) => void;
      onClose: () => void;
    }) => {
      mockFormProps(props);
      return (
        <>
          <Text testID="form-title">{props.title}</Text>
          <Text testID="form-description">{props.description}</Text>
          <Text
            testID="form-completed-verify"
            onPress={() => props.onCompleted({ serverId: 'srv-1', needsVerification: true })}
          >
            completed-verify
          </Text>
          <Text
            testID="form-completed-saved"
            onPress={() => props.onCompleted({ serverId: 'srv-1', needsVerification: false })}
          >
            completed-saved
          </Text>
          <Text
            testID="form-completed-no-server"
            onPress={() => props.onCompleted({ serverId: null, needsVerification: true })}
          >
            completed-no-server
          </Text>
          <Text testID="form-close" onPress={() => props.onClose()}>
            close
          </Text>
        </>
      );
    },
  };
});

beforeAll(() => configure({ defaultIncludeHiddenElements: true }));
afterAll(() => configure({ defaultIncludeHiddenElements: false }));

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
});

describe('RequiredAccountScreen', () => {
  it('shows the account request under its own title and description, and sets the document title to it', async () => {
    const view = await render(<RequiredAccountScreen />);

    expect(view.getByTestId('required-account-screen')).toBeTruthy();
    expect(view.getByTestId('form-title').props.children).toBe('required_account_title');
    expect(view.getByTestId('form-description').props.children).toBe(
      'required_account_description',
    );
    expect(mockUseDocumentTitle).toHaveBeenCalledWith('required_account_title');
  });

  it('opens the age check of the new account when the account needs verification', async () => {
    const view = await render(<RequiredAccountScreen />);

    await fireEvent.press(view.getByTestId('form-completed-verify'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('StorySelection', {
      screen: 'ServerManagementDrawer',
      params: { screen: 'ServerVerification', params: { serverId: 'srv-1' } },
    });
  });

  it('goes straight to story selection when the account is saved and needs no verification', async () => {
    const view = await render(<RequiredAccountScreen />);

    await fireEvent.press(view.getByTestId('form-completed-saved'));

    expect(mockReplace).toHaveBeenCalledWith('StorySelection');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('goes to story selection without the verification when there is no server id to open it on', async () => {
    const view = await render(<RequiredAccountScreen />);

    await fireEvent.press(view.getByTestId('form-completed-no-server'));

    expect(mockReplace).toHaveBeenCalledWith('StorySelection');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('goes to story selection when the form is closed', async () => {
    const view = await render(<RequiredAccountScreen />);

    await fireEvent.press(view.getByTestId('form-close'));

    expect(mockReplace).toHaveBeenCalledWith('StorySelection');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});
