/// <reference types="vite/client" />

/**
 * The Keres wordmark is generated at build time from the desktop app's icon, so there is no
 * file on disk for TypeScript to resolve.
 */
declare module 'virtual:keres-logo' {
  const url: string;
  export default url;
}

/** `react-native-web` publishes no types; the showcase only uses its View and Text. */
declare module 'react-native-web';
