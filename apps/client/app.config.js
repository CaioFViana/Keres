/**
 * `app.json` plus what depends on the export target. The web build served under a subpath (GitHub
 * Pages at `/Keres/client`) needs `experiments.baseUrl`, and a dist built that way only works under
 * that subpath - the desktop shell serves its own export from the root. So the base URL is a build
 * input (`KERES_WEB_BASE_URL`), never a fixed setting: each target runs its own export.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.KERES_WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
