import type { IFileSystemService } from '@domain/services/IFileSystemService'
import path from 'node:path'
import fs from 'node:fs/promises'

export class NodeFileSystemService implements IFileSystemService {
  private getBaseDataPath(): string {
    const appName = 'Keres'

    switch (process.platform) {
      case 'win32':
        return process.env.LOCALAPPDATA
          ? path.join(process.env.LOCALAPPDATA, appName)
          : path.join(process.env.APPDATA || '', appName)
      case 'darwin': // macOS
        return path.join(process.env.HOME || '', 'Library', 'Application Support', appName)
      case 'linux':
        return path.join(process.env.HOME || '', '.local', 'share', appName)
      default:
        // Fallback for other platforms or development environments
        return path.join(process.env.HOME || '', `.${appName}`)
    }
  }

  getKeresDataPath(): string {
    return this.getBaseDataPath()
  }

  getKeresDbPath(): string {
    return path.join(this.getBaseDataPath(), 'keres.sqlite')
  }

  getKeresGalleryPath(): string {
    return path.join(this.getBaseDataPath(), 'Gallery')
  }

  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  }

  async writeFile(filePath: string, data: string): Promise<void> {
    // Assuming data is a Base64 string for binary files like images
    const buffer = Buffer.from(data, 'base64')
    await fs.writeFile(filePath, buffer)
  }

  async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath)
  }
}
