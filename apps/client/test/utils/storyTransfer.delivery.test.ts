/** @jest-environment jsdom */
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { cache: 'cache' },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { localPathFor: jest.fn(), exists: jest.fn(() => false) },
}));
jest.mock('../../src/utils/storyMediaBundle', () => ({
  extractStoryZip: jest.fn(),
  stripUtf8Bom: (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text),
}));

import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { extractStoryZip } from '../../src/utils/storyMediaBundle';
import {
  deliverStoryExport,
  deliverStoryZipExport,
  deliverSvgMap,
  pickStoryExportFile,
  StoryImportError,
} from '../../src/utils/storyTransfer';

const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const FileMock = File as unknown as jest.Mock;
const extractZipMock = extractStoryZip as jest.Mock;
const shareAvailableMock = Sharing.isAvailableAsync as jest.Mock;
const shareMock = Sharing.shareAsync as jest.Mock;

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const REQUIRED_COLLECTIONS = [
  'chapters',
  'scenes',
  'choices',
  'characters',
  'locations',
  'worldRules',
  'notes',
  'noteRelations',
  'tags',
  'tagRelations',
  'suggestions',
  'characterRelations',
  'characterScenes',
  'galleryItems',
  'itemJourneys',
] as const;

function validExport(overrides: Record<string, unknown> = {}) {
  return {
    story: { id: STORY_ID, userId: USER_ID, title: 'A Queda', type: 'linear' },
    ...Object.fromEntries(REQUIRED_COLLECTIONS.map((name) => [name, []])),
    serverLastOperationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'web';
});

describe('story transfer delivery', () => {
  it.each([
    ['JSON', () => deliverStoryExport(validExport() as never, 'a-queda.json'), 'a-queda.json'],
    ['ZIP', () => deliverStoryZipExport(new Uint8Array([1, 2, 3]), 'a-queda.zip'), 'a-queda.zip'],
    ['SVG', () => deliverSvgMap('<svg />', 'a-queda.svg'), 'a-queda.svg'],
  ])('triggers a browser download for a %s export', async (_kind, deliver, fileName) => {
    const anchor = document.createElement('a');
    const click = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElement = jest.spyOn(document, 'createElement').mockReturnValue(anchor);
    const append = jest.spyOn(document.body, 'appendChild');
    const remove = jest.spyOn(document.body, 'removeChild');
    const createObjectURL = jest.fn(() => 'blob:story');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    await expect(deliver()).resolves.toEqual({ delivered: true, fileName });

    expect(anchor.download).toBe(fileName);
    expect(click).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith(anchor);
    expect(remove).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:story');
    createElement.mockRestore();
    append.mockRestore();
    remove.mockRestore();
    click.mockRestore();
  });

  it('writes to the native cache and reports when sharing is unavailable', async () => {
    Platform.OS = 'ios';
    const file = { uri: 'file://cache/a-queda.json', create: jest.fn(), write: jest.fn() };
    FileMock.mockImplementationOnce(() => file);
    shareAvailableMock.mockResolvedValue(false);

    await expect(deliverStoryExport(validExport() as never, 'a-queda.json')).resolves.toEqual({
      delivered: false,
      uri: file.uri,
      fileName: 'a-queda.json',
    });

    expect(file.create).toHaveBeenCalledWith({ overwrite: true, intermediates: true });
    expect(file.write).toHaveBeenCalledWith(expect.stringContaining('"story"'));
    expect(shareMock).not.toHaveBeenCalled();
  });

  it('shares a native file when the platform supports it', async () => {
    Platform.OS = 'android';
    const file = { uri: 'file://cache/a-queda.zip', create: jest.fn(), write: jest.fn() };
    FileMock.mockImplementationOnce(() => file);
    shareAvailableMock.mockResolvedValue(true);

    await expect(deliverStoryZipExport(new Uint8Array([9]), 'a-queda.zip')).resolves.toEqual({
      delivered: true,
      uri: file.uri,
      fileName: 'a-queda.zip',
    });

    expect(shareMock).toHaveBeenCalledWith(file.uri, {
      mimeType: 'application/zip',
      dialogTitle: 'a-queda.zip',
      UTI: 'public.zip-archive',
    });
  });
});

describe('story transfer picker', () => {
  it('treats cancellation as a normal no-op', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true });

    await expect(pickStoryExportFile()).resolves.toBeNull();
  });

  it('reads a JSON package from a browser file, strips its BOM and validates it', async () => {
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          name: 'backup.json',
          file: { text: jest.fn().mockResolvedValue(`\ufeff${JSON.stringify(validExport())}`) },
        },
      ],
    });

    await expect(pickStoryExportFile()).resolves.toMatchObject(
      expect.objectContaining({
        story: expect.objectContaining({ story: expect.objectContaining({ id: STORY_ID }) }),
        media: [],
      }),
    );
    expect(getDocumentAsync).toHaveBeenCalledWith({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it('keeps the import error useful for unreadable and malformed JSON files', async () => {
    getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        { name: 'locked.json', file: { text: jest.fn().mockRejectedValue(new Error('denied')) } },
      ],
    });
    await expect(pickStoryExportFile()).rejects.toMatchObject<Partial<StoryImportError>>({
      reason: 'unreadable',
      message: expect.stringContaining('locked.json'),
    });

    getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: 'broken.json', file: { text: jest.fn().mockResolvedValue('{') } }],
    });
    await expect(pickStoryExportFile()).rejects.toMatchObject<Partial<StoryImportError>>({
      reason: 'invalid_format',
      message: expect.stringContaining('broken.json'),
    });
  });

  it('delegates ZIP files to the bundle reader and preserves its media payload', async () => {
    const extracted = {
      story: validExport(),
      media: [{ hash: 'abc', mimeType: 'image/png', bytes: new Uint8Array([1]) }],
    };
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          name: 'backup.zip',
          file: { arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1, 2]).buffer) },
        },
      ],
    });
    extractZipMock.mockResolvedValue(extracted);

    await expect(pickStoryExportFile()).resolves.toEqual(extracted);
    expect(extractZipMock).toHaveBeenCalledWith(new Uint8Array([1, 2]), 'backup.zip');
  });
});
