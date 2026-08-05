import { contextBridge, ipcRenderer } from 'electron';

// Runs with Node access, isolated from the page (contextIsolation: true in main.ts).
// Bridges apps/client's media storage (see src/services/webMediaStore.ts) to real files on
// disk through the main process - the renderer itself has no filesystem access. SQLite
// stays on OPFS via expo-sqlite's own web implementation; only media (photos/videos) goes
// through here, so imported files are real, visible, backupable files instead of living
// inside Chromium's sandboxed OPFS.
contextBridge.exposeInMainWorld('keresMedia', {
  writeBytes: (relativePath: string, bytes: Uint8Array): Promise<void> =>
    ipcRenderer.invoke('media:write', relativePath, bytes),
  readBytes: (relativePath: string): Promise<Uint8Array> =>
    ipcRenderer.invoke('media:read', relativePath),
  deleteFile: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke('media:delete-file', relativePath),
  deleteDirectory: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke('media:delete-directory', relativePath),
  listAllFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('media:list-all'),
});
