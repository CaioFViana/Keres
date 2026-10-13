import { act, fireEvent, render, screen } from '@testing-library/react-native';
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

// The real minimum: the setup file zeroes it for every other suite.
jest.mock('../../src/legal/readingGate', () => ({ __esModule: true, MIN_READ_SECONDS: 12 }));
const MIN_READ_SECONDS = 12;

describe('TermsModal scroll gate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps accept disabled with long content until the person scrolls to the end', async () => {
    const onAccept = jest.fn();
    await renderAccept({ onAccept });
    await measure(VIEWPORT, LONG_CONTENT);
    await act(async () => {
      jest.advanceTimersByTime(MIN_READ_SECONDS * 1000);
    });

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

  it('counts a text that fits the window as seen, once the time is up', async () => {
    await renderAccept();
    await measure(VIEWPORT, SHORT_CONTENT);
    await act(async () => {
      jest.advanceTimersByTime(MIN_READ_SECONDS * 1000);
    });

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

describe('TermsModal minimum reading time', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const pass = async (seconds: number) => {
    await act(async () => {
      jest.advanceTimersByTime(seconds * 1000);
    });
  };

  it('keeps accept shut for a text that fits the window until it has stayed open long enough', async () => {
    await renderAccept();
    await measure(VIEWPORT, SHORT_CONTENT);

    // Nothing to scroll, but it was not looked at yet.
    expect(isAcceptDisabled()).toBe(true);
    expect(screen.getByText('terms_read_wait')).toBeTruthy();

    await pass(MIN_READ_SECONDS - 1);
    expect(isAcceptDisabled()).toBe(true);

    await pass(1);
    expect(isAcceptDisabled()).toBe(false);
    expect(screen.queryByText('terms_read_wait')).toBeNull();
  });

  it('needs both: time without reaching the end, and the end without the time, are not enough', async () => {
    await renderAccept();
    await measure(VIEWPORT, LONG_CONTENT);

    await pass(MIN_READ_SECONDS + 5);
    expect(isAcceptDisabled()).toBe(true);
    expect(screen.getByText('terms_scroll_to_accept')).toBeTruthy();

    await scrollTo(LONG_CONTENT - VIEWPORT, LONG_CONTENT);
    expect(isAcceptDisabled()).toBe(false);
  });

  it('does not let a flick to the end open it before the time', async () => {
    await renderAccept();
    await measure(VIEWPORT, LONG_CONTENT);

    await scrollTo(LONG_CONTENT - VIEWPORT, LONG_CONTENT);
    expect(isAcceptDisabled()).toBe(true);

    await pass(MIN_READ_SECONDS);
    expect(isAcceptDisabled()).toBe(false);
  });

  it('counts only while the text is on screen, and goes on from there when it is opened again', async () => {
    const element = (visible: boolean) => (
      <TermsModal
        visible={visible}
        title="Terms"
        sections={SECTIONS}
        mode="accept"
        requireScrollToEnd
        onAccept={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const view = await render(element(true));
    await measure(VIEWPORT, SHORT_CONTENT);
    await pass(5);

    await view.rerender(element(false));
    await pass(MIN_READ_SECONDS * 10);
    await view.rerender(element(true));
    await measure(VIEWPORT, SHORT_CONTENT);

    // 5 s counted before, none while it was closed: 7 s are still missing.
    expect(isAcceptDisabled()).toBe(true);
    await pass(MIN_READ_SECONDS - 5 - 1);
    expect(isAcceptDisabled()).toBe(true);
    await pass(1);
    expect(isAcceptDisabled()).toBe(false);
  });
});
