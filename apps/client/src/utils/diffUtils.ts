
import { AppDrizzleClient } from '../db';

/**
 * Compares two objects and returns a new object containing only the fields that have changed
 * from the old object to the new object. If a field exists in newObject but not in oldObject,
 * it's considered a new field. If a field exists in oldObject but not in newObject,
 * it's considered deleted (represented as `undefined` in the diff).
 *
 * This function handles primitive values, arrays, and nested objects.
 * For arrays, it performs a shallow comparison. If arrays are different, the new array is returned.
 * For nested objects, it recursively finds changes.
 *
 * @param oldObject The original object.
 * @param newObject The updated object.
 * @returns An object containing only the fields that have changed, or an empty object if no changes.
 */
export function getChangedFields<T extends Record<string, any>>(oldObject: T, newObject: T): Partial<T> {
  const changes: Partial<T> = {};

  if (!oldObject && newObject) {
    return newObject; // If oldObject is null/undefined and newObject exists, all of newObject is a change
  }
  if (oldObject && !newObject) {
    // This case typically means the entire object was deleted, which is handled at a higher level (isDeleted)
    return {};
  }
  if (!oldObject && !newObject) {
    return {};
  }

  const allKeys = Array.from(new Set([...Object.keys(oldObject), ...Object.keys(newObject)]));

  for (const key of allKeys) {
    const oldValue = oldObject[key];
    const newValue = newObject[key];

    // Handle nested objects
    if (typeof oldValue === 'object' && oldValue !== null && typeof newValue === 'object' && newValue !== null && !Array.isArray(oldValue) && !Array.isArray(newValue)) {
      const nestedChanges = getChangedFields(oldValue, newValue);
      if (Object.keys(nestedChanges).length > 0) {
        (changes as Record<string, any>)[key] = nestedChanges;
      }
    }
    // Handle arrays (shallow comparison for now, can be expanded for deep array diff if needed)
    else if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      if (oldValue.length !== newValue.length || !oldValue.every((val, index) => val === newValue[index])) {
        (changes as Record<string, any>)[key] = newValue;
      }
    }
    // Handle dates
    else if (oldValue instanceof Date && newValue instanceof Date) {
      if (oldValue.getTime() !== newValue.getTime()) {
        (changes as Record<string, any>)[key] = newValue;
      }
    }
    // Handle primitives and other types
    else if (oldValue !== newValue) {
      // For fields removed from newObject, set them to undefined to signify deletion/removal
      if (key in oldObject && !(key in newObject)) {
        (changes as Record<string, any>)[key] = undefined;
      } else {
        (changes as Record<string, any>)[key] = newValue;
      }
    }
  }
  return changes;
}

/**
 * Returns a function that compares entity changes. This is primarily for character service testing.
 * The AppDrizzleClient is not directly used in this utility, but is a common import pattern in this project.
 */
export const createDiffUtils = (db: AppDrizzleClient) => {
  return {
    getChangedFields: getChangedFields,
  };
};
