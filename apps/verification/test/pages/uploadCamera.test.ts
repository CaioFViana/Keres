// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { UPLOAD_MESSAGES } from '../../src/pages/uploadMessages';
import { ACTION_URL, answer, FRAME, loadUploadPage, type LoadedPage } from './cameraHarness';

/**
 * The inline script of the upload page, on a page with a fake camera: the live preview, the snapshot, the retake, the
 * fallback to a file input, the send, and the stop on `pagehide`. The camera is a fake; no device is ever opened.
 */

const EN = UPLOAD_MESSAGES.en;
const FRONT_CAMERA = { video: { facingMode: 'user' }, audio: false };

const pages: LoadedPage[] = [];

function load(options?: Parameters<typeof loadUploadPage>[0]): LoadedPage {
  const page = loadUploadPage(options);
  pages.push(page);
  return page;
}

afterEach(() => {
  for (const page of pages.splice(0)) {
    // Checked before the page is closed: an exception in the script would be reported only here.
    expect(page.errors, 'errors reported by the page').toEqual([]);
    page.close();
  }
});

/** Turns the camera on and takes one photo from it. */
async function takePhoto(page: LoadedPage): Promise<void> {
  await page.click('camera-start');
  await page.click('camera-capture');
}

/** The body of the one `fetch` the script made. */
function sentForm(page: LoadedPage): FormData {
  const init = page.fetch.mock.calls[0]?.[1] as RequestInit | undefined;
  expect(init?.body, 'the send carries a FormData').toBeInstanceOf(page.window.FormData);
  return init?.body as FormData;
}

describe('the camera', () => {
  it('turns on by asking for the front camera, once, and never for audio', async () => {
    const page = load();
    await page.click('camera-start');
    expect(page.camera.getUserMedia).toHaveBeenCalledTimes(1);
    expect(page.camera.getUserMedia).toHaveBeenCalledWith(FRONT_CAMERA);
  });

  it('shows the live picture with Take photo, and hides Start, the snapshot and Retake', async () => {
    const page = load();
    await page.click('camera-start');
    expect(page.shown('preview')).toBe(true);
    expect(page.shown('camera-capture')).toBe(true);
    expect(page.shown('camera-start')).toBe(false);
    expect(page.shown('snapshot')).toBe(false);
    expect(page.shown('camera-retake')).toBe(false);
    expect(page.shown('photo-fallback')).toBe(false);
    expect(page.el<HTMLVideoElement>('preview').srcObject).toBe(page.camera.streams[0]);
  });

  it('takes a JPEG from the live frame, stops the camera, and shows the snapshot with Retake', async () => {
    const page = load();
    await takePhoto(page);

    expect(page.camera.drawImage).toHaveBeenCalledWith(
      page.el('preview'),
      0,
      0,
      FRAME.width,
      FRAME.height,
    );
    expect(page.el<HTMLCanvasElement>('snapshot').width).toBe(FRAME.width);
    expect(page.camera.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);

    const [stream] = page.camera.streams;
    expect(stream?.tracks.map((track) => track.stop.mock.calls.length)).toEqual([1]);
    expect(page.el<HTMLVideoElement>('preview').srcObject).toBeNull();
    expect(page.shown('preview')).toBe(false);
    expect(page.shown('camera-capture')).toBe(false);
    expect(page.shown('snapshot')).toBe(true);
    expect(page.shown('camera-retake')).toBe(true);
  });

  it('sends the snapshot as the photo: a JPEG named photo.jpg', async () => {
    const page = load();
    await takePhoto(page);
    page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
    await page.submit();

    const photo = sentForm(page).get('photo');
    expect(photo).toBeInstanceOf(page.window.File);
    expect((photo as File).type).toBe('image/jpeg');
    expect((photo as File).name).toBe('photo.jpg');
    expect((photo as File).size).toBeGreaterThan(0);
  });

  it('retake starts the camera again and drops the photo taken before', async () => {
    const page = load();
    await takePhoto(page);
    await page.click('camera-retake');

    expect(page.camera.getUserMedia).toHaveBeenCalledTimes(2);
    expect(page.camera.getUserMedia).toHaveBeenLastCalledWith(FRONT_CAMERA);
    expect(page.shown('preview')).toBe(true);
    expect(page.shown('snapshot')).toBe(false);

    // The first photo is gone: with no new one, the form asks for it and sends nothing.
    page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
    await page.submit();
    expect(page.el('form-error').textContent).toBe(EN.refusals.missing_photo);
    expect(page.fetch).not.toHaveBeenCalled();
  });

  it.each(['NotAllowedError', 'NotFoundError'])(
    'a %s from the browser shows the file input instead, and throws nothing',
    async (name) => {
      const page = load();
      page.camera.getUserMedia.mockRejectedValueOnce(page.domError(name));
      await page.click('camera-start');

      expect(page.shown('camera-box')).toBe(false);
      expect(page.shown('photo-fallback')).toBe(true);
      expect(page.el('photo-fallback').textContent).toContain(EN.photoFallback);
      expect(page.el('form-error').textContent).toBe('');

      // The file input is the photo now: its file is what is sent.
      const picked = page.file('photo.jpg', 'image/jpeg', 9);
      page.choose('photo-file', picked);
      page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
      await page.submit();
      expect(sentForm(page).get('photo')).toBeInstanceOf(page.window.File);
      expect((sentForm(page).get('photo') as File).size).toBe(9);
    },
  );

  it('a browser with no media API shows the file input and no camera box', () => {
    const page = load({ camera: false });
    expect(page.shown('camera-box')).toBe(false);
    expect(page.shown('photo-fallback')).toBe(true);
    expect(page.camera.getUserMedia).not.toHaveBeenCalled();
  });

  it('stops the camera when the page is left (pagehide)', async () => {
    const page = load();
    await page.click('camera-start');
    const [stream] = page.camera.streams;

    page.window.dispatchEvent(new page.window.Event('pagehide'));
    expect(stream?.tracks.map((track) => track.stop.mock.calls.length)).toEqual([1]);
    expect(page.el<HTMLVideoElement>('preview').srcObject).toBeNull();
  });
});

describe('the send', () => {
  it('builds the form with front and photo, and posts it to the upload path asking for JSON', async () => {
    const page = load();
    await takePhoto(page);
    page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
    await page.submit();

    expect(page.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = page.fetch.mock.calls[0] ?? [];
    expect(url).toBe(ACTION_URL);
    expect(init).toMatchObject({
      method: 'POST',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });

    const body = sentForm(page);
    expect(body.getAll('front')).toHaveLength(1);
    expect((body.get('front') as File).name).toBe('front.jpg');
    expect(body.has('photo')).toBe(true);
    expect(body.has('back')).toBe(false);
  });

  it('adds the back only when one was chosen', async () => {
    const page = load();
    await takePhoto(page);
    page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
    page.choose('back-file', page.file('back.jpg', 'image/jpeg'));
    await page.submit();

    const body = sentForm(page);
    expect((body.get('back') as File).name).toBe('back.jpg');
    expect(body.getAll('back')).toHaveLength(1);
  });

  it('shows the thank-you state on {ok: true}, and hides the form', async () => {
    const page = load();
    await takePhoto(page);
    page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
    await page.submit();

    expect(page.shown('upload-form')).toBe(false);
    expect(page.shown('done')).toBe(true);
    expect(page.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('shows the refusal message above the form, and keeps the form for another try', async () => {
    const page = load();
    await takePhoto(page);
    page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
    page.fetch.mockResolvedValueOnce(
      answer(400, { ok: false, code: 'not_an_image', message: EN.refusals.not_an_image }),
    );
    await page.submit();

    expect(page.el('form-error').textContent).toBe(EN.refusals.not_an_image);
    expect(page.shown('upload-form')).toBe(true);
    expect(page.shown('done')).toBe(false);
    expect(page.el<HTMLButtonElement>('send').disabled).toBe(false);
  });

  it.each([
    ['a request that fails', () => new TypeError('the network is down')],
    ['an answer that is not JSON', () => new Response('<h1>502</h1>', { status: 502 })],
  ])('shows the network message for %s', async (_label, outcome) => {
    const page = load();
    await takePhoto(page);
    page.choose('front-file', page.file('front.jpg', 'image/jpeg'));
    const reply = outcome();
    if (reply instanceof Response) page.fetch.mockResolvedValueOnce(reply);
    else page.fetch.mockRejectedValueOnce(reply);
    await page.submit();

    expect(page.el('form-error').textContent).toBe(EN.networkError);
    expect(page.shown('upload-form')).toBe(true);
    expect(page.el<HTMLButtonElement>('send').disabled).toBe(false);
  });

  it('sends nothing without a front, and says which part is missing', async () => {
    const page = load();
    await takePhoto(page);
    await page.submit();

    expect(page.el('form-error').textContent).toBe(EN.refusals.missing_front);
    expect(page.fetch).not.toHaveBeenCalled();
  });
});
