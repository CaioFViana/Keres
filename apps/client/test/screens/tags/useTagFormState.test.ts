// The hook lists `t` in its effect deps, so the mock must return a stable function like
// the real i18n does; a fresh closure per render re-triggers hydration forever.
const mockTranslate = jest.fn((key: string) => key);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useTagFormState } from '../../../src/screens/tags/useTagFormState';
import type { TagService } from '../../../src/services/storymanagement/TagService';

const createTagServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as TagService,
});

const renderState = async (options: {
  tagId?: string;
  tag?: object | null;
  serviceRef?: { current: TagService | null };
}) => {
  const tagServiceRef = options.serviceRef ?? createTagServiceRef();
  if (options.tag !== undefined && tagServiceRef.current) {
    (tagServiceRef.current.getById as jest.Mock).mockResolvedValue(options.tag);
  }
  const view = await renderHook(() => useTagFormState({ tagId: options.tagId, tagServiceRef }));
  return { tagServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('starts a creation form empty and ready', async () => {
  const { tagServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.name).toBe('');
  expect(view.result.current.loadError).toBeNull();
  expect(tagServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates the tag being edited', async () => {
  const { tagServiceRef, view } = await renderState({
    tagId: 'tag-1',
    tag: { name: 'Urgent', color: '#f00', isFavorite: true, extraNotes: 'side' },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(tagServiceRef.current!.getById).toHaveBeenCalledWith('tag-1');
  expect(view.result.current.name).toBe('Urgent');
  expect(view.result.current.color).toBe('#f00');
  expect(view.result.current.isFavorite).toBe(true);
  expect(view.result.current.loadError).toBeNull();
});

it('treats a missing color as an empty draft', async () => {
  const { view } = await renderState({
    tagId: 'tag-1',
    tag: { name: 'Plain', color: null, isFavorite: false, extraNotes: null },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.color).toBe('');
});

it('reports a missing-entity error instead of an empty editing form', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ tagId: 'missing', tag: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.loadError).toBe('tag_data_missing');
  expect(warn).toHaveBeenCalledWith('Tag not found:', 'missing');
  warn.mockRestore();
});

it('reports a missing-entity error when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const tagServiceRef = createTagServiceRef();
  (tagServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() => useTagFormState({ tagId: 'tag-1', tagServiceRef }));

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.loadError).toBe('tag_data_missing');
  expect(error).toHaveBeenCalledWith('Failed to load tag:', expect.any(Error));
  error.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({ tagId: 'tag-1', serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));
});
