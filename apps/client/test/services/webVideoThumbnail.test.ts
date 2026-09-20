/**
 * @jest-environment node
 */
import { captureVideoThumbnail } from '../../src/services/webVideoThumbnail';

interface FakeVideo {
  muted: boolean;
  playsInline: boolean;
  preload: string;
  src: string;
  currentTime: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  removeAttribute: jest.Mock;
  load: jest.Mock;
  fire: (event: string) => void;
}

function makeVideoElement(): FakeVideo {
  const listeners = new Map<string, Set<() => void>>();
  const video = {
    muted: false,
    playsInline: false,
    preload: '',
    src: '',
    currentTime: 0,
    duration: NaN,
    videoWidth: 0,
    videoHeight: 0,
    addEventListener: jest.fn((event: string, callback: () => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
    }),
    removeEventListener: jest.fn((event: string, callback: () => void) => {
      listeners.get(event)?.delete(callback);
    }),
    removeAttribute: jest.fn(),
    load: jest.fn(),
    fire: (event: string) => {
      [...(listeners.get(event) ?? [])].forEach((callback) => callback());
    },
  };
  return video;
}

interface FakeCanvas {
  width: number;
  height: number;
  getContext: jest.Mock;
  toBlob: jest.Mock;
  drawImage: jest.Mock;
}

function makeCanvasElement(frameBytes: Uint8Array): FakeCanvas {
  const drawImage = jest.fn();
  return {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ({ drawImage })),
    toBlob: jest.fn((callback: (blob: Blob | null) => void) =>
      callback(new Blob([frameBytes as BlobPart], { type: 'image/jpeg' })),
    ),
    drawImage,
  };
}

const FRAME = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const realDocument = (globalThis as { document?: unknown }).document;

function stubDocument(video: FakeVideo, canvas: FakeCanvas) {
  (globalThis as { document?: unknown }).document = {
    createElement: jest.fn((tag: string) => (tag === 'video' ? video : canvas)),
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

afterEach(() => {
  if (realDocument === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document?: unknown }).document = realDocument;
  }
});

describe('captureVideoThumbnail', () => {
  it('captures the 1s frame capped at 480 wide and releases the element', async () => {
    const video = makeVideoElement();
    video.duration = 10;
    video.videoWidth = 960;
    video.videoHeight = 540;
    const canvas = makeCanvasElement(FRAME);
    stubDocument(video, canvas);

    const pending = captureVideoThumbnail('blob:video');
    await flush();
    video.fire('loadedmetadata');
    await flush();
    expect(video.currentTime).toBe(1);
    video.fire('seeked');
    await expect(pending).resolves.toEqual(FRAME);

    expect(video.muted).toBe(true);
    expect(video.preload).toBe('auto');
    expect(video.src).toBe('blob:video');
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(270);
    expect(canvas.drawImage).toHaveBeenCalledWith(video, 0, 0, 480, 270);
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.6,
    );
    expect(video.removeAttribute).toHaveBeenCalledWith('src');
    expect(video.load).toHaveBeenCalledTimes(1);
  });

  it('leaves small videos at their natural size', async () => {
    const video = makeVideoElement();
    video.duration = 10;
    video.videoWidth = 320;
    video.videoHeight = 200;
    const canvas = makeCanvasElement(FRAME);
    stubDocument(video, canvas);

    const pending = captureVideoThumbnail('blob:video');
    await flush();
    video.fire('loadedmetadata');
    await flush();
    video.fire('seeked');
    await expect(pending).resolves.toEqual(FRAME);

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(200);
  });

  it('aims before the end of sub-second clips and skips the seek when the duration is unknown', async () => {
    const short = makeVideoElement();
    short.duration = 0.5;
    short.videoWidth = 640;
    short.videoHeight = 480;
    stubDocument(short, makeCanvasElement(FRAME));

    const pendingShort = captureVideoThumbnail('blob:short');
    await flush();
    short.fire('loadedmetadata');
    await flush();
    expect(short.currentTime).toBeCloseTo(0.4);
    short.fire('seeked');
    await expect(pendingShort).resolves.toEqual(FRAME);

    const unknown = makeVideoElement();
    unknown.videoWidth = 640;
    unknown.videoHeight = 480;
    stubDocument(unknown, makeCanvasElement(FRAME));

    const pendingUnknown = captureVideoThumbnail('blob:unknown');
    await flush();
    unknown.fire('loadedmetadata');
    await expect(pendingUnknown).resolves.toEqual(FRAME);
    expect(unknown.currentTime).toBe(0);
  });

  it('returns undefined when the video errors, the frame is empty, or nothing is decodable', async () => {
    const failing = makeVideoElement();
    stubDocument(failing, makeCanvasElement(FRAME));

    const pendingFailure = captureVideoThumbnail('blob:broken');
    await flush();
    failing.fire('error');
    await expect(pendingFailure).resolves.toBeUndefined();
    expect(failing.removeAttribute).toHaveBeenCalledWith('src');
    expect(failing.load).toHaveBeenCalledTimes(1);

    const audioOnly = makeVideoElement();
    audioOnly.duration = 10;
    stubDocument(audioOnly, makeCanvasElement(FRAME));

    const pendingAudio = captureVideoThumbnail('blob:audio');
    await flush();
    audioOnly.fire('loadedmetadata');
    await flush();
    audioOnly.fire('seeked');
    await expect(pendingAudio).resolves.toBeUndefined();
  });

  it('returns undefined when the canvas or its context is unavailable', async () => {
    const video = makeVideoElement();
    video.duration = 10;
    video.videoWidth = 640;
    video.videoHeight = 480;
    const canvas = makeCanvasElement(FRAME);
    canvas.getContext.mockReturnValue(null);
    stubDocument(video, canvas);

    const pending = captureVideoThumbnail('blob:video');
    await flush();
    video.fire('loadedmetadata');
    await flush();
    video.fire('seeked');
    await expect(pending).resolves.toBeUndefined();

    const video2 = makeVideoElement();
    video2.duration = 10;
    video2.videoWidth = 640;
    video2.videoHeight = 480;
    const canvas2 = makeCanvasElement(FRAME);
    canvas2.toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(null));
    stubDocument(video2, canvas2);

    const pending2 = captureVideoThumbnail('blob:video');
    await flush();
    video2.fire('loadedmetadata');
    await flush();
    video2.fire('seeked');
    await expect(pending2).resolves.toBeUndefined();
  });

  it('returns undefined when the seek never lands and when there is no document', async () => {
    const hanging = makeVideoElement();
    hanging.duration = 10;
    stubDocument(hanging, makeCanvasElement(FRAME));

    // Listeners attach synchronously, so firing immediately cannot lose the 5ms race.
    const pendingHang = captureVideoThumbnail('blob:hang', { timeoutMs: 5 });
    hanging.fire('loadedmetadata');
    await expect(pendingHang).resolves.toBeUndefined();

    delete (globalThis as { document?: unknown }).document;
    await expect(captureVideoThumbnail('blob:video')).resolves.toBeUndefined();
  });
});
