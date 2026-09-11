const mockBuildSvg = jest.fn();
const mockDeliverSvg = jest.fn();

jest.mock('../../src/utils/storyMapSvgExport', () => ({
  __esModule: true,
  buildStandaloneLocationMapSvg: (...args: unknown[]) => mockBuildSvg(...args),
}));
jest.mock('../../src/utils/storyTransfer', () => ({
  __esModule: true,
  buildLocationMapFileName: jest.fn((name: string) => `${name}.svg`),
  deliverSvgMap: (...args: unknown[]) => mockDeliverSvg(...args),
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
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBuildSvg.mockResolvedValue('<svg />');
  mockDeliverSvg.mockResolvedValue({ delivered: true, fileName: 'Atlas.svg' });
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
      }),
    );
    await act(async () => view.result.current());
    expect(mockBuildSvg).toHaveBeenCalledWith(
      content,
      {},
      expect.objectContaining({ title: 'Atlas', nodeNames: { a: 'Alpha' } }),
    );
    expect(mockDeliverSvg).toHaveBeenCalledWith('<svg />', 'Atlas.svg');
    expect(showNotification).toHaveBeenCalledWith('location_map_export_success', 'success');
    expect(setExporting).toHaveBeenNthCalledWith(1, true);
    expect(setExporting).toHaveBeenLastCalledWith(false);
  });

  it('reports unavailable shares and export failures, and safely ignores absent maps', async () => {
    const setExporting = jest.fn();
    const showNotification = jest.fn();
    const t = (key: string) => key;
    mockDeliverSvg.mockResolvedValueOnce({
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
      }),
    );
    await act(async () => withoutMap.result.current());
    expect(setExporting).toHaveBeenCalledTimes(4);
  });
});
