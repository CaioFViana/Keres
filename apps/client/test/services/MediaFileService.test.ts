/**
 * @jest-environment node
 */
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

import * as DocumentPicker from 'expo-document-picker';
import { mediaFileService, UnsupportedMediaError } from '../../src/services/MediaFileService';

const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

it('uses the supported picker configuration and distinguishes cancellation from selected files', async () => {
  getDocumentAsync.mockResolvedValueOnce({ canceled: true });
  await expect(mediaFileService.pick()).resolves.toBeNull();

  const asset = { name: 'mapa.png', uri: 'file://mapa.png' } as any;
  getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [asset] });
  await expect(mediaFileService.pick()).resolves.toEqual([asset]);
  expect(getDocumentAsync).toHaveBeenCalledWith(
    expect.objectContaining({ copyToCacheDirectory: true, multiple: true }),
  );

  const error = new UnsupportedMediaError('application/zip', 'mapa.zip');
  expect(error).toEqual(
    expect.objectContaining({
      mimeType: 'application/zip',
      fileName: 'mapa.zip',
      name: 'UnsupportedMediaError',
    }),
  );
});

it('opens a separate picker for documents', async () => {
  getDocumentAsync.mockResolvedValueOnce({ canceled: true });
  await expect(mediaFileService.pickDocuments()).resolves.toBeNull();

  const asset = { name: 'notes.pdf', uri: 'file://notes.pdf' } as any;
  getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [asset] });
  await expect(mediaFileService.pickDocuments()).resolves.toEqual([asset]);
  expect(getDocumentAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({
      copyToCacheDirectory: true,
      multiple: true,
      type: expect.arrayContaining(['application/pdf']),
    }),
  );
});
