/** @jest-environment node */
import { decodeFileUriOnce } from '../../src/utils/fileUri';

// The shape storage URIs take inside Expo Go on Android: the `@anonymous/<slug>` segment
// of `documentDirectory` arrives percent-encoded, and the `Directory` -> `File` nesting
// encodes it again. The file-system module resolves that double spelling symmetrically,
// so everything it does works - but `expo-video` strips `file://` without decoding
// anything, and `setDataSource` then reports "does not exist". Pre-decoding exactly one
// level hands it the path that exists. The tests pin that single pass.
const SINGLE_BASE =
  'file:///data/user/0/host.exp.exponent/files/ExperienceData/%40anonymous%2FKeres-Client-1';
const DOUBLE_BASE =
  'file:///data/user/0/host.exp.exponent/files/ExperienceData/%2540anonymous%252FKeres-Client-1';

it('decodes a double-encoded storage URI exactly one level', () => {
  expect(decodeFileUriOnce(`${DOUBLE_BASE}/media/story/hash.mp4`)).toBe(
    `${SINGLE_BASE}/media/story/hash.mp4`,
  );
});

it('leaves raw and single-encoded URIs to a single pass each', () => {
  expect(decodeFileUriOnce(`${SINGLE_BASE}/media/story/hash.mp4`)).toBe(
    'file:///data/user/0/host.exp.exponent/files/ExperienceData/@anonymous/Keres-Client-1/media/story/hash.mp4',
  );
  expect(decodeFileUriOnce('file:///media/cover.png')).toBe('file:///media/cover.png');
});

it('passes through anything that is not a local file URI', () => {
  expect(decodeFileUriOnce('content://media/external/video/42')).toBe(
    'content://media/external/video/42',
  );
  expect(decodeFileUriOnce('desktop-media:media/story/hash.mp4')).toBe(
    'desktop-media:media/story/hash.mp4',
  );
  expect(decodeFileUriOnce('https://example.com/v%20ideo.mp4')).toBe(
    'https://example.com/v%20ideo.mp4',
  );
  expect(decodeFileUriOnce('')).toBe('');
});

it('keeps the original URI when it is not valid percent-encoding', () => {
  expect(decodeFileUriOnce('file:///media/100%.mp4')).toBe('file:///media/100%.mp4');
});
