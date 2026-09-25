const mockT = (key: string) => key;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        primary: '#0000ff',
        text: '#111111',
        textSecondary: '#555555',
        background: '#ffffff',
        surface: '#f5f5f5',
        border: '#cccccc',
      },
    }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

import { cleanup, fireEvent, render } from '@testing-library/react-native';
import {
  APP_RELEASE,
  KERES_LICENSE,
  KERES_REPOSITORY_URL,
  THIRD_PARTY_CREDITS,
} from '@keres/shared';
import { Linking } from 'react-native';
import CreditsScreen from '../../../src/screens/enterstack/CreditsScreen';

describe('CreditsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });

  afterEach(() => {
    cleanup();
    (Linking.openURL as jest.Mock).mockRestore();
  });

  it('renders the release version and its English phrase verbatim', async () => {
    const view = await render(<CreditsScreen />);

    await view.findByText(`Keres ${APP_RELEASE.version} ${APP_RELEASE.name}`);
    expect(view.getByText(`\u201C${APP_RELEASE.phrase}\u201D`)).toBeTruthy();
  });

  it('renders the Keres license with its repository link', async () => {
    const view = await render(<CreditsScreen />);

    await view.findByText('credits_licenses_title');
    expect(view.getByText('credits_keres_license')).toBeTruthy();
    expect(view.getByText(`${KERES_LICENSE.name} (${KERES_LICENSE.shortName})`)).toBeTruthy();
    expect(view.getByText('credits_repository')).toBeTruthy();
  });

  it('renders every bundled third-party credit with its authors', async () => {
    const view = await render(<CreditsScreen />);

    for (const credit of THIRD_PARTY_CREDITS) {
      await view.findByText(credit.project);
      expect(view.getByText(credit.license)).toBeTruthy();
      for (const author of credit.authors) {
        expect(view.getByText(author.name)).toBeTruthy();
      }
      if (credit.noteKey) {
        expect(view.getByText(credit.noteKey)).toBeTruthy();
      }
    }
    expect(view.getAllByText(/credits_authors/).length).toBe(THIRD_PARTY_CREDITS.length);
  });

  it('opens the license, repository, project and author links', async () => {
    const view = await render(<CreditsScreen />);

    await fireEvent.press(view.getByText(`${KERES_LICENSE.name} (${KERES_LICENSE.shortName})`));
    expect(Linking.openURL).toHaveBeenCalledWith(KERES_LICENSE.url);

    await fireEvent.press(view.getByText('credits_repository'));
    expect(Linking.openURL).toHaveBeenCalledWith(KERES_REPOSITORY_URL);

    const [first] = THIRD_PARTY_CREDITS;
    await fireEvent.press(view.getByText(first.project));
    expect(Linking.openURL).toHaveBeenCalledWith(first.projectUrl);
    await fireEvent.press(view.getByText(first.license));
    expect(Linking.openURL).toHaveBeenCalledWith(first.licenseUrl);
    await fireEvent.press(view.getByText(first.authors[0].name));
    expect(Linking.openURL).toHaveBeenCalledWith(first.authors[0].url);
  });
});
