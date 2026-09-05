/** @jest-environment node */
import { act, renderHook } from '@testing-library/react-native';
import { useAsyncOperation } from '../../src/hooks/useAsyncOperation';

it('ignores duplicate submissions, reports pending and allows another operation after failure', async () => {
  const hook = await renderHook(() => useAsyncOperation());
  let reject!: (reason: Error) => void;
  const command = jest.fn(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  let first!: Promise<void>;
  await act(async () => {
    first = hook.result.current.run(command);
    void first.catch(() => {});
    await hook.result.current.run(command);
  });
  expect(command).toHaveBeenCalledTimes(1);
  expect(hook.result.current.pending).toBe(true);
  await act(async () => {
    reject(new Error('save failed'));
    await expect(first).rejects.toThrow('save failed');
  });
  expect(hook.result.current.pending).toBe(false);
  const retry = jest.fn(async () => {});
  await act(async () => {
    await hook.result.current.run(retry);
  });
  expect(retry).toHaveBeenCalledTimes(1);
});
