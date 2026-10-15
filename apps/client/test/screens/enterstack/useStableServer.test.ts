import { renderHook } from '@testing-library/react-native';
import { useStableServer } from '@/src/screens/enterstack/useStableServer';

const base = { id: 'srv-1', url: 'https://a.example', idUser: 'me', name: 'Main' } as never;

describe('useStableServer', () => {
  it('keeps the same object while a re-read hands out new ones with the same content', async () => {
    const first = { ...(base as object) } as never;
    const { result, rerender } = await renderHook(
      ({ server }: { server: never }) => useStableServer(server),
      { initialProps: { server: first } },
    );
    expect(result.current).toBe(first);

    await rerender({ server: { ...(base as object), name: 'Renamed' } as never });
    await rerender({ server: { ...(base as object), name: 'Renamed again' } as never });

    expect(result.current).toBe(first);
  });

  it('moves to the new object when the server, its address or its account changes', async () => {
    const first = { ...(base as object) } as never;
    const { result, rerender } = await renderHook(
      ({ server }: { server: never }) => useStableServer(server),
      { initialProps: { server: first } },
    );

    const otherAddress = { ...(base as object), url: 'https://b.example' } as never;
    await rerender({ server: otherAddress });
    expect(result.current).toBe(otherAddress);

    const otherAccount = {
      ...(base as object),
      url: 'https://b.example',
      idUser: 'someone',
    } as never;
    await rerender({ server: otherAccount });
    expect(result.current).toBe(otherAccount);

    const otherServer = {
      ...(base as object),
      id: 'srv-2',
      url: 'https://b.example',
      idUser: 'someone',
    } as never;
    await rerender({ server: otherServer });
    expect(result.current).toBe(otherServer);
  });

  it('follows the server going away and coming back', async () => {
    const first = { ...(base as object) } as never;
    const { result, rerender } = await renderHook(
      ({ server }: { server: never | undefined }) => useStableServer(server),
      { initialProps: { server: first as never | undefined } },
    );

    await rerender({ server: undefined });
    expect(result.current).toBeUndefined();

    const back = { ...(base as object) } as never;
    await rerender({ server: back });
    expect(result.current).toBe(back);
  });
});
