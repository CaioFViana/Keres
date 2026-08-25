import { initI18n } from '../src/i18n';

/**
 * Starts translation once for the whole suite, as the panel's and the site's entry points do
 * before rendering. Without this, `t()` returns the key itself and any test asserting a screen's
 * text fails for a reason that is not its own.
 *
 * The default namespace is `admin` because that is what most tests render; the site's tests ask
 * for `showcase` explicitly when they need it.
 */
initI18n('keres_test_language', 'admin');
