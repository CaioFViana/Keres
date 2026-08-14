/** @jest-environment node */
jest.mock('../../src/state/galleryMediaViewerStore', () => ({
  __esModule: true,
  useGalleryMediaViewerStore: jest.fn(),
}));

import { renderHook } from '@testing-library/react-native';
import { useOpenGalleryMediaViewer } from '../../src/hooks/useOpenGalleryMediaViewer';
import { useGalleryMediaViewerStore } from '../../src/state/galleryMediaViewerStore';

const open = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useGalleryMediaViewerStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ open }),
  );
});

it('opens the overlay state for the requested gallery without navigating away', async () => {
  const { result } = await renderHook(() => useOpenGalleryMediaViewer());

  result.current('gallery-1');

  expect(open).toHaveBeenCalledWith('gallery-1');
});

it('keeps the callback identity while the store open action is unchanged', async () => {
  const { result, rerender } = await renderHook(() => useOpenGalleryMediaViewer());
  const first = result.current;
  await rerender(undefined as never);

  expect(result.current).toBe(first);
});
