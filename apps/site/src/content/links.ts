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
