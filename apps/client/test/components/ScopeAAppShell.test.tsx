/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import DocumentTitleSync from '../../src/components/features/app/DocumentTitleSync';
import WebScrollbarTheme from '../../src/components/features/app/WebScrollbarTheme';
import { setDocumentTitle } from '../../src/utils/documentTitle';

jest.mock('../../src/utils/documentTitle', () => ({ setDocumentTitle: jest.fn() }));

const mockColors = {
  primary: '#0000ff',
  primaryContainer: '#aaaaff',
  primaryVariant: '#000088',
  secondary: '#00ff00',
  surface: '#ffffff',
};

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: mockColors }),
}));

const setTitleMock = setDocumentTitle as jest.Mock;
const STYLE_ID = 'keres-web-scrollbar-theme';

describe('DocumentTitleSync', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets the initial document title once and renders nothing', async () => {
    const view = await render(<DocumentTitleSync />);

    expect(setTitleMock).toHaveBeenCalledTimes(1);
    expect(setTitleMock).toHaveBeenCalledWith('');
    expect(view.toJSON()).toBeNull();
  });
});

describe('WebScrollbarTheme', () => {
  const realOS = Platform.OS;

  const setOS = (os: string) => {
    (Platform as { OS: string }).OS = os;
  };

  beforeEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  afterEach(() => {
    setOS(realOS);
    document.getElementById(STYLE_ID)?.remove();
  });

  it('renders nothing itself', async () => {
    setOS('ios');
    const view = await render(<WebScrollbarTheme />);

    expect(view.toJSON()).toBeNull();
  });

  it('does nothing off web', async () => {
    setOS('ios');
    await render(<WebScrollbarTheme />);

    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it('writes the active theme into a style element on web', async () => {
    setOS('web');
    await render(<WebScrollbarTheme />);

    const style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain(mockColors.primaryContainer);
    expect(style?.textContent).toContain(mockColors.primary);
    expect(style?.textContent).toContain(mockColors.surface);
  });

  it('reuses the same style element on later renders', async () => {
    setOS('web');
    const view = await render(<WebScrollbarTheme />);
    const first = document.getElementById(STYLE_ID);

    await view.rerender(<WebScrollbarTheme />);

    expect(document.getElementById(STYLE_ID)).toBe(first);
    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
  });
});
