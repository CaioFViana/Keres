/**
 * The buy site: one HTML file with script and styles inline, nothing to build. It plays the
 * app's part with the person signed in - list the plans on sale (the current one marked),
 * pick how often and how, and open the payment through the same `/api/payments` the Keres
 * client uses. The provider's part (the approval page) lives on its own route.
 *
 * Unlike the old in-server demo page, this site is a different host from the Keres server,
 * so there is no shared cookie: sign-in returns a bearer token kept in sessionStorage (this
 * tab only) and attached to every call. The server address is baked into the page at boot -
 * it is public information (the API the page talks to).
 *
 * Everything the page renders arrives as data and is put on the page with `textContent`,
 * never as markup.
 */

export const STORE_CSS = [
  ':root { color-scheme: light dark; --bg: #f4f4f2; --card: #fff; --text: #1c1a17; --muted: #6f6a61; --line: #ddd8cf; --accent: #0f766e; --accent-ink: #fff; --ok: #1b7f4b; --bad: #b3261e; }',
  '@media (prefers-color-scheme: dark) { :root { --bg: #161514; --card: #201e1c; --text: #ece7df; --muted: #a8a094; --line: #3a3631; --accent: #5ec8bd; --accent-ink: #062926; --ok: #5fd196; --bad: #ff8a80; } }',
  '* { box-sizing: border-box; }',
  'body { margin: 0; font: 15px/1.45 system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }',
  '.banner { background: var(--bad); color: #fff; padding: 8px 16px; font-size: 13px; text-align: center; }',
  'main { max-width: 760px; margin: 0 auto; padding: 16px; }',
  'h1 { font-size: 22px; margin: 8px 0 4px; }',
  'h2 { font-size: 16px; margin: 0 0 8px; }',
  '.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 12px 0; }',
  '.muted { color: var(--muted); }',
  '.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }',
  '.row.space { justify-content: space-between; }',
  '.plans { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }',
  'button, .link-button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; text-decoration: none; display: inline-block; }',
  'button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }',
  'button:disabled { opacity: .5; cursor: default; }',
  'input[type=text], input[type=password], select { font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); width: 100%; }',
  'label { display: block; margin: 6px 0; }',
  '.field { margin: 8px 0; }',
  '.ok { color: var(--ok); } .bad { color: var(--bad); }',
  '.tag { display: inline-block; font-size: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; margin-left: 6px; }',
  '.tag.current { border-color: var(--accent); color: var(--accent); }',
  '.price { font-size: 18px; font-weight: 700; }',
].join('\n');

export interface StorefrontOptions {
  keresBaseUrl: string;
  displayName: string;
  /** Shown when the test provider is on: nobody should mistake this for real money. */
  mockMode: boolean;
}

function pageShell(title: string, banner: string, body: string): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' +
    title +
    '</title><style>' +
    STORE_CSS +
    '</style></head><body>' +
    banner +
    '<main>' +
    body +
    '</main></body></html>'
  );
}

export function storefrontPage(options: StorefrontOptions): string {
  const banner = options.mockMode
    ? '<div class="banner">TEST MODE - no real money moves here. Anyone signed in can grant themselves a plan.</div>'
    : '';
  const boot =
    '<script>window.KERES_BUY = ' +
    JSON.stringify({ keresBaseUrl: options.keresBaseUrl }) +
    ';</script>';
  const script = `<script>
(function () {
  var app = document.getElementById('app');
  var base = (window.KERES_BUY && window.KERES_BUY.keresBaseUrl) || '';
  var TOKEN_KEY = 'keres.buy.token';

  function h(tag, attrs) {
    var node = document.createElement(tag);
    var attributes = attrs || {};
    Object.keys(attributes).forEach(function (key) {
      if (key === 'class') node.className = attributes[key];
      else if (key === 'onclick') node.addEventListener('click', attributes[key]);
      else if (key === 'text') node.textContent = attributes[key];
      else node.setAttribute(key, attributes[key]);
    });
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  // A child may be a node, a string, nothing, or a list of those (the options of a select).
  function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (item) { append(node, item); }); return; }
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  function api(method, path, body, token) {
    var options = { method: method, headers: {} };
    if (token) options.headers['authorization'] = 'Bearer ' + token;
    if (body !== undefined) {
      options.headers['content-type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return fetch(base + path, options).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        return { status: response.status, ok: response.ok, data: data };
      });
    });
  }

  function money(cents, currency) {
    if (cents === null || cents === undefined) return null;
    return (cents / 100).toFixed(2) + ' ' + currency;
  }
  function show() {
    app.textContent = '';
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) app.appendChild(arguments[i]);
  }
  function failure(result) {
    return (result.data && result.data.message) || ('Something went wrong (' + result.status + ').');
  }

  function loginView(note) {
    var user = h('input', { type: 'text', autocomplete: 'username', placeholder: 'username' });
    var pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'password' });
    var error = h('p', { class: 'bad', text: note || '' });
    function submit() {
      error.textContent = '';
      api('POST', '/api/auth/login', { username: user.value.trim(), password: pass.value }).then(function (result) {
        if (result.ok && result.data && result.data.accessToken) {
          sessionStorage.setItem(TOKEN_KEY, result.data.accessToken);
          plansView();
        } else {
          error.textContent = 'Could not sign in. Check the username and password.';
        }
      });
    }
    pass.addEventListener('keydown', function (event) { if (event.key === 'Enter') submit(); });
    show(h('div', { class: 'card' },
      h('h2', { text: 'Sign in with your Keres account' }),
      h('p', { class: 'muted', text: 'The same username and password as in the app. The token stays in this tab only.' }),
      h('div', { class: 'field' }, user), h('div', { class: 'field' }, pass), error,
      h('button', { class: 'primary', text: 'Sign in', onclick: submit })));
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    loginView();
  }

  function plansView() {
    var token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { loginView(); return; }
    show(h('p', { class: 'muted', text: 'Loading plans...' }));
    Promise.all([api('GET', '/api/public/tiers'), api('GET', '/api/payments/', undefined, token)]).then(function (both) {
      var tiers = both[0];
      var info = both[1];
      if (info.status === 401) { signOut(); return; }
      if (!tiers.ok || !info.ok) { show(h('p', { class: 'bad', text: failure(info.ok ? tiers : info) })); return; }
      renderPlans(token, tiers.data, info.data);
    });
  }

  function renderPlans(token, tiersPayload, info) {
    var tiers = (tiersPayload && tiersPayload.tiers) || tiersPayload || [];
    // A store method is bought inside the mobile app; only redirect methods are bought here.
    var methods = (info.methods || []).filter(function (m) { return (m.flow || 'redirect') === 'redirect'; });
    var subscription = info.subscription || null;
    var header = h('div', { class: 'row space' },
      h('h2', { text: 'Plans' }),
      h('button', { text: 'Sign out', onclick: signOut }));
    var cards = h('div', { class: 'plans' });
    if (!tiers.length) cards.appendChild(h('p', { class: 'muted', text: 'No plans on sale.' }));
    tiers.forEach(function (tier) {
      var current = subscription && (subscription.tierId === tier.id || subscription.tierName === tier.name);
      // A plan may be sold on the web for one period only; the server refuses the other anyway.
      var monthly = tier.webMonthlyEnabled === false ? null : money(tier.priceMonthlyCents, info.currency);
      var yearly = tier.webYearlyEnabled === false ? null : money(tier.priceYearlyCents, info.currency);
      var interval = h('select', {},
        monthly !== null ? h('option', { value: 'monthly', text: 'Monthly - ' + monthly }) : null,
        yearly !== null ? h('option', { value: 'yearly', text: 'Yearly - ' + yearly }) : null);
      var method = h('select', {},
        methods.map(function (m) { return h('option', { value: m.id, text: m.label }); }));
      var error = h('p', { class: 'bad', text: '' });
      function pay() {
        error.textContent = '';
        if (!interval.value || !method.value) { error.textContent = 'Pick how often and how.'; return; }
        api('POST', '/api/payments/checkout', { tierId: tier.id, interval: interval.value, methodId: method.value }, token).then(function (result) {
          if (!result.ok || !result.data) { error.textContent = failure(result); return; }
          var action = result.data.action || {};
          if (action.kind === 'redirect' && action.url) location.href = action.url;
          else if (action.kind === 'instructions') showInstructions(action);
          else plansView();
        });
      }
      var card = h('div', { class: 'card' },
        h('div', { class: 'row space' },
          h('strong', { text: tier.name }),
          current ? h('span', { class: 'tag current', text: 'current' }) : null),
        monthly !== null ? h('p', {}, h('span', { class: 'price', text: monthly }), ' / month') : null,
        yearly !== null ? h('p', { class: 'muted', text: yearly + ' / year' }) : null,
        h('div', { class: 'field' }, h('label', { text: 'How often' }, interval)),
        h('div', { class: 'field' }, h('label', { text: 'How' }, method)),
        error,
        h('button', { class: 'primary', text: current ? 'Renew' : 'Pay', onclick: pay }));
      cards.appendChild(card);
    });
    var children = [header, cards];
    if (subscription) {
      children.push(h('div', { class: 'card' },
        h('h2', { text: 'Your subscription' }),
        h('p', { text: 'Plan: ' + (subscription.tierName || subscription.tierId || '') }),
        h('p', { class: 'muted', text: (subscription.cancelAtPeriodEnd ? 'Ends: ' : 'Paid until: ') + new Date(subscription.paidUntil).toLocaleDateString() }),
        // Only a running subscription this server can stop is offered a stop; one bought in the store
        // is stopped in the store, and one already stopping has nothing left to stop.
        subscription.status === 'active' && !subscription.cancelAtPeriodEnd && subscription.canCancelHere
          ? h('button', { text: 'Stop renewing', onclick: function () {
              api('POST', '/api/payments/subscription/cancel', {}, token).then(function () { plansView(); });
            } })
          : null));
    }
    show.apply(null, children);
  }

  function showInstructions(action) {
    show(h('div', { class: 'card' },
      h('h2', { text: action.title || 'How to pay' }),
      h('p', { text: action.text || '' }),
      h('button', { class: 'primary', text: 'Back to plans', onclick: plansView })));
  }

  if (!base) show(h('p', { class: 'bad', text: 'This buy site was started without a Keres address.' }));
  else plansView();
})();
</script>`;
  const body =
    '<h1>' +
    escapeAttr(options.displayName) +
    '</h1>' +
    '<p class="muted">Plans, checkout and subscription - the same flow as the app.</p>' +
    '<div id="app"><p class="muted">Loading...</p></div>';
  return pageShell(options.displayName, banner, boot + body + script);
}

export function storeResultPage(title: string, message: string, backLabel: string): string {
  const banner = '';
  const body =
    '<div class="card"><h2>' +
    escapeAttr(title) +
    '</h2><p>' +
    escapeAttr(message) +
    '</p><a class="link-button" href="/">' +
    escapeAttr(backLabel) +
    '</a></div>';
  return pageShell(title, banner, body);
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
