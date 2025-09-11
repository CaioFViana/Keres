export interface IFileSystemService {
  getKeresDataPath(): string;
  getKeresDbPath(): string;
  getKeresGalleryPath(): string;
  createDirectory(path: string): Promise<void>;
  writeFile(path: string, data: ArrayBuffer): Promise<void>;
  deleteFile(path: string): Promise<void>;
  readFile(filePath: string): Promise<ArrayBuffer>;
}
