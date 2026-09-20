const locizePromotion = 'i18next is made possible by our own product, Locize';
const originalConsoleInfo = console.info;

// React needs this explicit signal outside the browser so asynchronous updates performed by
// React Native test renderers are treated as an `act`-aware environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Expo 55's WinterCG runtime installs lazy `URL`/`URLSearchParams` globals whose implementation
// (`whatwg-url-minimum`) reads the `TextEncoder` global at load. Hermes provides it on device and
// the node test env has it, but the jsdom env does not - without this, every jsdom suite that
// touches a URL fails with `ReferenceError: TextEncoder is not defined`. Node's own encoder is
// spec-compliant, so it stands in. Guarded so the node env keeps its native binding.
if (typeof globalThis.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- setup files cannot use imports.
  const { TextEncoder } = require('util');
  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    enumerable: false,
    value: TextEncoder,
    writable: true,
  });
}

// Reanimated 4.2's Jest entry imports the real `react-native-worklets` index, which
// instantiates its native module at load and throws in Jest. The worklets package ships its
// own mock - register it so the reanimated mock below can load.
jest.mock('react-native-worklets', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  require('react-native-worklets/src/mock'),
);

// Reanimated schedules native-frame updates in the real runtime. Its Jest implementation keeps
// collapsible controls deterministic and prevents animation updates from leaking outside `act`.
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const ReanimatedMock = require('react-native-reanimated/mock');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  return {
    ...ReanimatedMock,
    // The stock mock rebuilds the shared object on every render; the real hook keeps one object
    // per component instance, which the viewport camera mirror relies on.
    useSharedValue: (initial: unknown) => {
      const ref = React.useRef(null);
      if (ref.current === null) ref.current = { value: initial };
      return ref.current;
    },
  };
});

// Entity secondary-draft persistence and several stores touch AsyncStorage; native module is null in Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// `expo-video` extends a native-backed class at import time, which throws in Jest, and half the
// service graph reaches it transitively through MediaFileService. The suites that exercise it
// (media players, thumbnails) register richer per-file mocks, so the global stand-in only keeps
// everyone else loading.
jest.mock('expo-video', () => ({
  createVideoPlayer: () => ({ generateThumbnailsAsync: async () => [], release: () => {} }),
  useVideoPlayer: () => null,
  VideoView: () => null,
}));

// Same story for the thumbnail-saving half of the chain: the native module is null in Jest and
// only `generateVideoThumbnail` touches it (mocked per file where its calls are asserted).
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: () => ({
      renderAsync: async () => ({ saveAsync: async () => ({ uri: '' }) }),
    }),
  },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  FlipType: { Vertical: 'vertical', Horizontal: 'horizontal' },
}));

/**
 * i18next prints a sponsorship banner whenever it initializes. It has no diagnostic value in
 * this suite, while other `console.info` calls remain visible to preserve useful test output.
 */
console.info = (...args: Parameters<typeof console.info>) => {
  if (args.some((arg) => typeof arg === 'string' && arg.includes(locizePromotion))) {
    return;
  }
  originalConsoleInfo(...args);
};

// Skia draws on the GPU with no host tree; tests assert the declarative scene instead, so each
// drawing maps to a host placeholder that keeps its props (paths, paints, camera) queryable.
jest.mock('@shopify/react-native-skia', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  const host = (type: string) => {
    // React 19 hands `ref` to function components as a prop; forwarding it to the host
    // element would let the renderer overwrite test-driven ref holders, so it stays out.
    const SkiaHost = (props: { children?: React.ReactNode }) => {
      const { ref: _ignored, ...rest } = (props ?? {}) as Record<string, unknown>;
      return React.createElement(type, rest, (rest as { children?: React.ReactNode }).children);
    };
    SkiaHost.displayName = type;
    return SkiaHost;
  };
  // The raster host reads snapshots off this holder; tests drive it per case.
  const canvasHolder: { current: unknown } = { current: null };
  return {
    __esModule: true,
    Canvas: host('SkiaCanvas'),
    Group: host('SkiaGroup'),
    Path: host('SkiaPath'),
    Circle: host('SkiaCircle'),
    Line: host('SkiaLine'),
    Rect: host('SkiaRect'),
    DashPathEffect: host('SkiaDashPathEffect'),
    Text: host('SkiaText'),
    RoundedRect: host('SkiaRoundedRect'),
    ImageSVG: host('SkiaImageSVG'),
    useCanvasRef: () => canvasHolder,
    Skia: {
      SVG: {
        MakeFromString: (text: string) => (text.includes('<svg') ? { __mockSvg: text } : null),
      },
    },
    // Deterministic measuring so label-centering math stays assertable: six units per
    // glyph, through the same glyph calls the canvases use (`measureText` is
    // unimplemented on web).
    matchFont: () => ({
      getGlyphIDs: (text: string) => [...text].map((_, index) => index),
      getGlyphWidths: (ids: number[]) => ids.map(() => 6),
    }),
    // The web font hook feeds this a URI; tests drive per-source behavior via spyOn.
    useFont: () => ({
      getGlyphIDs: (text: string) => [...text].map((_, index) => index),
      getGlyphWidths: (ids: number[]) => ids.map(() => 6),
    }),
    __skiaTest: {
      canvasHolder,
      reset() {
        canvasHolder.current = null;
      },
    },
  };
});
