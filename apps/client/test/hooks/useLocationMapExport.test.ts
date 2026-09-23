const mockBuildSvg = jest.fn();
const mockDeliver = jest.fn();
const mockBuildFileName = jest.fn((...args: unknown[]) => `${args[0] as string}.svg`);

jest.mock('../../src/utils/storyMapSvgExport', () => ({
  __esModule: true,
  buildStandaloneLocationMapSvg: (...args: unknown[]) => mockBuildSvg(...args),
}));
jest.mock('../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildLocationMapFileName: (...args: unknown[]) => mockBuildFileName(...args),
  deliverMapExport: (...args: unknown[]) => mockDeliver(...args),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useLocationMapExport } from '../../src/hooks/useLocationMapExport';

const content = { nodes: [{ locationId: 'a' }], images: [] } as never;
const colors = {
  background: '#000',
  surface: '#111',
  text: '#fff',
  textSecondary: '#ccc',
  border: '#333',
  primary: '#85f',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBuildSvg.mockResolvedValue('<svg />');
  mockDeliver.mockResolvedValue({ delivered: true, fileName: 'Atlas.svg' });
});

describe('useLocationMapExport', () => {
  it('builds and delivers a map then reports successful delivery', async () => {
    const setExporting = jest.fn();
    const showNotification = jest.fn();
    const t = jest.fn((key: string) => key);
    const view = await renderHook(() =>
      useLocationMapExport({
        map: { name: 'Atlas' } as never,
        content,
        galleryMediaById: {},
        nodeNames: { a: 'Alpha' },
        connections: [],
        contains: [],
        colors,
        t: t as never,
        showNotification,
        setExporting,
        language: 'pt',
      }),
    );
    await act(async () => view.result.current());
    expect(mockBuildFileName).toHaveBeenCalledWith('Atlas', expect.any(Date), 'pt');
    expect(mockBuildSvg).toHaveBeenCalledWith(
      content,
      {},
      expect.objectContaining({ title: 'Atlas', nodeNames: { a: 'Alpha' } }),
    );
    expect(mockDeliver).toHaveBeenCalledWith('<svg />', 'Atlas.svg', 'svg');
    expect(showNotification).toHaveBeenCalledWith('location_map_export_success', 'success');
    expect(setExporting).toHaveBeenNthCalledWith(1, true);
    expect(setExporting).toHaveBeenLastCalledWith(false);
  });

  it('reports unavailable shares and export failures, and safely ignores absent maps', async () => {
    const setExporting = jest.fn();
    const showNotification = jest.fn();
    const t = (key: string) => key;
    mockDeliver.mockResolvedValueOnce({
      delivered: false,
      fileName: 'Atlas.svg',
      uri: '/tmp/Atlas.svg',
    });
    const view = await renderHook(() =>
      useLocationMapExport({
        map: { name: 'Atlas' } as never,
        content,
        galleryMediaById: {},
        nodeNames: {},
        connections: [],
        contains: [],
        colors,
        t: t as never,
        showNotification,
        setExporting,
        language: 'en',
      }),
    );
    await act(async () => view.result.current());
    expect(showNotification).toHaveBeenCalledWith('location_map_export_no_share_target', 'warning');

    mockBuildSvg.mockRejectedValueOnce(new Error('offline'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await act(async () => view.result.current());
    expect(showNotification).toHaveBeenCalledWith('location_map_export_failed', 'error');

    const withoutMap = await renderHook(() =>
      useLocationMapExport({
        map: null,
        content,
        galleryMediaById: {},
        nodeNames: {},
        connections: [],
        contains: [],
        colors,
        t: t as never,
        showNotification,
        setExporting,
        language: 'en',
      }),
    );
    await act(async () => withoutMap.result.current());
    expect(setExporting).toHaveBeenCalledTimes(4);
  });
});
