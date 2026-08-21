import { debounce } from '../../src/utils/debounce';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('debounce', () => {
  it('does not call through before the wait elapses', () => {
    const spy = jest.fn();
    debounce(spy, 300)();

    jest.advanceTimersByTime(299);

    expect(spy).not.toHaveBeenCalled();
  });

  it('calls through once the wait elapses', () => {
    const spy = jest.fn();
    debounce(spy, 300)();

    jest.advanceTimersByTime(300);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst of calls into a single trailing call', () => {
    const spy = jest.fn();
    const debounced = debounce(spy, 300);

    debounced('a');
    jest.advanceTimersByTime(100);
    debounced('b');
    jest.advanceTimersByTime(100);
    debounced('c');
    jest.advanceTimersByTime(300);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('c');
  });

  it('forwards every argument of the last call', () => {
    const spy = jest.fn();
    debounce(spy, 300)('story-1', { force: true });

    jest.advanceTimersByTime(300);

    expect(spy).toHaveBeenCalledWith('story-1', { force: true });
  });

  it('defaults to a one second wait', () => {
    const spy = jest.fn();
    debounce(spy)();

    jest.advanceTimersByTime(999);
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('drops the pending call when cancelled', () => {
    const spy = jest.fn();
    const debounced = debounce(spy, 300);

    debounced();
    debounced.cancel!();
    jest.advanceTimersByTime(1000);

    expect(spy).not.toHaveBeenCalled();
  });

  it('is safe to cancel when nothing is pending', () => {
    const debounced = debounce(jest.fn(), 300);

    expect(() => debounced.cancel!()).not.toThrow();
  });

  it('still works after a cancel', () => {
    const spy = jest.fn();
    const debounced = debounce(spy, 300);

    debounced();
    debounced.cancel!();
    debounced('depois');
    jest.advanceTimersByTime(300);

    expect(spy).toHaveBeenCalledWith('depois');
  });

  it('fires again for a call made after the previous one landed', () => {
    const spy = jest.fn();
    const debounced = debounce(spy, 300);

    debounced();
    jest.advanceTimersByTime(300);
    debounced();
    jest.advanceTimersByTime(300);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
