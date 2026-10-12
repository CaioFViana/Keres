import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import TermsModal from '../../src/components/features/servers/TermsModal/TermsModal';

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../src/theme', () => {
  const actual = jest.requireActual('../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        background: '#ffffff',
        surface: '#f5f5f5',
        border: '#cccccc',
        text: '#111111',
        textSecondary: '#555555',
        primary: '#0000ff',
        onPrimary: '#ffffff',
        error: '#ff0000',
        shadow: '#000000',
      },
    }),
  };
});

const SECTIONS = [{ heading: 'Scope', paragraphs: ['A paragraph of terms.'] }];
const VIEWPORT = 300;
const LONG_CONTENT = 1200;
const SHORT_CONTENT = 200;

const renderAccept = (overrides: Partial<React.ComponentProps<typeof TermsModal>> = {}) =>
  render(
    <TermsModal
      visible
      title="Terms"
      sections={SECTIONS}
      mode="accept"
      requireScrollToEnd
      onAccept={jest.fn()}
      onClose={jest.fn()}
      {...overrides}
    />,
  );

/** The scroll view reports its visible window (layout) and then the full content height. */
const measure = async (layoutHeight: number, contentHeight: number) => {
  const scroll = screen.getByTestId('terms-modal-scroll');
  await fireEvent(scroll, 'layout', {
    nativeEvent: { layout: { height: layoutHeight, width: 400 } },
  });
  await fireEvent(scroll, 'contentSizeChange', 400, contentHeight);
};

/** Scrolls the view to the given offset, as the native scroll event reports it. */
const scrollTo = async (offsetY: number, contentHeight: number) => {
  await fireEvent.scroll(screen.getByTestId('terms-modal-scroll'), {
    nativeEvent: {
      contentSize: { height: contentHeight, width: 400 },
      layoutMeasurement: { height: VIEWPORT, width: 400 },
      contentOffset: { y: offsetY, x: 0 },
    },
  });
};

/** Whether the accept button is disabled, as the host node reports it. */
const isAcceptDisabled = () =>
  Boolean(screen.getByTestId('terms-modal-accept').props.accessibilityState?.disabled);

describe('TermsModal scroll gate', () => {
  it('keeps accept disabled with long content until the person scrolls to the end', async () => {
    const onAccept = jest.fn();
    await renderAccept({ onAccept });
    await measure(VIEWPORT, LONG_CONTENT);

    expect(isAcceptDisabled()).toBe(true);
    expect(screen.getByText('terms_scroll_to_accept')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('terms-modal-accept'));
    expect(onAccept).not.toHaveBeenCalled();

    // Halfway through the 900 px of scrollable content is not the end.
    await scrollTo(400, LONG_CONTENT);
    expect(isAcceptDisabled()).toBe(true);

    await scrollTo(LONG_CONTENT - VIEWPORT, LONG_CONTENT);
    expect(isAcceptDisabled()).toBe(false);
    expect(screen.queryByText('terms_scroll_to_accept')).toBeNull();
    await fireEvent.press(screen.getByTestId('terms-modal-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('enables accept at once when the content fits the window without scrolling', async () => {
    await renderAccept();
    await measure(VIEWPORT, SHORT_CONTENT);

    expect(isAcceptDisabled()).toBe(false);
    expect(screen.queryByText('terms_scroll_to_accept')).toBeNull();
  });

  it('stays disabled before any layout measure, even when the content reports short', async () => {
    await renderAccept();
    // A content measure alone is not evidence: the window height is still unknown.
    const scroll = screen.getByTestId('terms-modal-scroll');
    await fireEvent(scroll, 'contentSizeChange', 400, SHORT_CONTENT);
    await fireEvent(scroll, 'contentSizeChange', 400, LONG_CONTENT);

    expect(isAcceptDisabled()).toBe(true);
    expect(screen.getByText('terms_scroll_to_accept')).toBeTruthy();
  });

  it('shows no accept button in read mode', async () => {
    await renderAccept({ mode: 'read' });
    await measure(VIEWPORT, SHORT_CONTENT);

    expect(screen.queryByTestId('terms-modal-accept')).toBeNull();
    expect(screen.queryByText('terms_scroll_to_accept')).toBeNull();
    expect(screen.getByText('Scope')).toBeTruthy();
  });
});
