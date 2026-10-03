/**
 * The demo provider's page, at `/buy`: one HTML file with its script and styles inline, so there is nothing to
 * build and it works wherever the API runs. It plays two parts, which a real flow also splits:
 *
 *   - the app's part, with the person signed in: choose a plan (the current one marked), how often, and a
 *     method, and open the payment through the same `/api/payments` the Keres client uses;
 *   - the provider's part, `?charge=<id>`: the payment itself, and the buttons that stand in for the bank.
 *
 * Written with no backticks and no template placeholders on purpose: this is a template literal in TypeScript,
 * and the script inside it must not be interpreted by it. Everything the server sends is put on the page with
 * `textContent`, never as markup.
 */
export const DEMO_PAY_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demo Pay</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f5fa; --card: #fff; --text: #1d1b22; --muted: #6a6676; --line: #dcd8e6; --accent: #5b3fd1; --ok: #1b7f4b; --bad: #b3261e; }
  @media (prefers-color-scheme: dark) { :root { --bg: #17151c; --card: #211e29; --text: #ece9f4; --muted: #a39eb3; --line: #38334a; --accent: #a590ff; --ok: #5fd196; --bad: #ff8a80; } }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.45 system-ui, sans-serif; background: var(--bg); color: var(--text); }
  .banner { background: var(--bad); color: #fff; padding: 8px 16px; font-size: 13px; text-align: center; }
  main { max-width: 720px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin: 12px 0; }
  .muted { color: var(--muted); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .row.space { justify-content: space-between; }
  button, .link-button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; text-decoration: none; display: inline-block; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  button.debug { border-style: dashed; }
  button:disabled { opacity: .5; cursor: default; }
  input[type=text], input[type=password] { font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); width: 100%; }
  label { display: block; margin: 6px 0; }
  .field { margin: 8px 0; }
  .code { font-family: ui-monospace, monospace; word-break: break-all; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin: 8px 0; }
  .ok { color: var(--ok); } .bad { color: var(--bad); }
  .tag { display: inline-block; font-size: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; margin-left: 6px; }
  .tag.current { border-color: var(--accent); color: var(--accent); }
  table { width: 100%; border-collapse: collapse; } td, th { text-align: left; padding: 6px 4px; border-top: 1px solid var(--line); vertical-align: top; }
</style>
</head>
<body>
<div class="banner">DEMO PAYMENT PROVIDER - nothing here is real. Anyone signed in can mark their own payment as paid, so plans are granted for free. Never enable this on a server people really use.</div>
<main>
  <h1>Demo Pay</h1>
  <p class="muted" id="subtitle">A fake payment provider, to see the payment flow working.</p>
  <div id="app"><p class="muted">Loading...</p></div>
</main>
<script>
(function () {
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);

  function h(tag, attrs) {
    var node = document.createElement(tag);
    var attributes = attrs || {};
    Object.keys(attributes).forEach(function (key) {
      if (key === 'class') node.className = attributes[key];
      else if (key === 'onclick') node.addEventListener('click', attributes[key]);
      else if (key === 'text') node.textContent = attributes[key];
      else node.setAttribute(key, attributes[key]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function api(method, path, body) {
    var options = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      options.headers['content-type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return fetch(path, options).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        return { status: response.status, ok: response.ok, data: data };
      });
    });
  }

  function money(cents, currency) { return (cents / 100).toFixed(2) + ' ' + currency; }
  function day(iso) { return iso ? new Date(iso).toLocaleDateString() : ''; }
  function show() {
    app.textContent = '';
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) app.appendChild(arguments[i]);
  }
  function message(text, kind) { return h('p', { class: kind || 'muted', text: text }); }
  function failure(result) {
    return (result.data && result.data.message) || ('Something went wrong (' + result.status + ').');
  }

  /* ---------- sign in ---------- */
  function loginView(note) {
    var user = h('input', { type: 'text', autocomplete: 'username', placeholder: 'username' });
    var pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'password' });
    var error = h('p', { class: 'bad', text: note || '' });
    function submit() {
      api('POST', '/api/auth/login', { username: user.value.trim(), password: pass.value }).then(function (result) {
        if (result.ok) location.reload();
        else error.textContent = 'Could not sign in. Check the username and password.';
      });
    }
    pass.addEventListener('keydown', function (event) { if (event.key === 'Enter') submit(); });
    show(h('div', { class: 'card' },
      h('h2', { text: 'Sign in with your Keres account' }),
      h('p', { class: 'muted', text: 'The same username and password as in the app, on this server.' }),
      h('div', { class: 'field' }, user), h('div', { class: 'field' }, pass), error,
      h('button', { class: 'primary', text: 'Sign in', onclick: submit })));
  }

  /* ---------- the app's part: choose a plan ---------- */
  function homeView(me, info, tiers) {
    var subscription = info.subscription;
    var nodes = [];

    nodes.push(h('div', { class: 'row space' },
      h('span', { text: 'Signed in as ' + me.user.username }),
      h('button', { text: 'Sign out', onclick: function () { api('POST', '/api/auth/logout').then(function () { location.reload(); }); } })));

    var current = h('div', { class: 'card' }, h('h2', { text: 'Your plan' }));
    if (subscription) {
      current.appendChild(h('p', { text: subscription.tierName + ' (' + subscription.interval + ') - ' + subscription.status +
        ', paid until ' + day(subscription.paidUntil) + (subscription.cancelAtPeriodEnd ? ', not renewing' : '') + '.' }));
      if (subscription.status === 'due') current.appendChild(message('The paid period ran out: the server\\'s default plan applies until a payment arrives.', 'bad'));
    } else {
      current.appendChild(message('No paid plan. The server\\'s default plan applies.'));
    }
    nodes.push(current);

    var chosen = { tierId: null, interval: 'monthly', methodId: info.methods.length ? info.methods[0].id : null };
    var note = h('p', { class: 'bad' });
    var start = h('button', { class: 'primary', text: 'Create the payment', disabled: 'disabled' });

    function refreshStart() {
      if (chosen.tierId && chosen.methodId) start.removeAttribute('disabled'); else start.setAttribute('disabled', 'disabled');
    }

    var plans = h('div', { class: 'card' }, h('h2', { text: 'Choose a plan' }));
    var sellable = tiers.tiers.filter(function (tier) { return tier.priceMonthlyCents > 0 || (tier.priceYearlyCents || 0) > 0; });
    if (!sellable.length) plans.appendChild(message('This server has no plans for sale. Make one in the admin panel (Tiers) and mark it for sale, with a price.'));
    sellable.forEach(function (tier) {
      var isCurrent = subscription && subscription.tierId === tier.id && subscription.status !== 'canceled';
      var action = isCurrent ? 'Renew (extends from the end of the paid period)' : subscription && subscription.status === 'active' ? 'Switch to this plan' : 'Subscribe';
      var prices = [];
      if (tier.priceMonthlyCents > 0) prices.push({ interval: 'monthly', cents: tier.priceMonthlyCents });
      if (tier.priceYearlyCents > 0) prices.push({ interval: 'yearly', cents: tier.priceYearlyCents });
      var box = h('div', { class: 'card' },
        h('div', { class: 'row space' }, h('strong', { text: tier.name }), isCurrent ? h('span', { class: 'tag current', text: 'your plan' }) : null),
        h('p', { class: 'muted', text: action + '.' }));
      prices.forEach(function (price) {
        var radio = h('input', { type: 'radio', name: 'plan' });
        radio.addEventListener('change', function () { chosen.tierId = tier.id; chosen.interval = price.interval; refreshStart(); });
        box.appendChild(h('label', null, radio, ' ' + money(price.cents, tiers.currency) + ' / ' + (price.interval === 'monthly' ? 'month' : 'year')));
      });
      plans.appendChild(box);
    });
    nodes.push(plans);

    var methods = h('div', { class: 'card' }, h('h2', { text: 'How to pay' }));
    info.methods.forEach(function (method, index) {
      var radio = h('input', { type: 'radio', name: 'method' });
      if (index === 0) radio.setAttribute('checked', 'checked');
      radio.addEventListener('change', function () { chosen.methodId = method.id; refreshStart(); });
      methods.appendChild(h('label', null, radio, ' ' + method.label, method.description ? h('span', { class: 'muted', text: ' - ' + method.description }) : null));
    });
    nodes.push(methods);

    start.addEventListener('click', function () {
      note.textContent = '';
      api('POST', '/api/payments/checkout', { tierId: chosen.tierId, interval: chosen.interval, methodId: chosen.methodId }).then(function (result) {
        if (!result.ok) { note.textContent = failure(result); return; }
        // The provider knows the attempt by Keres' id, so the page can open its payment whatever the action was.
        location.href = '/buy?charge=' + encodeURIComponent(result.data.id);
      });
    });
    nodes.push(h('div', { class: 'row' }, start, note));

    nodes.push(providerDesk(me));
    show.apply(null, nodes);
  }

  /* ---------- the provider's own desk: subscriptions, renewals, debug levers ---------- */
  function providerDesk(me) {
    var desk = h('div', { class: 'card' }, h('h2', { text: 'At the provider (debug)' }),
      h('p', { class: 'muted', text: 'What the provider holds for you, and the things it does on its own schedule.' }));

    var list = h('div');
    function reload() {
      api('GET', '/buy/api/mine').then(function (result) {
        list.textContent = '';
        if (!result.ok) { list.appendChild(message(failure(result), 'bad')); return; }
        var subscriptions = result.data.subscriptions;
        var open = result.data.open;
        if (!subscriptions.length && !open.length) list.appendChild(message('Nothing yet: pay for a plan first.'));
        subscriptions.forEach(function (sub) {
          var row = h('div', { class: 'card' },
            h('div', { class: 'row space' }, h('strong', { text: sub.tierName + ' (' + sub.interval + ')' }), h('span', { class: 'tag', text: sub.status })),
            h('p', { class: 'muted', text: sub.id + ' - ' + money(sub.amountCents, sub.currency) + ' - ' + (sub.autoCharge ? 'saved card, charged by the provider' : sub.methodId + ', paid again each time') }));
          if (sub.status === 'active') {
            row.appendChild(h('div', { class: 'row' },
              h('button', { class: 'debug', text: sub.autoCharge ? 'Charge the renewal (works)' : 'Send the renewal to pay', onclick: function () { act('POST', '/buy/api/subscription/' + sub.id + '/renew', { outcome: 'paid' }, reload); } }),
              sub.autoCharge ? h('button', { class: 'debug', text: 'Charge the renewal (declined)', onclick: function () { act('POST', '/buy/api/subscription/' + sub.id + '/renew', { outcome: 'failed' }, reload); } }) : null,
              h('button', { class: 'debug', text: 'Cancel at the provider', onclick: function () { act('POST', '/buy/api/subscription/' + sub.id + '/cancel', {}, reload); } })));
          }
          list.appendChild(row);
        });
        open.forEach(function (charge) {
          list.appendChild(h('div', { class: 'card' },
            h('strong', { text: 'Waiting to be paid: ' + charge.tierName + ' - ' + money(charge.amountCents, charge.currency) + ' (' + charge.kind + ')' }),
            h('div', { class: 'row' }, h('a', { class: 'link-button', href: '/buy?charge=' + encodeURIComponent(charge.id), text: 'Open the payment' }))));
        });
      });
    }
    function act(method, path, body, done) {
      api(method, path, body).then(function (result) {
        if (!result.ok) alert(failure(result));
        else if (result.data && result.data.delivery && !result.data.delivery.ok) alert('The server did not accept the provider\\'s notice (status ' + result.data.delivery.status + ').');
        if (done) done();
      });
    }
    desk.appendChild(list);
    desk.appendChild(h('div', { class: 'row' },
      h('button', { class: 'debug', text: 'Make my paid period run out now', onclick: function () {
        act('POST', '/buy/api/mine/lapse', {}, function () { location.reload(); });
      } }),
      h('span', { class: 'muted', text: 'Not something a provider does: it lets you see the late-payment side without waiting a month.' })));
    reload();
    return desk;
  }

  /* ---------- the provider's part: the payment itself ---------- */
  function chargeView(chargeId) {
    api('GET', '/buy/api/charge/' + encodeURIComponent(chargeId)).then(function (result) {
      if (!result.ok) { show(message(failure(result), 'bad'), h('a', { href: '/buy', text: 'Back' })); return; }
      var charge = result.data;
      var body = h('div', { class: 'card' },
        h('h2', { text: charge.kind === 'renewal' ? 'Renewal' : 'Payment' }),
        h('p', { text: charge.tierName + ' (' + charge.interval + ') for ' + charge.payerName + ' - ' + money(charge.amountCents, charge.currency) }));

      if (charge.status === 'paid') {
        body.appendChild(h('p', { class: 'ok', text: 'Paid. You subscribed to ' + charge.tierName + ' (' + charge.interval + ') for user ' + charge.payerName + '.' }));
        paidDetails(body);
        show(body, h('a', { class: 'link-button', href: '/buy', text: 'Back' }));
        return;
      }
      if (charge.status !== 'open') {
        body.appendChild(message('This payment is ' + charge.status + (charge.failureReason ? ' (' + charge.failureReason + ')' : '') + '.', 'bad'));
        show(body, h('a', { class: 'link-button', href: '/buy', text: 'Back' }));
        return;
      }

      if (charge.methodId === 'card') {
        body.appendChild(message('Test card ending in 4242 - simulated: no card number is asked or kept. The provider keeps this card for the renewals.'));
      } else {
        body.appendChild(message(charge.methodId === 'pix' ? 'PIX code (made up):' : 'Boleto line (made up):'));
        body.appendChild(h('div', { class: 'code', text: charge.code || '' }));
        body.appendChild(h('button', { text: 'Copy', onclick: function () { if (navigator.clipboard) navigator.clipboard.writeText(charge.code || ''); } }));
      }

      var status = h('p', { class: 'muted' });
      function settle(path, label) {
        status.textContent = 'Sending the notice to the server...';
        api('POST', path, {}).then(function (outcome) {
          if (!outcome.ok) { status.textContent = failure(outcome); status.className = 'bad'; return; }
          chargeView(chargeId);
        });
      }
      body.appendChild(h('div', { class: 'row' },
        h('button', { class: 'primary debug', text: 'Debug: confirm that this was paid', onclick: function () { settle('/buy/api/charge/' + encodeURIComponent(chargeId) + '/pay'); } }),
        h('button', { class: 'debug', text: 'Debug: the payment failed', onclick: function () { settle('/buy/api/charge/' + encodeURIComponent(chargeId) + '/fail'); } }),
        h('button', { class: 'debug', text: 'Debug: let it expire', onclick: function () { settle('/buy/api/charge/' + encodeURIComponent(chargeId) + '/expire'); } })));
      body.appendChild(status);
      show(body, h('a', { class: 'link-button', href: '/buy', text: 'Back' }));
    });
  }

  /* After a payment, what the server now says - only when the person is signed in here. */
  function paidDetails(body) {
    api('GET', '/api/payments').then(function (result) {
      if (!result.ok || !result.data.subscription) return;
      var sub = result.data.subscription;
      body.appendChild(message('On the server: ' + sub.tierName + ', ' + sub.status + ', paid until ' + day(sub.paidUntil) + '. It is in the admin panel under Payments.', 'ok'));
    });
  }

  /* ---------- start ---------- */
  var chargeId = params.get('charge');
  if (chargeId) {
    chargeView(chargeId);
  } else {
    api('GET', '/buy/api/mine').then(function (me) {
      if (me.status === 401) { loginView(); return; }
      if (!me.ok) { show(message(failure(me), 'bad')); return; }
      Promise.all([api('GET', '/api/payments'), api('GET', '/api/public/tiers')]).then(function (both) {
        if (!both[0].ok || !both[1].ok) { show(message('Could not read the plans from the server.', 'bad')); return; }
        if (!both[0].data.enabled) { show(message('Payments are not enabled on this server.', 'bad')); return; }
        homeView(me.data, both[0].data, both[1].data);
      });
    });
  }
})();
</script>
</body>
</html>
`;
