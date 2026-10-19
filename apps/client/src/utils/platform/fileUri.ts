const FILE_URI_SCHEME = 'file://';

/**
 * Decodes a `file://` URI exactly one percent-encoding level.
 *
 * Inside Expo Go on Android storage URIs arrive double-encoded (`%2540...%252F`):
 * the `@anonymous/<slug>` segment of `documentDirectory` is already encoded and the
 * `Directory` -> `File` nesting encodes it again. The file-system module resolves that
 * spelling symmetrically - and its permission scope only accepts it, so storage paths
 * must keep it. But `expo-video` strips `file://` without decoding anything
 * (`VideoPlayer.toMetadataRetriever`), and `setDataSource` then reports "does not
 * exist". Pre-decoding one level hands it the path that exists. Every other consumer
 * (Glide, ExoPlayer, Fresco, `Linking`) decodes once itself and takes the stored
 * spelling unchanged.
 *
 * Anything without the `file://` scheme (`content://`, `desktop-media:`, remote URLs)
 * is returned unchanged, as is a URI that is not valid percent-encoding.
 */
export function decodeFileUriOnce(uri: string): string {
  if (!uri.startsWith(FILE_URI_SCHEME)) {
    return uri;
  }
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}
