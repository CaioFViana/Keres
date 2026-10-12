import { JSDOM, VirtualConsole, type DOMWindow } from 'jsdom';
import { type Mock, vi } from 'vitest';
import { uploadPage } from '../../src/pages/upload/uploadView';

/**
 * The upload page's script, run for real. The page is rendered by `uploadPage`, the function the route answers with,
 * and loaded into jsdom with its inline script running. The browser parts the script touches are faked before the page
 * is parsed: `navigator.mediaDevices`, a canvas that takes a snapshot, a video that reports a frame, `fetch`, and
 * `scrollTo`. No camera is ever opened: every stream in here is made by this file, and jsdom has no device to ask.
 */

export const TOKEN = 'camera-test-link-0123456789abcdef';
export const ACTION_URL = `https://verify.example/v/${TOKEN}/upload`;
const PAGE_URL = `https://verify.example/v/${TOKEN}`;

/** The frame the fake video reports; the snapshot canvas must take this size. */
export const FRAME = { width: 640, height: 480 };

export interface FakeTrack {
  stop: Mock;
}

export interface FakeStream {
  tracks: FakeTrack[];
  getTracks: () => FakeTrack[];
}

export interface CameraFake {
  /** `navigator.mediaDevices.getUserMedia`. Each call answers with a new fake stream, which is recorded in `streams`. */
  getUserMedia: Mock;
  streams: FakeStream[];
  /** The canvas calls the script makes to take a snapshot. */
  getContext: Mock;
  drawImage: Mock;
  toBlob: Mock;
}

export interface PageOptions {
  /** False: the browser has no media API at all (an old browser, or a page not served from a secure origin). */
  camera?: boolean;
}

export interface LoadedPage {
  window: DOMWindow;
  camera: CameraFake;
  /** `fetch`, answering `{ok: true}` unless a test sets another answer with `mockResolvedValueOnce`. */
  fetch: Mock;
  scrollTo: Mock;
  /** Whatever jsdom reported as an error: an exception in the script, or an API jsdom lacks. None is expected. */
  errors: unknown[];
  el<T extends HTMLElement = HTMLElement>(id: string): T;
  /** True when the element is not `hidden`. */
  shown(id: string): boolean;
  click(id: string): Promise<void>;
  /** Sets what the file input holds, as a person's pick does; `undefined` clears it. */
  choose(id: string, file: File | undefined): void;
  /** A file of `size` zero bytes: the script only looks at a file's size and type. */
  file(name: string, type: string, size?: number): File;
  domError(name: string): DOMException;
  /** Submits the form the way a browser does after its own checks: the `required` attribute is not re-checked here. */
  submit(): Promise<void>;
  /** Lets the timers and promises of the script run to the end. */
  settle(): Promise<void>;
  close(): void;
}

/** A JSON answer of the upload route, as `fetch` hands it back. */
export function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeStream(): FakeStream {
  const tracks: FakeTrack[] = [{ stop: vi.fn() }];
  return { tracks, getTracks: () => tracks };
}

function createCamera(): CameraFake {
  const streams: FakeStream[] = [];
  const drawImage = vi.fn();
  return {
    getUserMedia: vi.fn(async () => {
      const stream = fakeStream();
      streams.push(stream);
      return stream;
    }),
    streams,
    getContext: vi.fn(() => ({ drawImage })),
    drawImage,
    toBlob: vi.fn(),
  };
}

const settleOnce = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function loadUploadPage(options: PageOptions = {}): LoadedPage {
  const html = uploadPage({
    lang: 'en',
    nonce: 'camera-test-nonce',
    action: `/v/${TOKEN}/upload`,
    maxImageBytes: 10 * 1024 * 1024,
  });
  const errors: unknown[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));

  const camera = createCamera();
  const fetchMock = vi.fn(async () => answer(200, { ok: true }));
  const scrollTo = vi.fn();

  const dom = new JSDOM(html, {
    url: PAGE_URL,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      // The fake snapshot is a Blob of the window's own realm, so FormData takes it as a file.
      camera.toBlob.mockImplementation((callback: BlobCallback, type?: string) => {
        const blob = new window.Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], {
          type: type ?? 'image/png',
        });
        setTimeout(() => callback(blob), 0);
      });
      window.HTMLCanvasElement.prototype.getContext =
        camera.getContext as unknown as typeof window.HTMLCanvasElement.prototype.getContext;
      window.HTMLCanvasElement.prototype.toBlob =
        camera.toBlob as unknown as typeof window.HTMLCanvasElement.prototype.toBlob;
      Object.defineProperty(window.HTMLVideoElement.prototype, 'videoWidth', {
        configurable: true,
        get: () => FRAME.width,
      });
      Object.defineProperty(window.HTMLVideoElement.prototype, 'videoHeight', {
        configurable: true,
        get: () => FRAME.height,
      });
      window.HTMLVideoElement.prototype.play = vi.fn(
        async () => {},
      ) as unknown as () => Promise<void>;
      if (options.camera !== false) {
        Object.defineProperty(window.navigator, 'mediaDevices', {
          configurable: true,
          value: { getUserMedia: camera.getUserMedia },
        });
      }
      window.fetch = fetchMock as unknown as typeof window.fetch;
      window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    },
  });

  const { window } = dom;
  const document = window.document;

  const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`the page has no #${id}`);
    return element as T;
  };

  return {
    window,
    camera,
    fetch: fetchMock,
    scrollTo,
    errors,
    el,
    shown: (id) => !el(id).hidden,
    async click(id) {
      el(id).click();
      await this.settle();
    },
    choose(id, file) {
      Object.defineProperty(el<HTMLInputElement>(id), 'files', {
        configurable: true,
        value: file ? [file] : [],
      });
    },
    file(name, type, size = 4) {
      return new window.File([new Uint8Array(size)], name, { type });
    },
    domError: (name) => new window.DOMException(name, name),
    async submit() {
      el<HTMLFormElement>('upload-form').dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true }),
      );
      await this.settle();
    },
    async settle() {
      for (let i = 0; i < 3; i += 1) await settleOnce();
    },
    close: () => window.close(),
  };
}
