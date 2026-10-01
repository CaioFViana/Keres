import { renderHook } from '@testing-library/react-native';
import { useWelcomePager } from '../../src/components/features/welcome/WelcomePager';

// What the UI thread would call: captured so the tests can play a scroll by hand.
type ScrollHandlers = {
  onScroll: (event: { contentOffset: { x: number } }) => void;
  onBeginDrag: () => void;
};
const mockHandlers: { current: ScrollHandlers | null } = { current: null };
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useAnimatedScrollHandler: (handlers: ScrollHandlers) => {
    mockHandlers.current = handlers;
    return jest.fn();
  },
}));
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets/src/mock'),
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

const WIDTH = 500;
const scrollTo = jest.fn();

const setup = async (initialPage = 0) => {
  const onPageChange = jest.fn();
  const view = await renderHook(
    ({ page }: { page: number }) => useWelcomePager({ page, pageWidth: WIDTH, onPageChange }),
    { initialProps: { page: initialPage } },
  );
  (view.result.current[1] as { current: unknown }).current = { scrollTo };
  scrollTo.mockClear();
  return { view, onPageChange };
};
const scrollBy = (x: number) => mockHandlers.current!.onScroll({ contentOffset: { x } });

describe('useWelcomePager', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports the page as soon as a swipe passes the middle, without waiting for it to come to rest', async () => {
    const { onPageChange } = await setup();

    scrollBy(120);
    expect(onPageChange).not.toHaveBeenCalled();
    scrollBy(260);
    expect(onPageChange).toHaveBeenCalledWith(1);
    scrollBy(300);
    scrollBy(420);
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  it('follows a swipe back too', async () => {
    const { onPageChange } = await setup(2);
    scrollBy(480);

    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('does not scroll to a page the scroll itself just reported', async () => {
    const { view, onPageChange } = await setup();
    scrollBy(300);
    expect(onPageChange).toHaveBeenCalledWith(1);

    await view.rerender({ page: 1 });

    expect(scrollTo).not.toHaveBeenCalledWith({ x: WIDTH, animated: true });
  });

  it('scrolls to a page that a button asked for', async () => {
    const { view } = await setup();

    await view.rerender({ page: 2 });

    expect(scrollTo).toHaveBeenCalledWith({ x: 2 * WIDTH, animated: true });
  });

  it('keeps the pages in between from turning a request for the third into the second', async () => {
    const { view, onPageChange } = await setup();
    await view.rerender({ page: 2 });

    scrollBy(300);
    scrollBy(600);
    scrollBy(999);
    expect(onPageChange).not.toHaveBeenCalled();
    scrollBy(1000);

    // Arrived: the next movement is the person's, and counts.
    scrollBy(480);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('gives the pager back to a hand laid on it, in the middle of a scroll the code started', async () => {
    const { view, onPageChange } = await setup();
    await view.rerender({ page: 2 });
    scrollBy(300);
    expect(onPageChange).not.toHaveBeenCalled();

    mockHandlers.current!.onBeginDrag();
    scrollBy(200);

    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it('stays on the page being read when the window changes width', async () => {
    const onPageChange = jest.fn();
    const view = await renderHook(
      ({ pageWidth }: { pageWidth: number }) =>
        useWelcomePager({ page: 1, pageWidth, onPageChange }),
      { initialProps: { pageWidth: 500 } },
    );
    (view.result.current[1] as { current: unknown }).current = { scrollTo };
    scrollTo.mockClear();

    await view.rerender({ pageWidth: 640 });

    expect(scrollTo).toHaveBeenCalledWith({ x: 640, animated: false });
  });
});
