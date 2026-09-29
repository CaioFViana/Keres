/**
 * The page code of the published reader, as strings (the reader is one self-contained HTML file).
 *
 * Three pieces: the part both readers share (the bridge to the showcase that keeps saves and
 * preferences, the panels, the theme and text size), the branching reader (one scene at a time
 * over `KeresEngine`) and the linear reader (the manuscript page with a bar and a remembered
 * place). Plain ES5-flavoured JavaScript, no dependencies, and nothing here touches the network:
 * the page runs sandboxed, without a storage of its own, and talks only to the page that embeds
 * it, by `postMessage` (see `readerBridge` below).
 */

/**
 * The reader keeps nothing itself: it asks the embedding showcase page for its saved list and
 * hands the whole list back whenever it changes. Without an embedding page (or an answer), the
 * reader works from memory and says its progress is not being kept.
 */
export const READER_COMMON_SOURCE = `
var readerBridge = (function () {
  var hasParent = window.parent && window.parent !== window;
  function load(callback) {
    if (!hasParent) { callback(null); return; }
    var done = false;
    function onMessage(event) {
      if (event.source !== window.parent) return;
      var message = event.data;
      if (!message || message.keresReader !== 1 || message.type !== 'saves') return;
      window.removeEventListener('message', onMessage);
      if (done) return;
      done = true;
      callback(Array.isArray(message.saves) ? message.saves : []);
    }
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ keresReader: 1, type: 'load' }, '*');
    setTimeout(function () {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      callback(null);
    }, 1500);
  }
  function write(list) {
    if (hasParent) window.parent.postMessage({ keresReader: 1, type: 'write', saves: list }, '*');
  }
  return { load: load, write: write };
})();

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

var readerPrefs = { theme: '', size: 100 };
function applyPrefs() {
  var root = document.documentElement;
  if (readerPrefs.theme) root.setAttribute('data-theme', readerPrefs.theme);
  else root.removeAttribute('data-theme');
  root.style.setProperty('--scale', String(readerPrefs.size / 100));
}
function readPrefs(list) {
  for (var i = 0; i < list.length; i += 1) {
    if (list[i] && list[i].kind === 'prefs') {
      var theme = list[i].theme;
      readerPrefs.theme = theme === 'dark' || theme === 'sepia' || theme === 'light' ? theme : '';
      var size = Number(list[i].size);
      readerPrefs.size = size >= 70 && size <= 200 ? size : 100;
    }
  }
  applyPrefs();
}
function writePrefs(list) {
  var rest = list.filter(function (entry) { return !entry || entry.kind !== 'prefs'; });
  rest.push({ id: 'prefs', kind: 'prefs', theme: readerPrefs.theme, size: readerPrefs.size });
  return rest;
}

// One sheet over the page: a title, a body the caller fills, a close button.
var sheet = (function () {
  var root = document.getElementById('sheet');
  var title = document.getElementById('sheet-title');
  var body = document.getElementById('sheet-body');
  var onClose = null;
  function close() {
    root.hidden = true;
    body.innerHTML = '';
    if (onClose) onClose();
    onClose = null;
  }
  document.getElementById('sheet-close').addEventListener('click', close);
  root.addEventListener('click', function (event) { if (event.target === root) close(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !root.hidden) close(); });
  return {
    open: function (heading, fill, closed) {
      title.textContent = heading;
      body.innerHTML = '';
      fill(body);
      onClose = closed || null;
      root.hidden = false;
    },
    close: close,
    isOpen: function () { return !root.hidden; }
  };
})();

function appearanceSheet(labels, persist) {
  sheet.open(labels.appearance, function (body) {
    var themes = el('div', 'row');
    [['', labels.themeAuto], ['light', labels.themeLight], ['dark', labels.themeDark], ['sepia', labels.themeSepia]].forEach(function (pair) {
      var button = el('button', 'pill' + (readerPrefs.theme === pair[0] ? ' on' : ''), pair[1]);
      button.addEventListener('click', function () {
        readerPrefs.theme = pair[0];
        applyPrefs();
        persist();
        appearanceSheet(labels, persist);
      });
      themes.appendChild(button);
    });
    body.appendChild(el('p', 'note', labels.theme));
    body.appendChild(themes);
    var sizes = el('div', 'row');
    var smaller = el('button', 'pill', 'A-');
    var larger = el('button', 'pill', 'A+');
    smaller.addEventListener('click', function () { readerPrefs.size = Math.max(70, readerPrefs.size - 10); applyPrefs(); persist(); });
    larger.addEventListener('click', function () { readerPrefs.size = Math.min(200, readerPrefs.size + 10); applyPrefs(); persist(); });
    body.appendChild(el('p', 'note', labels.textSize));
    sizes.appendChild(smaller);
    sizes.appendChild(larger);
    body.appendChild(sizes);
  });
}
`;

/** The branching reader: a scene at a time, its choices, a trail, an inventory and saves. */
export const READER_BRANCHING_SOURCE = `
(function () {
  var D = JSON.parse(document.getElementById('story-data').textContent);
  var L = D.labels;
  var E = KeresEngine;
  var view = document.getElementById('view');
  var steps = [];
  var snaps = [];
  var saves = [];
  var persistent = false;
  var loaded = false;

  function sceneOf(id) { return D.scenes[id]; }
  function sceneLabel(id, position) {
    var scene = sceneOf(id);
    return scene && scene.name ? scene.name : L.scene + ' ' + position;
  }
  function current() { return steps[steps.length - 1]; }
  function currentState() { return snaps[snaps.length - 1]; }

  function replay(list) {
    var out = [];
    var state = E.emptyState();
    for (var i = 0; i < list.length; i += 1) {
      var step = list[i];
      var scene = step && sceneOf(step.s);
      if (!scene) return null;
      if (i > 0 && step.c) state = E.applyEffects(state, D.choiceEffects[step.c] || []);
      state = E.enterScene(state, step.s, scene.effects || []);
      out.push(state);
    }
    return out;
  }

  function persist() {
    if (persistent) readerBridge.write(writePrefs(saves));
  }
  function autosave() {
    if (!steps.length) return;
    var entry = {
      id: 'auto', kind: 'auto', name: L.autosave, at: new Date().toISOString(),
      scene: sceneLabel(current().s, steps.length), count: steps.length, steps: steps.slice()
    };
    saves = saves.filter(function (save) { return save.id !== 'auto' || save.kind === 'prefs'; }).concat([entry]);
    persist();
  }
  function autosaveEntry() {
    for (var i = 0; i < saves.length; i += 1) if (saves[i].id === 'auto' && saves[i].kind === 'auto') return saves[i];
    return null;
  }

  function begin(sceneId) {
    var scene = sceneOf(sceneId);
    if (!scene) return;
    steps = [{ s: sceneId, c: null }];
    snaps = [E.enterScene(E.emptyState(), sceneId, scene.effects || [])];
    autosave();
    render();
  }
  function restore(list) {
    var rebuilt = replay(list);
    if (!rebuilt || !rebuilt.length) return false;
    steps = list.slice();
    snaps = rebuilt;
    render();
    return true;
  }
  function choose(choice) {
    var target = choice.to && sceneOf(choice.to);
    if (!target) return;
    var state = E.applyEffects(currentState(), D.choiceEffects[choice.i] || []);
    state = E.enterScene(state, choice.to, target.effects || []);
    steps.push({ s: choice.to, c: choice.i });
    snaps.push(state);
    autosave();
    render();
    window.scrollTo(0, 0);
  }
  function back() {
    if (steps.length < 2) return;
    steps.pop();
    snaps.pop();
    autosave();
    render();
  }
  function restart() {
    steps = [];
    snaps = [];
    render();
  }

  function startButtons(parent) {
    var options = D.start.options;
    if (D.start.prompt) parent.appendChild(el('p', 'prompt', D.start.prompt));
    options.forEach(function (option, index) {
      var label = D.start.prompt ? option.text : L.newGame;
      var button = el('button', 'choice primary', label);
      button.addEventListener('click', function () { begin(option.to); });
      parent.appendChild(button);
    });
  }

  function renderStart() {
    view.innerHTML = '';
    var box = el('div', 'start');
    box.appendChild(el('h1', 'story-title', D.title));
    if (D.author) box.appendChild(el('p', 'byline', D.author));
    var auto = autosaveEntry();
    if (auto) {
      var again = el('button', 'choice primary', L.continueLabel + ' — ' + auto.scene);
      again.addEventListener('click', function () { if (!restore(auto.steps)) begin(D.start.options[0].to); });
      box.appendChild(again);
    }
    if (D.start.prompt) {
      startButtons(box);
    } else if (D.start.options.length) {
      var fresh = el('button', 'choice' + (auto ? '' : ' primary'), L.newGame);
      fresh.addEventListener('click', function () { begin(D.start.options[0].to); });
      box.appendChild(fresh);
    } else {
      box.appendChild(el('p', 'note', L.empty));
    }
    var open = el('button', 'choice', L.saves);
    open.addEventListener('click', savesSheet);
    box.appendChild(open);
    view.appendChild(box);
    syncBar();
  }

  function renderPlay() {
    var step = current();
    var scene = sceneOf(step.s);
    var state = currentState();
    view.innerHTML = '';
    var page = el('article', 'scene');
    if (scene.name) page.appendChild(el('h2', 'scene-name', scene.name));
    var text = el('div', 'text');
    text.innerHTML = scene.html;
    page.appendChild(text);
    if (scene.choices.length) {
      var list = el('div', 'choices');
      scene.choices.forEach(function (choice) {
        var open = choice.to && sceneOf(choice.to) && E.isAvailable(D.choiceRules[choice.i] || [], state);
        var button = el('button', 'choice' + (open ? '' : ' closed'), choice.text);
        if (!open) button.disabled = true;
        else button.addEventListener('click', function () { choose(choice); });
        list.appendChild(button);
      });
      page.appendChild(list);
    } else {
      var end = el('div', 'the-end');
      end.appendChild(el('p', 'end-mark', L.theEnd));
      var again = el('button', 'choice', L.newGame);
      again.addEventListener('click', restart);
      end.appendChild(again);
      var load = el('button', 'choice', L.saves);
      load.addEventListener('click', savesSheet);
      end.appendChild(load);
      page.appendChild(end);
    }
    view.appendChild(page);
    syncBar();
  }

  function render() {
    if (steps.length) renderPlay(); else renderStart();
  }

  var bar = {
    back: document.getElementById('act-back'),
    path: document.getElementById('act-path'),
    bag: document.getElementById('act-bag'),
    saves: document.getElementById('act-saves'),
    look: document.getElementById('act-look'),
    home: document.getElementById('act-home')
  };
  function syncBar() {
    var playing = steps.length > 0;
    bar.back.disabled = steps.length < 2;
    bar.path.disabled = !playing;
    bar.bag.disabled = !playing;
    bar.home.disabled = !playing;
  }

  function pathSheet() {
    sheet.open(L.path, function (body) {
      var list = el('ol', 'trail');
      steps.forEach(function (step, index) {
        var item = el('li', index === steps.length - 1 ? 'here' : '', sceneLabel(step.s, index + 1));
        list.appendChild(item);
      });
      body.appendChild(list);
    });
  }
  function bagSheet() {
    sheet.open(L.inventory, function (body) {
      var names = currentState().inventory.map(function (id) { return D.items[id]; }).filter(Boolean);
      if (!names.length) { body.appendChild(el('p', 'note', L.inventoryEmpty)); return; }
      var list = el('ul', 'bag');
      names.forEach(function (name) { list.appendChild(el('li', '', name)); });
      body.appendChild(list);
    });
  }
  function savesSheet() {
    sheet.open(L.saves, function (body) {
      if (loaded && !persistent) body.appendChild(el('p', 'note', L.notSaving));
      if (steps.length) {
        var form = el('div', 'row');
        var input = el('input', 'name');
        input.type = 'text';
        input.maxLength = 60;
        input.placeholder = L.saveName;
        var save = el('button', 'pill on', L.save);
        save.addEventListener('click', function () {
          var manual = saves.filter(function (entry) { return entry.kind === 'manual'; });
          if (manual.length >= 30) {
            manual.sort(function (a, b) { return a.at < b.at ? -1 : 1; });
            saves = saves.filter(function (entry) { return entry !== manual[0]; });
          }
          var name = input.value.replace(/^\\s+|\\s+$/g, '') || sceneLabel(current().s, steps.length);
          saves.push({
            id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
            kind: 'manual', name: name.slice(0, 60), at: new Date().toISOString(),
            scene: sceneLabel(current().s, steps.length), count: steps.length, steps: steps.slice()
          });
          persist();
          savesSheet();
        });
        form.appendChild(input);
        form.appendChild(save);
        body.appendChild(form);
      }
      var shown = saves.filter(function (entry) { return entry.kind === 'auto' || entry.kind === 'manual'; })
        .sort(function (a, b) { return a.at < b.at ? 1 : -1; });
      if (!shown.length) { body.appendChild(el('p', 'note', L.noSaves)); return; }
      var list = el('ul', 'saves');
      shown.forEach(function (entry) {
        var item = el('li', 'save');
        var info = el('div', 'info');
        info.appendChild(el('strong', '', entry.name));
        var when = new Date(entry.at);
        info.appendChild(el('span', 'meta', entry.scene + ' · ' + entry.count + ' ' + L.stepsWord + ' · ' + (isNaN(when.getTime()) ? '' : when.toLocaleString())));
        item.appendChild(info);
        var load = el('button', 'pill', L.load);
        load.addEventListener('click', function () { if (restore(entry.steps)) { autosave(); sheet.close(); } });
        item.appendChild(load);
        if (entry.kind === 'manual') {
          var remove = el('button', 'pill', L.remove);
          remove.addEventListener('click', function () {
            saves = saves.filter(function (other) { return other !== entry; });
            persist();
            savesSheet();
          });
          item.appendChild(remove);
        }
        list.appendChild(item);
      });
      body.appendChild(list);
    });
  }

  bar.back.addEventListener('click', back);
  bar.path.addEventListener('click', pathSheet);
  bar.bag.addEventListener('click', bagSheet);
  bar.saves.addEventListener('click', savesSheet);
  bar.home.addEventListener('click', restart);
  bar.look.addEventListener('click', function () { appearanceSheet(L, persist); });

  render();
  readerBridge.load(function (list) {
    loaded = true;
    persistent = list !== null;
    saves = list || [];
    readPrefs(saves);
    if (!steps.length) render();
  });
})();
`;

/** The linear reader: the manuscript page, a bar, and the place the reader left off. */
export const READER_LINEAR_SOURCE = `
(function () {
  var D = JSON.parse(document.getElementById('story-data').textContent);
  var L = D.labels;
  var saves = [];
  var persistent = false;
  var timer = 0;

  function place() {
    var height = document.documentElement.scrollHeight - window.innerHeight;
    return height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
  }
  function persist() {
    if (persistent) readerBridge.write(writePrefs(saves));
  }
  function remember() {
    var entry = { id: 'auto', kind: 'auto', name: L.autosave, at: new Date().toISOString(), place: place() };
    saves = saves.filter(function (save) { return save.kind === 'prefs'; }).concat([entry]);
    persist();
  }
  window.addEventListener('scroll', function () {
    clearTimeout(timer);
    timer = setTimeout(remember, 600);
  }, { passive: true });

  var toc = document.querySelector('nav.toc');
  var contents = document.getElementById('act-contents');
  if (toc) contents.addEventListener('click', function () { toc.scrollIntoView(); });
  else contents.hidden = true;
  document.getElementById('act-look').addEventListener('click', function () { appearanceSheet(L, persist); });

  readerBridge.load(function (list) {
    persistent = list !== null;
    saves = list || [];
    readPrefs(saves);
    for (var i = 0; i < saves.length; i += 1) {
      if (saves[i].kind === 'auto' && typeof saves[i].place === 'number') {
        var target = saves[i].place;
        setTimeout(function () {
          var height = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, height * target);
        }, 0);
      }
    }
  });
})();
`;
