/** @jest-environment node */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('react-i18next', () => {
  const t = (key: string) => `translated:${key}`;
  return { __esModule: true, useTranslation: () => ({ t }) };
});

import { renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useCommentFieldLabel } from '../../src/hooks/useCommentFieldLabel';

const db = { query: { storySchemaFields: { findFirst: jest.fn() } } };

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue(db);
  db.query.storySchemaFields.findFirst.mockResolvedValue(undefined);
});

it('uses translated metadata for native entity fields without querying schema fields', async () => {
  const { result } = await renderHook(() => useCommentFieldLabel('Character', 'name', null));

  expect(result.current).toBe('translated:field_name');
  expect(db.query.storySchemaFields.findFirst).not.toHaveBeenCalled();
});

it('replaces a custom field id with the name defined in the story schema', async () => {
  db.query.storySchemaFields.findFirst.mockResolvedValue({ name: 'Poder mágico' });
  const { result } = await renderHook(() => useCommentFieldLabel('Character', null, 'field-1'));

  await waitFor(() => expect(result.current).toBe('Poder mágico'));
});

it('keeps a useful raw fallback when metadata or custom-field lookup is unavailable', async () => {
  db.query.storySchemaFields.findFirst.mockRejectedValueOnce(new Error('offline'));
  const custom = await renderHook(() => useCommentFieldLabel('Character', null, 'field-1'));
  await waitFor(() => expect(custom.result.current).toBe('field-1'));

  const native = await renderHook(() => useCommentFieldLabel('Unknown', 'legacyField', null));
  expect(native.result.current).toBe('legacyField');
});
