/**
 * The page code of the published reader of a comic or a storyboard: one more piece beside the ones in
 * `readerApp.ts`, run after `READER_COMMON_SOURCE` (it uses its panels, its bridge and its preferences).
 */

/**
 * The reader of a comic or a storyboard: the manuscript's pages (or openings), one at a time, with the buttons
 * and the keys of a book: the arrows, the page-turn keys, a swipe. Everything between two pages (a heading, a
 * line of prose) is read with the page that follows it. The script of a planning sheet can be put away, and the
 * place is the page last read.
 */
export const READER_COMIC_SOURCE = `
(function () {
  var D = JSON.parse(document.getElementById('story-data').textContent);
  var L = D.labels;
  var view = document.getElementById('view');
  var saves = [];
  var persistent = false;

  // The units: each page (or opening), with whatever comes before it since the last one. What trails the last
  // page rides with it.
  var nodes = Array.prototype.slice.call(view.children);
  var units = [];
  var lead = 0;
  nodes.forEach(function (node, index) {
    if (node.tagName === 'NAV') return;
    if (node.matches('figure.page, section.spread, figure.cover')) {
      units.push({ from: lead, to: index });
      lead = index + 1;
    }
  });
  if (units.length === 0) return;
  units[units.length - 1].to = nodes.length - 1;
  view.className = (view.className ? view.className + ' ' : '') + 'paged';

  var counter = document.getElementById('counter');
  var previous = document.getElementById('act-prev');
  var following = document.getElementById('act-next');
  var scriptButton = document.getElementById('act-script');
  var here = document.getElementById('here');
  var current = 0;
  var scripted = !!view.querySelector('.script');
  if (scriptButton) scriptButton.hidden = !scripted;

  function persist() {
    if (!persistent) return;
    var entry = { id: 'auto', kind: 'auto', name: L.autosave, at: new Date().toISOString(), place: units.length > 1 ? current / (units.length - 1) : 0 };
    saves = saves.filter(function (save) { return save.kind === 'prefs'; }).concat([entry]);
    readerBridge.write(writePrefs(saves));
  }
  function show(index, scroll) {
    current = Math.max(0, Math.min(units.length - 1, index));
    var unit = units[current];
    nodes.forEach(function (node, at) { node.hidden = node.tagName === 'NAV' || at < unit.from || at > unit.to; });
    counter.textContent = (current + 1) + ' / ' + units.length;
    previous.disabled = current === 0;
    following.disabled = current === units.length - 1;
    var heading = '';
    for (var at = unit.from; at <= unit.to; at += 1) {
      if (nodes[at].matches && nodes[at].matches('h2.chapter, h3.scene')) heading = nodes[at].textContent;
    }
    if (heading) here.textContent = heading;
    if (scroll !== false) window.scrollTo(0, 0);
    persist();
  }
  function turn(delta) { show(current + delta); }
  previous.addEventListener('click', function () { turn(-1); });
  following.addEventListener('click', function () { turn(1); });
  if (scriptButton) {
    scriptButton.addEventListener('click', function () {
      var off = view.classList.toggle('hide-script');
      scriptButton.classList.toggle('on', !off);
    });
    scriptButton.classList.add('on');
  }
  document.addEventListener('keydown', function (event) {
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { turn(1); event.preventDefault(); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { turn(-1); event.preventDefault(); }
    else if (event.key === 'Home') { show(0); event.preventDefault(); }
    else if (event.key === 'End') { show(units.length - 1); event.preventDefault(); }
  });
  var startX = null;
  var startY = null;
  view.addEventListener('touchstart', function (event) {
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });
  view.addEventListener('touchend', function (event) {
    if (startX === null) return;
    var dx = event.changedTouches[0].clientX - startX;
    var dy = event.changedTouches[0].clientY - startY;
    startX = null;
    // A swipe across, not a scroll down: far enough and flatter than it is long.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  }, { passive: true });

  // The contents open as a sheet over the reading, each entry a jump to the page its heading sits with.
  var toc = document.querySelector('nav.toc');
  var contents = document.getElementById('act-contents');
  if (toc) {
    contents.addEventListener('click', function () {
      sheet.open(L.contents, function (body) {
        var list = el('ul', 'contents');
        Array.prototype.forEach.call(toc.querySelectorAll('a'), function (link) {
          var item = el('li', link.parentNode.className);
          var go = el('button', '', link.textContent);
          go.addEventListener('click', function () {
            sheet.close();
            var target = document.getElementById(link.getAttribute('href').slice(1));
            if (!target) return;
            var top = target;
            while (top.parentNode && top.parentNode !== view) top = top.parentNode;
            var at = nodes.indexOf(top);
            for (var i = 0; i < units.length; i += 1) {
              if (at >= units[i].from && at <= units[i].to) { show(i); return; }
            }
          });
          item.appendChild(go);
          list.appendChild(item);
        });
        body.appendChild(list);
      });
    });
  } else contents.hidden = true;
  document.getElementById('act-look').addEventListener('click', function () { appearanceSheet(L, persist); });

  show(0, false);
  readerBridge.load(function (list) {
    persistent = list !== null;
    saves = list || [];
    readPrefs(saves);
    for (var i = 0; i < saves.length; i += 1) {
      if (saves[i].kind === 'auto' && typeof saves[i].place === 'number') {
        show(Math.round(saves[i].place * (units.length - 1)), false);
      }
    }
  });
})();
`;
