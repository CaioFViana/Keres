/**
 * The upload page's one script: the live photo (camera, capture, retake), the fallback to a file input when the camera
 * is not there or is refused, and the send with `fetch` and `FormData`. It is served inline with the page's nonce and
 * holds no text the person reads: every message is in the markup (`data-*` attributes or hidden elements), so the
 * wording lives in one catalogue. Without the script the form still works as an ordinary multipart post.
 *
 * No template literals, no `</` sequences: this text sits inside a `<script>` element.
 */
export const UPLOAD_SCRIPT = `
(function () {
  var form = document.getElementById('upload-form');
  if (!form) return;
  var errorBox = document.getElementById('form-error');
  var done = document.getElementById('done');
  var cameraBox = document.getElementById('camera-box');
  var fallback = document.getElementById('photo-fallback');
  var fallbackInput = document.getElementById('photo-file');
  var frontInput = document.getElementById('front-file');
  var backInput = document.getElementById('back-file');
  var video = document.getElementById('preview');
  var canvas = document.getElementById('snapshot');
  var startButton = document.getElementById('camera-start');
  var captureButton = document.getElementById('camera-capture');
  var retakeButton = document.getElementById('camera-retake');
  var sendButton = document.getElementById('send');
  var stream = null;
  var captured = null;

  function show(element, on) { element.hidden = !on; }

  function showError(text) { errorBox.textContent = text || ''; }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
    }
    video.srcObject = null;
  }

  // The camera box shows one thing at a time: start, the live picture, or the photo just taken.
  function cameraView(state) {
    show(video, state === 'live');
    show(canvas, state === 'captured');
    show(startButton, state === 'idle');
    show(captureButton, state === 'live');
    show(retakeButton, state === 'captured');
  }

  // The file input replaces the camera when the browser cannot give us one, or refuses it.
  function useFallback() {
    stopStream();
    show(cameraBox, false);
    show(fallback, true);
  }

  function startCamera() {
    showError('');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then(function (media) {
      stream = media;
      video.srcObject = media;
      cameraView('live');
    }, function () {
      useFallback();
    });
  }

  function capture() {
    var width = video.videoWidth;
    var height = video.videoHeight;
    if (!width || !height) { useFallback(); return; }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    canvas.toBlob(function (blob) {
      if (!blob) { useFallback(); return; }
      captured = blob;
      stopStream();
      cameraView('captured');
    }, 'image/jpeg', 0.92);
  }

  function finished() {
    stopStream();
    form.hidden = true;
    done.hidden = false;
    window.scrollTo(0, 0);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    showError('');
    var front = frontInput.files && frontInput.files[0];
    var back = backInput.files && backInput.files[0];
    var photo = captured || (fallbackInput.files && fallbackInput.files[0]);
    if (!front || front.size === 0) { showError(form.dataset.missingFront); return; }
    if (!photo || photo.size === 0) { showError(form.dataset.missingPhoto); return; }

    var data = new FormData();
    data.append('front', front);
    if (back && back.size > 0) data.append('back', back);
    data.append('photo', photo, 'photo.jpg');

    sendButton.disabled = true;
    fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (response) {
      return response.json().then(function (body) { return body; }, function () { return null; });
    }).then(function (body) {
      if (body && body.ok === true) { finished(); return; }
      sendButton.disabled = false;
      showError((body && body.message) || form.dataset.network);
    }, function () {
      sendButton.disabled = false;
      showError(form.dataset.network);
    });
  });

  window.addEventListener('pagehide', stopStream);

  var canCamera = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
  if (canCamera) {
    show(cameraBox, true);
    show(fallback, false);
    cameraView('idle');
    startButton.addEventListener('click', startCamera);
    captureButton.addEventListener('click', capture);
    retakeButton.addEventListener('click', function () { captured = null; startCamera(); });
  }
})();
`;
