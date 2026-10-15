import { cleanup, configure, fireEvent, render } from '@testing-library/react-native';
import { CLIENT_PRIVACY_VERSION } from '@/src/legal/privacyPolicy';
import { CLIENT_TERMS_VERSION } from '@/src/legal/clientTerms';

const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockReset = jest.fn();
const mockNavigation = { reset: (...args: unknown[]) => mockReset(...args) };
const mockGetAccepted = jest.fn();
const mockSetAccepted = jest.fn();
const mockUseDocumentTitle = jest.fn();
const mockColors = {
  primary: '#0000ff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  surface: '#f5f5f5',
  border: '#cccccc',
  error: '#ff0000',
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

jest.mock('@/src/legal/clientTermsAcceptance', () => ({
  __esModule: true,
  getAcceptedClientLegal: (...args: unknown[]) => mockGetAccepted(...args),
  setAcceptedClientLegal: (...args: unknown[]) => mockSetAccepted(...args),
}));

jest.mock('@/src/utils/nav/documentTitle', () => ({
  useDocumentTitle: (...args: unknown[]) => mockUseDocumentTitle(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/src/components/common/controls/Button/Button', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      onPress,
      disabled,
      testID,
      children,
    }: {
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
      children?: string;
    }) => (
      <Text
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        onPress={() => {
          if (!disabled) onPress?.();
        }}
      >
        {children}
      </Text>
    ),
  };
});

import LegalUpdateScreen from '@/src/screens/enter-stack/account/LegalUpdateScreen';

type Records = { terms: number | null; privacy: number | null };

/** What the device has recorded: a version per document, or null when never accepted. */
const recordsAt = ({ terms, privacy }: Records) =>
  mockGetAccepted.mockImplementation(async (document: string) => {
    const version = document === 'terms' ? terms : privacy;
    return version === null
      ? null
      : { version, acceptedAt: '2026-10-01T00:00:00.000Z', method: 'onboarding' };
  });

type View = Awaited<ReturnType<typeof render>>;

// The reading gate needs real measures: short content in tests never reaches the end alone.
const scrollToEnd = async (view: View, testID: string) => {
  await fireEvent.scroll(view.getByTestId(testID), {
    nativeEvent: {
      contentSize: { height: 2000, width: 400 },
      layoutMeasurement: { height: 500, width: 400 },
      contentOffset: { y: 1600, x: 0 },
    },
  });
};

/** Opens the document's text, reads it to the end, and agrees. */
const agreeTo = async (view: View, document: 'terms' | 'privacy') => {
  await fireEvent.press(view.getByTestId(`legal-update-${document}-read`));
  await view.findByTestId(`legal-update-${document}-modal-scroll`);
  await scrollToEnd(view, `legal-update-${document}-modal-scroll`);
  await fireEvent.press(view.getByTestId(`legal-update-${document}-modal-accept`));
};

const continueDisabled = (view: View) =>
  view.getByTestId('legal-update-continue').props.accessibilityState.disabled;

describe('LegalUpdateScreen', () => {
  // The modal's own elements are checked while they are open; keep hidden ones out of queries otherwise.
  beforeAll(() => configure({ defaultIncludeHiddenElements: true }));
  afterAll(() => configure({ defaultIncludeHiddenElements: false }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetAccepted.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('names the screen in the page title', async () => {
    recordsAt({ terms: CLIENT_TERMS_VERSION, privacy: null });
    await render(<LegalUpdateScreen />);

    expect(mockUseDocumentTitle).toHaveBeenCalledWith('legal_update_title');
  });

  it('lists only the documents that are behind', async () => {
    recordsAt({ terms: CLIENT_TERMS_VERSION, privacy: CLIENT_PRIVACY_VERSION - 1 });
    const view = await render(<LegalUpdateScreen />);

    await view.findByTestId('legal-update-row-privacy');
    expect(view.queryByTestId('legal-update-row-terms')).toBeNull();
    expect(view.queryByTestId('legal-update-terms-read')).toBeNull();
  });

  it('keeps continue disabled until the listed document is agreed to, then moves on to story selection', async () => {
    recordsAt({ terms: CLIENT_TERMS_VERSION, privacy: null });
    const view = await render(<LegalUpdateScreen />);
    await view.findByTestId('legal-update-row-privacy');

    expect(continueDisabled(view)).toBe(true);
    await fireEvent.press(view.getByTestId('legal-update-continue'));
    expect(mockReset).not.toHaveBeenCalled();

    await agreeTo(view, 'privacy');

    expect(continueDisabled(view)).toBe(false);
    await fireEvent.press(view.getByTestId('legal-update-continue'));
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'StorySelection' }] });
  });

  it('records each agreement as a re-acceptance at the current version', async () => {
    recordsAt({ terms: null, privacy: null });
    const view = await render(<LegalUpdateScreen />);
    await view.findByTestId('legal-update-row-terms');

    await agreeTo(view, 'terms');
    expect(mockSetAccepted).toHaveBeenCalledWith('terms', CLIENT_TERMS_VERSION, 'reaccept');

    await agreeTo(view, 'privacy');
    expect(mockSetAccepted).toHaveBeenCalledWith('privacy', CLIENT_PRIVACY_VERSION, 'reaccept');
    expect(mockSetAccepted).toHaveBeenCalledTimes(2);
  });

  it('needs both documents agreed when both are behind', async () => {
    recordsAt({ terms: CLIENT_TERMS_VERSION - 1, privacy: CLIENT_PRIVACY_VERSION - 1 });
    const view = await render(<LegalUpdateScreen />);
    await view.findByTestId('legal-update-row-terms');
    expect(view.getByTestId('legal-update-row-privacy')).toBeTruthy();

    await agreeTo(view, 'terms');
    expect(continueDisabled(view)).toBe(true);

    await agreeTo(view, 'privacy');
    expect(continueDisabled(view)).toBe(false);
  });

  it('asks for both documents when the records cannot be read', async () => {
    mockGetAccepted.mockRejectedValue(new Error('storage unavailable'));
    const view = await render(<LegalUpdateScreen />);

    await view.findByTestId('legal-update-row-terms');
    expect(view.getByTestId('legal-update-row-privacy')).toBeTruthy();
    expect(continueDisabled(view)).toBe(true);
  });
});
