/** @jest-environment node */
import { act, renderHook } from '@testing-library/react-native';
import { fieldsDiffer, pickFields, useFormFields } from '@/src/hooks/forms/useFormFields';

const PRISTINE = { name: '', title: null as string | null, isFavorite: false };

describe('useFormFields', () => {
  it('starts at the pristine record', async () => {
    const view = await renderHook(() => useFormFields(PRISTINE));

    expect(view.result.current.fields).toEqual(PRISTINE);
  });

  it('has a setter named after each field that changes only that field', async () => {
    const view = await renderHook(() => useFormFields(PRISTINE));

    await act(async () => view.result.current.setters.setName('Aria'));
    await act(async () => view.result.current.setters.setIsFavorite(true));

    expect(view.result.current.fields).toEqual({ name: 'Aria', title: null, isFavorite: true });
  });

  it('accepts an updater like a state setter does', async () => {
    const view = await renderHook(() => useFormFields(PRISTINE));

    await act(async () => view.result.current.setters.setName('Ar'));
    await act(async () => view.result.current.setters.setName((previous) => `${previous}ia`));

    expect(view.result.current.fields.name).toBe('Aria');
  });

  it('keeps the setters, and setAll, the same between renders', async () => {
    const view = await renderHook(() => useFormFields(PRISTINE));
    const { setters, setAll } = view.result.current;

    await act(async () => setters.setTitle('Ranger'));
    await view.rerender({});

    expect(view.result.current.setters).toBe(setters);
    expect(view.result.current.setAll).toBe(setAll);
  });

  it('applies several setters in one render', async () => {
    let renders = 0;
    const view = await renderHook(() => {
      renders += 1;
      return useFormFields(PRISTINE);
    });
    const before = renders;

    await act(async () => {
      view.result.current.setters.setName('Aria');
      view.result.current.setters.setTitle('Ranger');
    });

    expect(view.result.current.fields).toMatchObject({ name: 'Aria', title: 'Ranger' });
    expect(renders - before).toBe(1);
  });

  it('replaces every field at once', async () => {
    const view = await renderHook(() => useFormFields(PRISTINE));

    await act(async () =>
      view.result.current.setAll({ name: 'Zed', title: 'Mage', isFavorite: true }),
    );

    expect(view.result.current.fields).toEqual({ name: 'Zed', title: 'Mage', isFavorite: true });
  });
});

describe('pickFields', () => {
  it('keeps just the named keys of a row', () => {
    const row = { id: 'c1', name: 'Aria', title: null, updatedAt: 3 };

    expect(pickFields(row, ['name', 'title'])).toEqual({ name: 'Aria', title: null });
  });
});

describe('fieldsDiffer', () => {
  it('is false for the same values whatever the key order', () => {
    expect(
      fieldsDiffer({ isFavorite: false, name: 'a', title: null }, { ...PRISTINE, name: 'a' }),
    ).toBe(false);
  });

  it('is true when one field is not what it was, null included', () => {
    expect(fieldsDiffer({ ...PRISTINE, title: 'Ranger' }, PRISTINE)).toBe(true);
    expect(fieldsDiffer({ ...PRISTINE, name: '', title: null }, PRISTINE)).toBe(false);
    expect(fieldsDiffer({ ...PRISTINE, title: '' }, PRISTINE)).toBe(true);
  });
});
