import { useCallback, useMemo, useState } from 'react';

type FieldValues = Record<string, unknown>;

type SetField<V> = (value: V | ((previous: V) => V)) => void;

/** `{ name, title }` -> `{ setName, setTitle }`: the setter each field has always had. */
export type FieldSetters<F extends FieldValues> = {
  [K in keyof F & string as `set${Capitalize<K>}`]: SetField<F[K]>;
};

const setterName = (key: string) => `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/**
 * The plain fields of an entity form, held as one record instead of one `useState` per field.
 * The names stay what they were: `fields.name` is read as `name`, and `setName` still sets it, so a
 * form lists its fields once (the pristine record) instead of once per place that touches them -
 * hydration, draft snapshot, draft restore, dirty check and reset all take the record whole.
 *
 * `pristine` must be a module constant: its keys fix which setters exist.
 */
export function useFormFields<F extends FieldValues>(pristine: F) {
  const [fields, setFields] = useState<F>(pristine);

  const setters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(pristine).map((key) => [
          setterName(key),
          (value: unknown) =>
            setFields((previous) => ({
              ...previous,
              [key]: typeof value === 'function' ? value(previous[key]) : value,
            })),
        ]),
      ) as FieldSetters<F>,
    [pristine],
  );

  /** Replaces every field at once. */
  const setAll = useCallback((next: F) => setFields(next), []);

  return { fields, setters, setAll };
}

/** The `keys` of `source`, as a record of just them (a loaded row down to the form's own fields). */
export function pickFields<K extends string, S extends Record<K, unknown>>(
  source: S,
  keys: readonly K[],
): Pick<S, K> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Pick<S, K>;
}

/** Whether any field of `current` is not what `pristine` has, whatever order the keys are in. */
export function fieldsDiffer<F extends FieldValues>(current: F, pristine: F): boolean {
  return Object.keys(pristine).some((key) => !Object.is(current[key], pristine[key]));
}
