jest.mock('expo-asset', () => ({ Asset: { loadAsync: jest.fn() } }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }));

type Matrices = { regular: Uint8Array; italic: Uint8Array } | null;

async function freshMatrices(behavior: {
  asset?: { localUri?: string } | Error;
  fileBytes?: Uint8Array | Error;
  legacyBase64?: string;
  legacyError?: Error;
}): Promise<() => Promise<Matrices>> {
  jest.resetModules();
  const { Asset } = await import('expo-asset');
  const { File } = await import('expo-file-system');
  const legacy = await import('expo-file-system/legacy');
  const loadAsync = Asset.loadAsync as jest.Mock;
  const fileCtor = File as unknown as jest.Mock;
  const readBase64 = legacy.readAsStringAsync as jest.Mock;

  if (behavior.asset instanceof Error) loadAsync.mockRejectedValue(behavior.asset);
  else
    loadAsync.mockResolvedValue([
      { localUri: behavior.asset?.localUri ?? 'file:///fonts/serif.ttf' },
    ]);
  if (behavior.fileBytes instanceof Error) {
    fileCtor.mockImplementation(() => ({
      bytes: async () => {
        throw behavior.fileBytes;
      },
    }));
  } else {
    fileCtor.mockImplementation(() => ({
      bytes: async () => behavior.fileBytes ?? new Uint8Array([1, 2, 3]),
    }));
  }
  if (behavior.legacyError) readBase64.mockRejectedValue(behavior.legacyError);
  else readBase64.mockResolvedValue(behavior.legacyBase64 ?? '');
  const { pdfFontMatrices } = await import(
    '../../../src/components/features/manuscript/export/pdfFontAssets'
  );
  return pdfFontMatrices as () => Promise<Matrices>;
}

describe('pdfFontMatrices', () => {
  it('loads both faces once and caches them for the session', async () => {
    const pdfFontMatrices = await freshMatrices({});
    const { Asset } = await import('expo-asset');
    const loadAsync = Asset.loadAsync as jest.Mock;

    const first = await pdfFontMatrices();
    const second = await pdfFontMatrices();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(first?.regular).toEqual(new Uint8Array([1, 2, 3]));
    expect(first?.italic).toEqual(new Uint8Array([1, 2, 3]));
    expect(loadAsync).toHaveBeenCalledTimes(2);
  });

  it('reads through the legacy base64 path when the File API throws', async () => {
    const pdfFontMatrices = await freshMatrices({
      fileBytes: new Error('no File API'),
      legacyBase64: 'AQI=',
    });
    const legacy = await import('expo-file-system/legacy');

    const matrices = await pdfFontMatrices();

    expect(matrices?.regular).toEqual(new Uint8Array([1, 2]));
    expect(legacy.readAsStringAsync as jest.Mock).toHaveBeenCalled();
  });

  it('falls back to null when the asset cannot load', async () => {
    const pdfFontMatrices = await freshMatrices({ asset: new Error('offline') });

    await expect(pdfFontMatrices()).resolves.toBeNull();
  });

  it('fetches the asset when both filesystem APIs are stubs, as on web', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const pdfFontMatrices = await freshMatrices({
      asset: { localUri: 'https://example.com/serif.ttf' },
      fileBytes: new Error('no File API'),
      legacyError: new Error('no legacy API'),
    });

    const matrices = await pdfFontMatrices();

    expect(matrices?.regular).toEqual(new Uint8Array([4, 5, 6]));
    expect(matrices?.italic).toEqual(new Uint8Array([4, 5, 6]));
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/serif.ttf');
  });

  it('falls back to null when fetch fails too', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    global.fetch = fetchMock as unknown as typeof fetch;
    const pdfFontMatrices = await freshMatrices({
      fileBytes: new Error('no File API'),
      legacyError: new Error('no legacy API'),
    });

    await expect(pdfFontMatrices()).resolves.toBeNull();
  });
});
