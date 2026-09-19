import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StatSelect } from '../../../src/db/schema';
import { useStatFormState } from '../../../src/screens/stats/useStatFormState';

const stats = [
  { id: 'stat-1', name: 'Strength', isPrimary: false },
  { id: 'stat-2', name: 'Wit', isPrimary: true },
] as StatSelect[];

it('starts a creation form as a primary stat', async () => {
  const view = await renderHook(() => useStatFormState({ stats }));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.loading).toBe(false);
  expect(view.result.current.name).toBe('');
  expect(view.result.current.isPrimary).toBe(true);
});

it('hydrates the stat being edited', async () => {
  const view = await renderHook(() => useStatFormState({ statId: 'stat-1', stats }));

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(true);
  expect(view.result.current.name).toBe('Strength');
  expect(view.result.current.isPrimary).toBe(false);
});

it('hydrates once the stats list arrives', async () => {
  const view = await renderHook(
    ({ rows }: { rows: StatSelect[] }) => useStatFormState({ statId: 'stat-2', stats: rows }),
    {
      initialProps: { rows: [] as StatSelect[] },
    },
  );

  expect(view.result.current.loading).toBe(true);

  view.rerender({ rows: stats });
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.name).toBe('Wit');
  expect(view.result.current.isPrimary).toBe(true);
});

it('keeps waiting while the edited stat is absent from the list', async () => {
  const view = await renderHook(() => useStatFormState({ statId: 'missing', stats }));

  await act(async () => {});

  expect(view.result.current.name).toBe('');
  expect(view.result.current.loading).toBe(true);
});
