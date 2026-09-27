/*
 * Cross-origin isolation for hosts that cannot send headers (GitHub Pages). Web expo-sqlite needs
 * SharedArrayBuffer, which only exists on a crossOriginIsolated page - the API and the desktop shell
 * send COOP/COEP themselves (see apps/api/src/services/hostedClient.ts). Here this worker re-serves
 * every response of its scope with the same headers. Registered by src/utils/crossOriginIsolation.ts,
 * in the serverless build only.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // A cross-origin request that may only come from the cache cannot be fetched from a worker.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  event.respondWith(
    fetch(request).then((response) => {
      // Opaque responses cannot carry new headers; COEP decides about them as they are.
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }),
  );
});
