import { act, cleanup, renderHook } from '@testing-library/react-native';
import { useArcSearchScope } from '../../src/hooks/useArcSearchScope';

type Row = { id: string; arc: 'a' | 'b' };
const rows: Row[] = [
  { id: '1', arc: 'a' },
  { id: '2', arc: 'b' },
  { id: '3', arc: 'b' },
];
const inArcA = (row: Row) => row.arc === 'a';

afterEach(async () => {
  await act(async () => cleanup());
});

describe('useArcSearchScope', () => {
  it('is exactly the arc while nothing is searched, hiding nothing it has to count', async () => {
    const { result } = await renderHook(() => useArcSearchScope(rows, inArcA, ''));

    expect(result.current.data.map((row) => row.id)).toEqual(['1']);
    expect(result.current.outsideCount).toBe(0);
    expect(result.current.expanded).toBe(false);
  });

  it('counts what a search found in other arcs instead of hiding it silently', async () => {
    const { result } = await renderHook(() => useArcSearchScope(rows, inArcA, 'moon'));

    expect(result.current.data.map((row) => row.id)).toEqual(['1']);
    expect(result.current.outsideCount).toBe(2);
  });

  it('shows the others on one tap, and goes back on the next', async () => {
    const { result } = await renderHook(() => useArcSearchScope(rows, inArcA, 'moon'));

    await act(async () => result.current.toggle());
    expect(result.current.expanded).toBe(true);
    expect(result.current.data.map((row) => row.id)).toEqual(['1', '2', '3']);

    await act(async () => result.current.toggle());
    expect(result.current.expanded).toBe(false);
    expect(result.current.data.map((row) => row.id)).toEqual(['1']);
  });

  it('puts the arc back for another search, and for none', async () => {
    const { result, rerender } = await renderHook(
      ({ term }: { term: string }) => useArcSearchScope(rows, inArcA, term),
      { initialProps: { term: 'moon' } },
    );
    await act(async () => result.current.toggle());
    expect(result.current.expanded).toBe(true);

    await rerender({ term: 'sun' });
    expect(result.current.expanded).toBe(false);

    await rerender({ term: 'moon' });
    expect(result.current.expanded).toBe(true);

    await rerender({ term: '  ' });
    expect(result.current.expanded).toBe(false);
    expect(result.current.data.map((row) => row.id)).toEqual(['1']);
  });

  it('has nothing to expand when the search found nothing outside the arc', async () => {
    const onlyA = rows.filter(inArcA);
    const { result } = await renderHook(() => useArcSearchScope(onlyA, inArcA, 'moon'));

    expect(result.current.outsideCount).toBe(0);
    await act(async () => result.current.toggle());
    expect(result.current.expanded).toBe(false);
  });
});
