/** The landing page's public destinations. Centralised for tests and for the footer. */

export const GITHUB_REPO_URL = 'https://github.com/CaioFViana/Keres';
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const GITHUB_README_URL = `${GITHUB_REPO_URL}#readme`;
export const DOCKER_IMAGE = 'ghcr.io/caiofviana/keres';

/**
 * The serverless web client published beside this page (see `.github/workflows/pages.yml`): the whole
 * app, running on the visitor's device with no server features. It sits under `client/` of the same
 * base path, so the address follows wherever the site is served.
 */
export const WEB_CLIENT_URL = `${import.meta.env.BASE_URL}client/`;

/**
 * The web client of the server this landing build is served by: the landing lives at the
 * server's root, the client at `/client` of the same origin - a relative path on purpose, so
 * the bundle works on any host without knowing its own address.
 */
export const HOSTED_CLIENT_URL = '/client/';

/** The official Keres server, presented as such by the landing build. */
export const KERES_OFFICIAL_URL = 'https://keres.me';
export const KERES_OFFICIAL_CLIENT_URL = `${KERES_OFFICIAL_URL}/client/`;
