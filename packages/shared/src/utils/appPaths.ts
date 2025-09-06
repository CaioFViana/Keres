import path from 'node:path'

export function getKeresDataPath(): string {
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

export function getKeresDbPath(): string {
  return path.join(getKeresDataPath(), 'keres.sqlite')
}

export function getKeresGalleryPath(): string {
  return path.join(getKeresDataPath(), 'Gallery')
}
