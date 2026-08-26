/**
 * The Keres wordmark is generated at build time from the desktop app's icon, so there is no file
 * on disk for TypeScript to resolve - the `keresLogo` plugin (vite.keresIcon.ts) publishes this
 * module with the image's final URL.
 */
declare module 'virtual:keres-logo' {
  const url: string;
  export default url;
}

/**
 * The avatar icons' artwork, cut out of the `ionicons` package at build time by the
 * `keresAvatarIcons` plugin - the inner content of each `<svg>`, indexed by icon name.
 */
declare module 'virtual:keres-avatar-icons' {
  const icons: Record<string, string>;
  export default icons;
}
