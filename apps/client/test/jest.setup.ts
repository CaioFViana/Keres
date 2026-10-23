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
  const { TextEncoder } = require('util');
  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    enumerable: false,
    value: TextEncoder,
    writable: true,
  });
}

// Jest 30.4+ reads every enumerable global when it resets modules during teardown. React Native and Expo install
// globals (`DOMRect`, `fetch`, `structuredClone`, ...) as lazy getters that `require()` on first access, and a
// `require()` after the test has finished throws. jest-expo guards its own environment against this, but the
// suites on `@jest-environment node` run the stock one - so the lazy globals are made non-enumerable (still
// readable, just not swept) once the setup is in and again after the suite, since modules install more as they load.
function hideLazyGlobalsFromTeardown() {
  for (const key of Object.keys(globalThis)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (descriptor?.configurable && typeof descriptor.get === 'function') {
      Object.defineProperty(globalThis, key, { ...descriptor, enumerable: false });
    }
  }
}
hideLazyGlobalsFromTeardown();
afterAll(hideLazyGlobalsFromTeardown);

// jest-expo mocks `react-native/asset-registry`, but expo-asset 58 reads the registry through React Native's public
// `AssetRegistry` export, which is backed by the private module the mock does not cover. The asset transformer
// turns every font and image into the id `1`, so without this the icon fonts fail to load with "Module 1 is missing
// from the asset registry" and the icons never render. Same entry the jest-expo mock returns.
jest.mock('react-native/src/private/assets/AssetRegistry', () => ({
  AssetRegistry: {
    registerAsset: jest.fn(() => 1),
    getAssetByID: jest.fn(() => ({
      fileSystemLocation: '/full/path/to/directory',
      httpServerLocation: '/assets/full/path/to/directory',
      scales: [1],
      fileHashes: ['md5'],
      name: 'name',
      exists: true,
      type: 'type',
      hash: 'md5',
      uri: 'uri',
      width: 1,
      height: 1,
    })),
  },
}));

// Reanimated 4.2's Jest entry imports the real `react-native-worklets` index, which
// instantiates its native module at load and throws in Jest. The worklets package ships its
// own mock - register it so the reanimated mock below can load.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Reanimated schedules native-frame updates in the real runtime. Its Jest implementation keeps
// collapsible controls deterministic and prevents animation updates from leaking outside `act`.
jest.mock('react-native-reanimated', () => {
  const ReanimatedMock = require('react-native-reanimated/mock');

  const React = require('react');
  return {
    ...ReanimatedMock,
    // Absent from the stock mock: nothing animates in Jest, so motion is simply not reduced.
    useReducedMotion: () => false,
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
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// `expo-video` extends a native-backed class at import time, which throws in Jest, and half the
// service graph reaches it transitively through MediaFileService. The suites that exercise it
// (media players, thumbnails) register richer per-file mocks, so the global stand-in only keeps
// everyone else loading.
// The clipboard is native-backed: tests hand out what a person copied through `mockClipboardText`.
jest.mock('expo-clipboard', () => ({
  __esModule: true,
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => true),
}));

// `expo-audio` builds its player classes from the native module when it loads, which throws in Jest;
// the song editor reaches it through `useSongPlayback`, so every suite that mounts the navigators
// would fail. The suites that care (media players, song playback) register their own mocks.
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: () => ({
    play: () => {},
    pause: () => {},
    replace: () => {},
    seekTo: async () => {},
    remove: () => {},
  }),
  useAudioPlayerStatus: () => ({
    playing: false,
    isLoaded: false,
    duration: 0,
    currentTime: 0,
    didJustFinish: false,
  }),
}));

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

/**
 * `logger.debug` writes through `console.log` in development, which is what a test run is: every sync cycle
 * and every recorded operation would print a line per call. A test that cares about a line spies on
 * `console.log` itself, which still works over this stand-in.
 */
console.log = () => undefined;

// A component that calls `useTranslation` with no mock renders its keys; an instance with no catalogs gives
// react-i18next that, instead of a missing-instance warning per file. Suites that need real strings
// initialize their own (or mock `react-i18next`).
require('i18next')
  .use(require('react-i18next').initReactI18next)
  .init({ lng: 'en', resources: {} });

/**
 * A list batches the cells it renders on a 50 ms timer of its own, started by a layout or a scroll. The
 * timer fires wherever the test happens to be awaiting - between two presses, while a mock resolves - and
 * its `setState` then lands outside `act()`: one "not wrapped in act" per run, in a different screen each
 * time, depending on how busy the machine was. The list's state updates are made inside `act` here, which
 * is where a user's frame would have made them.
 */
const listStateUpdates = require('@react-native/virtualized-lists/Lists/StateSafePureComponent')
  .default.prototype;
const setListState = listStateUpdates.setState;
listStateUpdates.setState = function setStateInAct(this: unknown, ...args: unknown[]) {
  // React's own `act`, not Testing Library's: that one always wraps the callback in an async function, which
  // React then expects to be awaited. The update is synchronous, and so is the scope around it.
  const wasActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    require('react').act(() => {
      setListState.apply(this, args);
    });
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
  }
};

// Skia draws on the GPU with no host tree; tests assert the declarative scene instead, so each
// drawing maps to a host placeholder that keeps its props (paths, paints, camera) queryable.
jest.mock('@shopify/react-native-skia', () => {
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
    Picture: host('SkiaPicture'),
    useCanvasRef: () => canvasHolder,
    // Sketch drawing: pictures record what would be drawn so tests can count and inspect it.
    createPicture: (draw: (canvas: Record<string, unknown>) => void) => {
      const commands: unknown[] = [];
      draw({
        drawPath: (path: unknown, paint: unknown) => commands.push({ path, paint }),
        drawPicture: (picture: unknown) => commands.push({ picture }),
        drawColor: (color: unknown) => commands.push({ color }),
        scale: () => undefined,
      });
      return { __mockPicture: true, commands };
    },
    FillType: { Winding: 0, EvenOdd: 1 },
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0, Round: 1, Square: 2 },
    StrokeJoin: { Miter: 0, Round: 1, Bevel: 2 },
    ColorType: { RGBA_8888: 4 },
    AlphaType: { Unpremul: 3 },
    Skia: {
      SVG: {
        MakeFromString: (text: string) => (text.includes('<svg') ? { __mockSvg: text } : null),
      },
      // Skia 2.14 paths are immutable: the fill type is set on a builder, which hands back the finished path.
      Path: {
        MakeFromSVGString: (d: string) => ({ d, fillType: 0 }),
      },
      PathBuilder: {
        MakeFromPath: (path: { d: string }) => {
          const built = { d: path.d, fillType: 0 };
          const builder = {
            setFillType: (type: number) => {
              built.fillType = type;
              return builder;
            },
            detach: () => built,
          };
          return builder;
        },
      },
      Paint: () => {
        const paint: Record<string, unknown> = {};
        const setter = (name: string) => (value: unknown) => {
          paint[name] = value;
        };
        return Object.assign(paint, {
          setAntiAlias: setter('antiAlias'),
          setColor: setter('color'),
          setAlphaf: setter('alpha'),
          setStyle: setter('style'),
          setStrokeWidth: setter('strokeWidth'),
          setStrokeCap: setter('strokeCap'),
          setStrokeJoin: setter('strokeJoin'),
        });
      },
      Color: (value: string) => value,
      Matrix: (values?: number[]) => ({ values }),
      Surface: { MakeOffscreen: () => null },
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

// Every canvas export asks SVG or PNG through a modal host that does not exist under Jest. Screens
// and hooks resolve the choice through this module, so the default answer is SVG; a test that cares
// about the choice (or a cancel) overrides it per case.
jest.mock('@/src/state/ui/exportFormatPrompt', () => ({
  __esModule: true,
  chooseExportFormat: jest.fn(async () => 'svg'),
}));

// `react-native-enriched-html` mounts native Fabric views (TipTap on web) that
// do not exist in Jest. Tests assert our wiring (default HTML, event mapping),
// so the stand-in keeps every prop queryable on a host placeholder. Like the
// Skia mock, the ref stays out of the host tree (the renderer would overwrite
// test-driven holders); tests read it off `__enrichedTest.refHolder` instead.
jest.mock('react-native-enriched-html', () => {
  const React = require('react');

  const { View } = require('react-native');
  const refHolder: { current: unknown } = { current: null };
  const EnrichedTextInput = (props: { children?: React.ReactNode }) => {
    const { ref, ...rest } = (props ?? {}) as {
      ref?: React.Ref<unknown>;
    } & Record<string, unknown>;
    refHolder.current = ref ?? null;
    return React.createElement(View, rest, (rest as { children?: React.ReactNode }).children);
  };
  EnrichedTextInput.displayName = 'EnrichedTextInput';
  return {
    __esModule: true,
    EnrichedTextInput,
    __enrichedTest: {
      refHolder,
      reset() {
        refHolder.current = null;
      },
    },
  };
});

// A screen's tour hook reads the navigation container's focus. Screens are rendered here without
// one, and the tours have their own suites, so by default the hook does nothing; a suite that tests
// it (or a screen's wiring of it) says so with its own mock or `jest.unmock`.
jest.mock('@/src/hooks/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: () => undefined,
}));

// The minimum time a legal text must stay open before "I agree" works would make every suite that accepts one wait; the
// suites of the gate itself (`TermsModal.test.tsx`) bring the real value back.
jest.mock('@/src/legal/readingGate', () => ({
  __esModule: true,
  MIN_READ_SECONDS: 0,
}));
