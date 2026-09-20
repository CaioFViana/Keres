/**
 * Video thumbnails on web.
 *
 * There is no native frame extractor in the browser, so a frame is captured the manual way: the
 * stored video is loaded into a detached `<video>` element, seeked to the first second, drawn
 * onto a `<canvas>`, and read back as JPEG bytes. The source URL comes from `webMediaStore`
 * (a same-origin `blob:` URL), which is what keeps the canvas readable - a cross-origin source
 * would taint it and `toBlob` would come back empty.
 *
 * Everything here degrades to `undefined`: an undecodable file, a browser without canvas, or a
 * seek that never completes leaves the video playing normally with the generic grid icon.
 */

/** The second of the video the grid thumbnail is taken from (matches native). */
const FRAME_TIME_SECONDS = 1;
/** Grid cells are small; anything bigger wastes disk and decode time (matches native). */
const MAX_FRAME_WIDTH = 480;
/** JPEG quality of the captured frame (matches native). */
const FRAME_JPEG_QUALITY = 0.6;
/** Local files answer in milliseconds; beyond this the video is treated as uncapturable. */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface CaptureVideoThumbnailOptions {
  /** How long to wait for metadata and for the seek to land. Tests use a tiny value. */
  timeoutMs?: number;
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  event: 'loadedmetadata' | 'seeked',
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for "${event}".`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener('error', onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Video "${event}" failed.`));
    };
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', FRAME_JPEG_QUALITY),
  );
}

/**
 * Captures a single frame of the video at `videoUrl` as JPEG bytes.
 *
 * The video element is never attached to the page: it only decodes. Muted with `preload`
 * so the seek is allowed without a user gesture.
 */
export async function captureVideoThumbnail(
  videoUrl: string,
  options: CaptureVideoThumbnailOptions = {},
): Promise<Uint8Array | undefined> {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = videoUrl;
  try {
    await waitForVideoEvent(video, 'loadedmetadata', timeoutMs);
    const { duration, videoWidth, videoHeight } = video;
    // A clip shorter than a second has no 1s mark to seek to; aiming just before its end
    // avoids landing exactly on the last (possibly blank) instant.
    const target =
      Number.isFinite(duration) && duration > 0
        ? Math.min(FRAME_TIME_SECONDS, Math.max(0, duration - 0.1))
        : 0;
    if (target > 0) {
      video.currentTime = target;
      await waitForVideoEvent(video, 'seeked', timeoutMs);
    }
    if (!videoWidth || !videoHeight) {
      return undefined;
    }
    const scale = Math.min(1, MAX_FRAME_WIDTH / videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(videoWidth * scale));
    canvas.height = Math.max(1, Math.round(videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToJpeg(canvas);
    if (!blob) {
      return undefined;
    }
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return undefined;
  } finally {
    // Release the decoder and the object URL reference; the cached blob URL itself belongs to
    // webMediaStore, which revokes it when the file is deleted.
    video.removeAttribute('src');
    video.load();
  }
}
