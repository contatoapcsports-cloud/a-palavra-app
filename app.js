/* Palavra Viva: app (interface + leitura + estudo). Offline primeiro. Sem dependências externas.
   Regras do plano: conteúdo só entra se o hash conferir; aba sem conteúdo não aparece; o último conteúdo válido nunca é descartado. */
(function () {
  'use strict';
  var core = window.PVCore, BK = window.PVBooks;
  var CONTENT = 'pv4-content', MEDIA = 'pv4-media';
  var APP_VERSION = '__SHELL_HASH__';
  var SHIELD = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>';

  /* ---------- utilitários ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignora */ } }
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function copy(text, okMsg) {
    var ok = function () { toast(okMsg); };
    var fallback = function () {
      var a = document.createElement('textarea'); a.value = text; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(a); a.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('Não foi possível copiar.'); }
      a.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  }
  function relPath(url) { var base = new URL('./', location.href).pathname; var p = new URL(url).pathname; return p.indexOf(base) === 0 ? p.slice(base.length) : p.replace(/^\//, ''); }

  /* ---------- configuração (dono, contato, Pix, áudio): arquivo config.json ---------- */
  var cfg = { ownerName: '', year: '', contactEmail: 'contato.palavravivabr@gmail.com', pixKey: '', siteUrl: '', audio: [] };
  async function loadConfig() {
    try {
      var r = await fetch('config.json');
      if (r.ok) { var j = await r.json(); Object.keys(cfg).forEach(function (k) { if (j[k] != null) cfg[k] = j[k]; }); }
    } catch (e) { /* sem config: usa o padrão */ }
  }

  /* ---------- aparência ---------- */
  function applyAppearance() {
    var s = parseFloat(lsGet('pv4-fs', '1.125')); if (!(s >= 1 && s <= 1.5)) s = 1.125;
    document.documentElement.style.setProperty('--fs', s + 'rem');
    $$('#fsz button').forEach(function (b) { b.setAttribute('aria-pressed', String(parseFloat(b.dataset.s) === s)); });
    var m = lsGet('pv4-theme', 'auto');
    if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m); else { m = 'auto'; document.documentElement.removeAttribute('data-theme'); }
    $$('#thm button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === m)); });
    var dark = m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', dark ? '#12191A' : '#1F4D43');
  }

  /* ---------- IndexedDB: destaques, anotações, onde parei (prefixo pv4-) ---------- */
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var q = indexedDB.open('pv4-reader', 1);
      q.onupgradeneeded = function () { var d = q.result; ['kv', 'highlights', 'notes'].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }); };
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) { return new Promise(function (res, rej) {
      var t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s);
      t.oncomplete = function () { res(r && r.result); }; t.onerror = function () { rej(t.error); };
    }); });
  }
  function kvGet(k) { return tx('kv', 'readonly', function (s) { return s.get(k); }).catch(function () { return null; }); }
  function kvSet(k, v) { return tx('kv', 'readwrite', function (s) { return s.put(v, k); }).catch(function () { /* sem DB: segue */ }); }
  function hlAll() {
    return db().then(function (d) { return new Promise(function (res) {
      var out = {}, c = d.transaction('highlights', 'readonly').objectStore('highlights').openCursor();
      c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = true; cur.continue(); } else res(out); };
      c.onerror = function () { res(out); };
    }); }).catch(function () { return {}; });
  }
  function hlSet(key, on) { return tx('highlights', 'readwrite', function (s) { return on ? s.put(true, key) : s.delete(key); }).catch(function () { toast('Não foi possível salvar o destaque neste aparelho.'); }); }
  function exportAll() {
    return db().then(function (d) {
      var out = { app: 'palavra-viva', version: 1, exportedAt: new Date().toISOString(), kv: {}, highlights: {}, notes: {} };
      return Promise.all(['kv', 'highlights', 'notes'].map(function (name) { return new Promise(function (res) {
        var c = d.transaction(name, 'readonly').objectStore(name).openCursor();
        c.onsuccess = function () { var cur = c.result; if (cur) { out[name][cur.key] = cur.value; cur.continue(); } else res(); };
        c.onerror = function () { res(); };
      }); })).then(function () { return out; });
    });
  }
  function importAll(obj) {
    if (!obj || obj.app !== 'palavra-viva' || obj.version !== 1) return Promise.reject(new Error('Arquivo de backup inválido.'));
    return db().then(function (d) { return new Promise(function (res, rej) {
      var t = d.transaction(['kv', 'highlights', 'notes'], 'readwrite');
      ['kv', 'highlights', 'notes'].forEach(function (n) { var s = t.objectStore(n); Object.keys(obj[n] || {}).forEach(function (k) { s.put(obj[n][k], k); }); });
      t.oncomplete = res; t.onerror = function () { rej(t.error); };
    }); });
  }

  /* ---------- pacotes de conteúdo ---------- */
  var manifest = null, pkgBy = {};
  function indexManifest() { pkgBy = {}; (manifest.packages || []).forEach(function (p) { pkgBy[p.path] = p; }); }
  async function loadPackage(entry, offlineOnly) {
    var c = await caches.open(CONTENT);
    var hit = await c.match(entry.path);
    if (hit) {
      var hb = new Uint8Array(await hit.clone().arrayBuffer());
      if ((await core.verifyPackage(hb, entry)).ok) return JSON.parse(new TextDecoder().decode(hb));
      await c.delete(entry.path); // cópia local corrompida: descarta só ela e baixa de novo
    }
    if (offlineOnly) throw new Error('não está neste aparelho');
    var r;
    try { r = await fetch(entry.path, { cache: 'no-store' }); } catch (e) { throw new Error('Sem internet e este conteúdo ainda não foi baixado. Use "Baixar para ler sem internet" quando estiver conectado.'); }
    if (!r.ok) throw new Error('Não foi possível carregar este conteúdo. Tente de novo em instantes.');
    var bytes = new Uint8Array(await r.clone().arrayBuffer());
    var v = await core.verifyPackage(bytes, entry);
    if (!v.ok) throw new Error('Conteúdo recusado: não confere com o manifesto (' + v.reason + ').');
    await c.put(entry.path, r);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  async function syncManifest() {
    var c = await caches.open(CONTENT);
    var stored = null, s = await c.match('content-manifest.json');
    if (s) { try { stored = await s.json(); } catch (e) { stored = null; } }
    var incoming = null;
    try { var r = await fetch('content-manifest.json', { cache: 'no-store' }); if (r.ok) incoming = await r.json(); } catch (e) { /* offline */ }
    if (!incoming) return stored;
    var cached = (await c.keys()).map(function (rq) { return relPath(rq.url); }).filter(function (p) { return p.indexOf('content/') === 0; });
    var plan = core.planUpdate(stored, incoming, cached);
    if (plan.accept) {
      for (var i = 0; i < plan.remove.length; i++) await c.delete(plan.remove[i]);
      await c.put('content-manifest.json', new Response(JSON.stringify(incoming), { headers: { 'content-type': 'application/json' } }));
      return incoming;
    }
    return stored || incoming;
  }

  /* ---------- catálogo: 66 livros + livros de teste do manifesto ---------- */
  function catalog() {
    var avail = {}; manifest.bible.forEach(function (b) { avail[b.id] = b; });
    var list = BK.all().map(function (b) {
      var e = avail[b.id];
      return { id: b.id, name: b.name, abbr: b.abbr, testament: b.testament, total: b.chapters, chapters: e ? e.chapters.map(function (c) { return c.n; }) : [], entry: e || null };
    });
    manifest.bible.forEach(function (b) {
      if (!BK.byId(b.id)) list.unshift({ id: b.id, name: b.name, abbr: 'Teste', testament: 'at', total: b.chapters.length, chapters: b.chapters.map(function (c) { return c.n; }), entry: b });
    });
    return list;
  }
  function bookOf(id) { return catalog().filter(function (b) { return b.id === String(id); })[0] || null; }
  function chapterEntry(b, n) { var c = b.entry && b.entry.chapters.filter(function (x) { return x.n === n; })[0]; return c ? pkgBy[c.path] : null; }
  function firstAvailable() {
    var l = catalog().filter(function (b) { return b.chapters.length; });
    return l.length ? { book: l[0].id, chapter: Math.min.apply(null, l[0].chapters) } : null;
  }
  function passagesOf(bookId, n) { return (manifest.passages || []).filter(function (p) { return p.book === String(bookId) && p.chapter === n; }); }
  function featured() {
    var ps = manifest.passages || []; if (!ps.length) return null;
    return ps[Math.floor(Date.now() / 864e5) % ps.length];
  }
  function resolveRef(ref) {
    var p = core.parseRef(ref); if (!p) return null;
    var q = core.normalize(p.name), found = null;
    catalog().forEach(function (b) { if (core.normalize(b.name) === q || core.normalize(b.abbr) === q) found = b; });
    if (!found || found.chapters.indexOf(p.chapter) < 0) return null;
    return { book: found.id, chapter: p.chapter, verse: p.verse };
  }

  /* ---------- navegação (o botão voltar do Android funciona dentro do app) ---------- */
  var curState = { v: 'home', d: 0 }, overlay = null;
  var SCREENS = ['home', 'chap', 'read', 'study', 'search', 'marks', 'menu', 'err'];
  function showScreen(v) {
    SCREENS.forEach(function (x) { var s = $('#s-' + x); if (s) s.classList.toggle('on', x === v); });
    var el = $('#s-' + v); if (el) el.scrollTop = 0;
    $$('.nav button[data-tab="home"]').forEach(function (b) { if (v === 'home') b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  function go(state, replace) {
    var s = {}; Object.keys(state).forEach(function (k) { s[k] = state[k]; });
    if (overlay) { hideOverlayUI(); overlay = null; s.d = curState.d + 1; history.replaceState(s, ''); }
    else if (replace) { s.d = curState.d; history.replaceState(s, ''); }
    else { s.d = curState.d + 1; history.pushState(s, ''); }
    render(s);
  }
  function back() { if (curState.d > 0) history.back(); else go({ v: 'home' }, true); }
  window.addEventListener('popstate', function (e) {
    if (overlay) { hideOverlayUI(); overlay = null; return; }
    var s = e.state && e.state.v ? e.state : { v: 'home', d: 0 };
    render(s);
  });
  function render(s) {
    curState = s;
    try {
      if (s.v === 'chap') viewChap(s); else if (s.v === 'read') viewRead(s); else if (s.v === 'study') viewStudy(s);
      else if (s.v === 'search') viewSearch(); else if (s.v === 'marks') viewMarks(); else if (s.v === 'menu') viewMenu(); else viewHome();
    } catch (e) { fail(e); }
  }
  function fail(e) {
    var b = clear($('#errBody'));
    b.appendChild(h('h2', { text: 'Algo não deu certo' })); b.appendChild(h('p', { text: e && e.message ? e.message : 'Erro inesperado.' }));
    b.appendChild(h('button', { class: 'btn', type: 'button', text: 'Voltar ao início', onclick: function () { go({ v: 'home' }, true); } }));
    showScreen('err');
  }

  /* overlays: menu lateral e janelas (um só nível de histórico) */
  function openOverlay(kind) {
    if (overlay) history.replaceState({ o: kind, d: curState.d }, ''); else history.pushState({ o: kind, d: curState.d + 1 }, '');
    overlay = kind;
  }
  function hideOverlayUI() { $('#drawerBg').classList.remove('on'); $('#modalBg').hidden = true; clear($('#mBody')); }
  function closeOverlay() { if (overlay) history.back(); }
  function openDrawer() { hideOverlayUI(); openOverlay('drawer'); $('#drawerBg').classList.add('on'); }
  function modal(nodes) {
    var m = clear($('#mBody')); nodes.forEach(function (n) { m.appendChild(n); });
    $('#drawerBg').classList.remove('on'); $('#modalBg').hidden = false; openOverlay('modal');
    var f = $('#mClose'); if (f) f.focus();
  }
  function mtag(t, first) { return h('div', { class: 'mtag', style: first ? 'margin-top:30px' : null, text: t }); }

  /* ---------- início ---------- */
  var testament = 'at';
  function drawBooks() {
    var g = clear($('#bgrid'));
    catalog().filter(function (b) { return b.testament === testament; }).forEach(function (b) {
      var have = b.chapters.length > 0;
      g.appendChild(h('button', { class: 'bk', type: 'button', 'aria-disabled': have ? 'false' : 'true', 'aria-label': b.name + (have ? '' : ', sem conteúdo neste aparelho'),
        onclick: function () { if (have) go({ v: 'chap', b: b.id }); else toast('O texto de ' + b.name + ' ainda não foi incluído no app.'); } },
        [h('b', { text: b.abbr }), h('span', { text: b.name })]));
    });
  }
  async function viewHome() {
    showScreen('home');
    $('#testbar').hidden = manifest.production !== false;
    drawBooks();
    var last = await kvGet('onde-parei'), first = firstAvailable(), r = $('#resume');
    if (last && bookOf(last.book)) { r.hidden = false; $('#resumeEb').textContent = 'Continuar leitura'; $('#resumeTxt').textContent = last.label; r.onclick = function () { go({ v: 'read', b: last.book, c: last.chapter }); }; }
    else if (first) { var fb = bookOf(first.book); r.hidden = false; $('#resumeEb').textContent = 'Começar a leitura'; $('#resumeTxt').textContent = fb.name + ' ' + first.chapter; r.onclick = function () { go({ v: 'read', b: first.book, c: first.chapter }); }; }
    else r.hidden = true;
    var f = featured(); $('#cardStudy').hidden = !f; $('#railSec').hidden = false;
    if (f) {
      try {
        var p = await loadPackage(pkgBy[f.path]);
        if (p.pergunta) { $('#qEyebrow').textContent = 'Para pensar antes de ler'; $('#qTitle').textContent = p.pergunta; $('#qText').textContent = 'Uma pergunta para abrir o coração antes de ler ' + f.ref + '.'; }
      } catch (e) { /* sem rede e sem cache: fica o texto padrão */ }
    }
  }
  function actRead() { kvGet('onde-parei').then(function (last) { var f = firstAvailable(); if (last && bookOf(last.book)) go({ v: 'read', b: last.book, c: last.chapter }); else if (f) go({ v: 'read', b: f.book, c: f.chapter }); else toast('Ainda não há texto bíblico neste aparelho.'); }); }
  function actStudy() { var f = featured(); if (f) go({ v: 'study', id: f.id }); else toast('Ainda não há ensino publicado neste aparelho.'); }

  /* ---------- capítulos ---------- */
  function viewChap(s) {
    var b = bookOf(s.b); if (!b) return go({ v: 'home' }, true);
    showScreen('chap'); $('#chapTitle').textContent = b.name;
    var g = clear($('#chapgrid'));
    for (var n = 1; n <= b.total; n++) (function (n) {
      var ok = b.chapters.indexOf(n) >= 0;
      g.appendChild(h('button', { type: 'button', text: String(n), 'aria-label': 'Capítulo ' + n + (ok ? '' : ', sem conteúdo'), 'aria-disabled': ok ? 'false' : 'true',
        onclick: function () { if (ok) go({ v: 'read', b: b.id, c: n }); else toast('Este capítulo ainda não foi incluído no app.'); } }));
    })(n);
  }

  /* ---------- leitura ---------- */
  async function viewRead(s) {
    var b = bookOf(s.b); if (!b) return go({ v: 'home' }, true);
    var entry = chapterEntry(b, s.c); if (!entry) return go({ v: 'chap', b: b.id }, true);
    showScreen('read'); $('#readTitle').textContent = b.name + ' ' + s.c;
    var box = clear($('#rtext')); clear($('#studyList'));
    box.appendChild(h('p', { class: 'empty', text: 'Carregando…' }));
    var avail = b.chapters.slice().sort(function (x, y) { return x - y; }), i = avail.indexOf(s.c);
    var prev = $('#chPrev'), next = $('#chNext');
    prev.hidden = i <= 0; next.hidden = i >= avail.length - 1;
    prev.onclick = function () { go({ v: 'read', b: b.id, c: avail[i - 1] }, true); };
    next.onclick = function () { go({ v: 'read', b: b.id, c: avail[i + 1] }, true); };
    var pkg;
    try { pkg = await loadPackage(entry); }
    catch (e) {
      clear(box);
      box.appendChild(h('div', { class: 'err' }, [h('p', { text: e.message }), h('button', { class: 'btn', type: 'button', text: 'Tentar de novo', onclick: function () { viewRead(s); } })]));
      return;
    }
    if (curState !== s) return; // o usuário já foi para outra tela
    kvSet('onde-parei', { book: b.id, chapter: s.c, label: b.name + ' ' + s.c });
    var marks = await hlAll();
    clear(box);
    pkg.verses.forEach(function (v) {
      var key = b.id + ':' + s.c + ':' + v.n;
      var btn = h('button', { class: 'v', type: 'button', 'data-n': String(v.n), 'aria-pressed': marks[key] ? 'true' : 'false', 'aria-label': 'Versículo ' + v.n + '. Toque para destacar.' },
        [h('sup', { text: String(v.n) }), h('span', { text: v.t })]);
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false'); hlSet(key, on); toast(on ? 'Versículo destacado' : 'Destaque removido');
      });
      box.appendChild(btn);
    });
    passagesOf(b.id, s.c).forEach(function (p) {
      $('#studyList').appendChild(h('button', { class: 'entender', type: 'button', style: '--img:url(assets/hero-bible.jpg)', onclick: function () { go({ v: 'study', id: p.id }); } },
        [h('span', {}, [h('span', { class: 'eb', text: 'Ensino do app' }), h('strong', { text: 'Entender ' + p.ref })]), h('span', { class: 'cta', style: 'min-height:40px', text: 'Abrir' })]));
    });
    if (s.verse) { var t = $('.v[data-n="' + s.verse + '"]', box); if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); } }
  }

  /* ---------- estudo em camadas ---------- */
  async function viewStudy(s) {
    var meta = (manifest.passages || []).filter(function (p) { return p.id === s.id; })[0];
    if (!meta) return go({ v: 'home' }, true);
    showScreen('study'); $('#studyTitle').textContent = meta.ref;
    var tabs = clear($('#depth')), panels = clear($('#panels'));
    panels.appendChild(h('p', { class: 'empty', text: 'Carregando…' }));
    var p;
    try { p = await loadPackage(pkgBy[meta.path]); }
    catch (e) { clear(panels); panels.appendChild(h('div', { class: 'err' }, [h('p', { text: e.message }), h('button', { class: 'btn', type: 'button', text: 'Tentar de novo', onclick: function () { viewStudy(s); } })])); return; }
    if (curState !== s) return;
    var refs = (p.refs || []).map(function (r) { return { text: r, to: resolveRef(r) }; }).filter(function (r) { return r.to; });
    var shown = core.visibleTabs({ verses: p.verses, entender: p.entender, ligar: p.ligar, refs: refs });
    var NAMES = { ler: 'Ler', entender: 'Entender', ligar: 'Ligar ao evangelho', aprofundar: 'Aprofundar' };
    var stamp = function () {
      var ic = h('span', { 'aria-hidden': 'true' }); ic.innerHTML = SHIELD; /* SVG fixo do próprio app, sem dados externos */
      return h('div', { class: 'stamp' }, [ic, h('span', { text: core.stampText(p) })]);
    };
    var build = {
      ler: function () {
        var n = [];
        if (p.pergunta) n.push(h('div', { class: 'pergunta' }, [h('b', { text: 'Para pensar antes de ler' }), h('p', { text: p.pergunta })]));
        n.push(h('span', { class: 'tag', text: 'Texto bíblico' }));
        n.push(h('div', { class: 'text' }, p.verses.map(function (v) { return h('span', { class: 'v' }, [h('sup', { text: String(v.n) }), h('span', { text: v.t })]); })));
        return n;
      },
      entender: function () {
        return [h('span', { class: 'tag app', text: 'Ensino do app' }),
          h('div', { class: 'cardx study' }, String(p.entender).split(/\n\s*\n/).map(function (t) { return h('p', { text: t.trim(), style: 'margin-bottom:10px' }); })), stamp()];
      },
      ligar: function () {
        return [h('span', { class: 'tag app', text: 'Ensino do app' }),
          h('div', { class: 'seal' }, [h('b', { text: p.ligar.selo === true ? 'Cristo neste texto' : 'Ligar ao evangelho' }), h('p', { text: p.ligar.texto })]), stamp()];
      },
      aprofundar: function () {
        return [h('span', { class: 'tag', text: 'Texto bíblico' }),
          h('div', { class: 'cardx study' }, [h('p', { text: 'Toque para ler a outra passagem. O botão voltar traz você de volta aqui.', style: 'margin-bottom:12px' }),
            h('div', { class: 'refs' }, refs.map(function (r) { return h('button', { class: 'ref', type: 'button', text: r.text, onclick: function () { go({ v: 'read', b: r.to.book, c: r.to.chapter, verse: r.to.verse }); } }); }))])];
      }
    };
    clear(panels);
    shown.forEach(function (name, i) {
      tabs.appendChild(h('button', { class: 'dtab', type: 'button', role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false', 'data-p': name, text: NAMES[name], onclick: function () { select(name); } }));
      var pn = h('div', { class: 'panel study' + (i === 0 ? ' on' : ''), id: 'p-' + name, role: 'tabpanel' }, build[name]());
      panels.appendChild(pn);
    });
    function select(name) {
      $$('.dtab', tabs).forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.p === name)); });
      $$('.panel', panels).forEach(function (x) { x.classList.toggle('on', x.id === 'p-' + name); });
    }
  }

  /* ---------- busca ---------- */
  var searchToken = 0;
  function viewSearch() { showScreen('search'); var q = $('#q'); setTimeout(function () { q.focus(); }, 60); if (q.value) runSearch(q.value); }
  function snippet(text, m) {
    var from = Math.max(0, m.start - 40), to = Math.min(text.length, m.end + 60), out = [];
    if (from > 0) out.push('…');
    out.push(text.slice(from, m.start)); out.push(h('mark', { text: text.slice(m.start, m.end) })); out.push(text.slice(m.end, to));
    if (to < text.length) out.push('…');
    return out;
  }
  async function runSearch(raw) {
    var token = ++searchToken, q = raw.trim(), box = clear($('#results'));
    if (q.length < 2) return;
    var list = h('div', { class: 'list' });
    var nq = core.normalize(q);
    catalog().filter(function (b) { return core.normalize(b.name).indexOf(nq) >= 0 || core.normalize(b.abbr) === nq; }).slice(0, 8).forEach(function (b) {
      list.appendChild(h('button', { class: 'item', type: 'button', onclick: function () { if (b.chapters.length) go({ v: 'chap', b: b.id }); else toast('O texto de ' + b.name + ' ainda não foi incluído no app.'); } }, [h('strong', { text: b.name }), h('small', { text: b.chapters.length ? 'Livro' : 'Sem conteúdo neste aparelho' })]));
    });
    var info = h('p', { class: 'count', text: 'Buscando…' });
    box.appendChild(list); box.appendChild(info);
    var hits = h('div', { class: 'list', style: 'margin-top:8px' }); box.appendChild(hits);
    var chapters = [];
    catalog().forEach(function (b) { b.chapters.slice().sort(function (x, y) { return x - y; }).forEach(function (n) { var e = chapterEntry(b, n); if (e) chapters.push({ b: b, n: n, e: e }); }); });
    var searched = 0, found = 0, LIMIT = 40;
    for (var i = 0; i < chapters.length && found < LIMIT; i++) {
      if (token !== searchToken) return;
      var c = chapters[i], pkg;
      try { pkg = await loadPackage(c.e, true); } catch (e) { continue; }
      searched++;
      for (var k = 0; k < pkg.verses.length && found < LIMIT; k++) {
        var m = core.findMatch(pkg.verses[k].t, q);
        if (m) { found++; (function (c, v, m) {
          hits.appendChild(h('button', { class: 'hit', type: 'button', onclick: function () { go({ v: 'read', b: c.b.id, c: c.n, verse: v.n }); } }, [h('strong', { text: c.b.name + ' ' + c.n + ':' + v.n }), h('span', {}, snippet(v.t, m))]));
        })(c, pkg.verses[k], m); }
      }
    }
    if (token !== searchToken) return;
    var total = chapters.length;
    info.textContent = found ? found + (found >= LIMIT ? '+ resultados no texto' : ' resultado(s) no texto') + '. Capítulos pesquisados neste aparelho: ' + searched + ' de ' + total + '.'
      : (list.children.length ? '' : 'Nada encontrado para "' + q + '". ') + 'Capítulos pesquisados neste aparelho: ' + searched + ' de ' + total + '.' + (searched < total ? ' Use "Baixar para ler sem internet" para pesquisar em tudo.' : '');
  }

  /* ---------- minha palavra (destaques) ---------- */
  async function viewMarks() {
    showScreen('marks');
    var body = clear($('#marksBody'));
    var keys = Object.keys(await hlAll());
    if (!keys.length) {
      body.appendChild(h('div', { class: 'empty' }, [h('p', { text: 'Você ainda não destacou nenhum versículo. Toque em um versículo durante a leitura para guardá-lo aqui.' }), h('button', { class: 'btn', type: 'button', text: 'Ir ler', onclick: actRead })]));
      return;
    }
    var order = {}; catalog().forEach(function (b, i) { order[b.id] = i; });
    var items = keys.map(function (k) { var p = k.split(':'); return { b: p[0], c: parseInt(p[1], 10), v: parseInt(p[2], 10) }; })
      .filter(function (x) { return bookOf(x.b); })
      .sort(function (a, b) { return (order[a.b] - order[b.b]) || (a.c - b.c) || (a.v - b.v); });
    body.appendChild(h('p', { class: 'count', text: items.length + ' versículo(s) destacado(s)' }));
    var list = h('div', { class: 'list' }); body.appendChild(list);
    for (var i = 0; i < items.length; i++) {
      var it = items[i], bk = bookOf(it.b), text = '';
      try { var e = chapterEntry(bk, it.c); if (e) { var pkg = await loadPackage(e, true); var vv = pkg.verses.filter(function (x) { return x.n === it.v; })[0]; if (vv) text = vv.t; } } catch (x) { /* sem o texto neste aparelho */ }
      (function (it, bk, text) {
        list.appendChild(h('button', { class: 'hit', type: 'button', onclick: function () { go({ v: 'read', b: it.b, c: it.c, verse: it.v }); } }, [h('strong', { text: bk.name + ' ' + it.c + ':' + it.v }), text ? h('span', { text: text }) : null]));
      })(it, bk, text);
    }
  }

  /* ---------- configurações ---------- */
  var dlState = '';
  async function refreshMenuInfo() {
    try {
      var c = await caches.open(CONTENT), have = (await c.keys()).map(function (r) { return relPath(r.url); });
      var need = core.missingPackages(manifest, have).length, total = manifest.packages.length;
      dlState = need === 0 ? 'Tudo baixado' : (total - need) + ' de ' + total;
      $('#dlSmall').textContent = dlState;
    } catch (e) { $('#dlSmall').textContent = ''; }
    var est = '';
    try { if (navigator.storage && navigator.storage.estimate) { var e = await navigator.storage.estimate(); est = 'Armazenamento usado: ' + Math.round((e.usage || 0) / 1024 / 1024 * 10) / 10 + ' MB de ' + Math.round((e.quota || 0) / 1024 / 1024) + ' MB.'; } } catch (x) { est = ''; }
    $('#storeInfo').textContent = est;
    var pst = '';
    try { if (navigator.storage && navigator.storage.persisted) pst = (await navigator.storage.persisted()) ? 'Protegido' : 'Não protegido'; } catch (x) { pst = ''; }
    $('#persistSmall').textContent = pst;
  }
  function viewMenu() { showScreen('menu'); refreshInstall(); refreshMenuInfo(); }

  /* ---------- instalar e compartilhar ---------- */
  var deferred = null;
  function isStandalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function refreshInstall() { var b = $('#inst'); if (!b) return; b.textContent = isStandalone() ? '✓ Instalado' : 'Instalar app'; $('#instHint').hidden = isStandalone(); }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; refreshInstall(); });
  window.addEventListener('appinstalled', function () { deferred = null; toast('App instalado'); refreshInstall(); });
  function installHelp() {
    modal([mtag('Instalar', true), h('h2', { text: 'Instalar aplicativo' }),
      h('p', {}, ['No Android, abra o menu do Chrome (três pontos) e escolha ', h('b', { text: 'Instalar aplicativo' }), ' ou ', h('b', { text: 'Adicionar à tela inicial' }), '. Depois disso o Palavra Viva abre como um aplicativo e funciona sem internet.'])]);
  }
  function install() {
    if (isStandalone()) { toast('O app já está instalado.'); return; }
    if (deferred) { var d = deferred; deferred = null; d.prompt(); d.userChoice.then(refreshInstall, refreshInstall); } else installHelp();
  }
  function share() {
    var url = cfg.siteUrl || (location.origin + location.pathname);
    if (navigator.share) navigator.share({ title: 'Palavra Viva', text: 'Bíblia em português, grátis e sem internet.', url: url }).catch(function () { /* cancelado */ });
    else copy(url, 'Link copiado');
  }

  /* ---------- baixar tudo ---------- */
  async function downloadAll(cb) {
    var c = await caches.open(CONTENT);
    var have = (await c.keys()).map(function (r) { return relPath(r.url); });
    var need = core.missingPackages(manifest, have), total = manifest.packages.length, done = total - need.length, fails = 0, i = 0;
    cb(done, total);
    async function worker() {
      while (i < need.length) {
        var e = need[i++];
        try {
          var r = await fetch(e.path, { cache: 'no-store' }); if (!r.ok) throw new Error('http');
          var bytes = new Uint8Array(await r.clone().arrayBuffer());
          if (!(await core.verifyPackage(bytes, e)).ok) throw new Error('hash');
          await c.put(e.path, r); done++;
        } catch (x) { fails++; }
        cb(done, total);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    for (var m = 0; m < (cfg.audio || []).length; m++) { try { await mediaResponse(cfg.audio[m]); } catch (x) { /* áudio é opcional */ } }
    if (!fails) { kvSet('baixado', { generation: manifest.generation, at: Date.now() }); try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (x) { /* ignora */ } }
    return { done: done, total: total, fails: fails };
  }
  function downloadModal() {
    var bar = h('i', { id: 'pbar' }), txt = h('p', { class: 'dlstat', id: 'ptxt', text: 'Calculando…' });
    var go1 = h('button', { class: 'big', type: 'button', id: 'pgo', text: 'Baixar agora' });
    modal([mtag('Leitura sem internet', true), h('h2', { text: 'Baixar tudo' }), h('p', { style: 'text-align:center', text: 'O texto bíblico e o ensino ficam guardados no aparelho. Você poderá ler no modo avião.' }), h('div', { class: 'prog' }, [bar]), txt, go1]);
    var show = function (d, t) { bar.style.width = (t ? d / t * 100 : 0) + '%'; txt.textContent = d + ' de ' + t + ' partes guardadas'; };
    caches.open(CONTENT).then(function (c) { return c.keys(); }).then(function (ks) {
      var have = ks.map(function (r) { return relPath(r.url); }), t = manifest.packages.length, n = t - core.missingPackages(manifest, have).length;
      show(n, t); if (n === t) { go1.textContent = 'Tudo já está no aparelho'; go1.disabled = true; go1.style.opacity = '.7'; }
    });
    go1.onclick = function () {
      go1.disabled = true; go1.style.opacity = '.6'; go1.textContent = 'Baixando…';
      downloadAll(show).then(function (r) {
        go1.style.opacity = '1';
        if (r.fails) { go1.disabled = false; go1.textContent = 'Faltaram ' + r.fails + '. Tentar de novo'; }
        else { go1.textContent = 'Pronto: já funciona sem internet'; }
        refreshMenuInfo();
      }, function () { go1.disabled = false; go1.style.opacity = '1'; go1.textContent = 'Não deu certo. Tentar de novo'; });
    };
  }

  /* ---------- sobre, contato, abençoe ---------- */
  function row(dt, dd) { return h('div', {}, [h('dt', { text: dt }), h('dd', { text: dd })]); }
  function aboutModal() {
    var lic = manifest.license || {}, owner = cfg.ownerName || 'o responsável pelo projeto', yr = cfg.year || String(new Date().getFullYear());
    var dl = h('dl', {}, [
      row('Projeto', 'Palavra Viva, Bíblia de Estudos. Gratuito, sem anúncios e sem coleta de dados.'),
      cfg.ownerName ? row('Responsável', cfg.ownerName) : null,
      row('Texto bíblico e referências', lic.text || ''),
      row('Ensino do app', 'Não é a Bíblia. Gerado por IA e conferido por outras IAs; só o selo "Revisado por pessoa" indica revisão humana.'),
      row('Direitos', '© ' + yr + ' ' + owner + '. Todos os direitos reservados ao ensino e ao aplicativo; o texto bíblico segue a licença acima.'),
      row('Versão', 'App ' + APP_VERSION + ' · conteúdo ' + manifest.contentVersion + ' (geração ' + manifest.generation + ')')
    ]);
    var nodes = [mtag('Palavra Viva', true), h('h2', { text: 'Sobre' }), dl];
    if (lic.url) nodes.push(h('p', {}, [h('a', { href: lic.url, rel: 'noopener', target: '_blank', text: 'Ver a licença do texto' })]));
    modal(nodes);
  }
  function contactModal() {
    var mail = cfg.contactEmail;
    modal([mtag('Fale conosco', true), h('h2', { text: 'Contato e suporte' }), h('p', { style: 'text-align:center', text: 'Para dúvidas, sugestões ou suporte, escreva para:' }),
      h('p', { style: 'text-align:center' }, [h('a', { href: 'mailto:' + mail, text: mail })]),
      h('button', { class: 'big', type: 'button', text: 'Copiar e-mail', onclick: function () { copy(mail, 'E-mail copiado'); } })]);
  }
  function blessModal() {
    var img = h('div', { class: 'mimg' }), probe = new Image();
    probe.onload = function () { img.style.setProperty('--img', 'url(assets/abencoe.jpg)'); };
    probe.onerror = function () { img.style.setProperty('--img', 'url(assets/hero-reading.jpg)'); };
    probe.src = 'assets/abencoe.jpg';
    modal([img, mtag('Um gesto de continuidade'), h('h2', { text: 'Abençoe este Projeto' }),
      h('p', { text: 'O Palavra Viva nasceu para tornar a Palavra mais próxima, simples e presente na vida de cada pessoa.' }),
      h('p', { text: 'Se este projeto tem edificado sua caminhada, você pode contribuir voluntariamente para ele continuar crescendo e alcançando outras vidas.' }),
      h('span', { class: 'note', text: 'Cada apoio é recebido com gratidão.' }),
      mtag('Contribuição voluntária via Pix'),
      h('button', { class: 'big', type: 'button', text: 'Copiar chave Pix', onclick: function () { copy(cfg.pixKey, 'Chave Pix copiada'); } }),
      h('p', { style: 'text-align:center;font-size:12px;color:var(--soft);margin-top:8px', text: 'A chave não aparece na tela: ela é copiada para você colar no aplicativo do seu banco.' })]);
  }

  /* ---------- áudio ambiente: música do projeto se existir; senão, um pad suave sintetizado ---------- */
  var aud = { on: false, el: null, url: null, ctx: null, master: null, oscs: [] };
  function volume() { return $('#vol').value / 100; }
  async function mediaResponse(src) {
    var c = await caches.open(MEDIA), r = await c.match(src);
    if (!r) { r = await fetch(src); if (!r.ok) throw new Error('sem arquivo'); await c.put(src, r.clone()); }
    return r;
  }
  function startSynth() {
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
    aud.ctx = aud.ctx || new C(); if (aud.ctx.state === 'suspended') aud.ctx.resume();
    var ac = aud.ctx; aud.master = ac.createGain(); aud.master.gain.value = 0;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; aud.master.connect(lp); lp.connect(ac.destination);
    [130.81, 196, 261.63, 329.63].forEach(function (f, i) {
      var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      var g = ac.createGain(); g.gain.value = 0.12 / (1 + i * 0.4);
      var l = ac.createOscillator(); l.frequency.value = 0.07 + i * 0.03; var lg = ac.createGain(); lg.gain.value = 0.05; l.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(aud.master); o.start(); l.start(); aud.oscs.push(o, l);
    });
    aud.master.gain.linearRampToValueAtTime(volume() * 0.8, ac.currentTime + 2.5);
    return true;
  }
  async function startAudio() {
    var src = cfg.audio && cfg.audio[0];
    if (src) {
      try {
        var blob = await (await mediaResponse(src)).blob();
        aud.url = URL.createObjectURL(blob); aud.el = new Audio(aud.url); aud.el.loop = true; aud.el.volume = volume();
        await aud.el.play(); return true;
      } catch (e) { if (aud.el) { aud.el.pause(); aud.el = null; } if (aud.url) { URL.revokeObjectURL(aud.url); aud.url = null; } }
    }
    return startSynth();
  }
  function stopAudio() {
    if (aud.el) { aud.el.pause(); aud.el = null; }
    if (aud.url) { URL.revokeObjectURL(aud.url); aud.url = null; }
    if (aud.master && aud.ctx) {
      aud.master.gain.linearRampToValueAtTime(0, aud.ctx.currentTime + 1);
      var o = aud.oscs, m = aud.master; aud.oscs = []; aud.master = null;
      setTimeout(function () { o.forEach(function (x) { try { x.stop(); } catch (e) { /* já parou */ } }); try { m.disconnect(); } catch (e) { /* ok */ } }, 1200);
    }
  }
  function bindAudio() {
    $('#sw').addEventListener('click', async function () {
      var s = $('#sw'), want = s.getAttribute('aria-checked') !== 'true';
      if (want) { s.disabled = true; var ok = await startAudio(); s.disabled = false; if (!ok) { toast('Este aparelho não tocou o áudio.'); return; } } else stopAudio();
      aud.on = want; s.setAttribute('aria-checked', String(want)); $('#audState').textContent = want ? 'Tocando baixinho enquanto você lê' : 'Desligada';
    });
    $('#vol').value = lsGet('pv4-vol', '40');
    $('#vol').addEventListener('input', function () {
      lsSet('pv4-vol', $('#vol').value);
      if (aud.el) aud.el.volume = volume();
      if (aud.master && aud.ctx) aud.master.gain.linearRampToValueAtTime(volume() * 0.8, aud.ctx.currentTime + 0.1);
    });
  }

  /* ---------- atualização do app (botão "Atualizar", sem skipWaiting automático) ---------- */
  function setupSW() {
    if (!('serviceWorker' in navigator)) return;
    var banner = $('#update');
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      function offer(w) { banner.hidden = false; $('#do-update').onclick = function () { w.postMessage({ type: 'SKIP_WAITING' }); }; }
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      reg.update().catch(function () { /* offline */ });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { /* offline */ }); });
    }).catch(function () { /* sem service worker: o app continua funcionando online */ });
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (reloaded) return; reloaded = true; location.reload(); });
  }

  /* ---------- ligações dos elementos fixos ---------- */
  function bindStatic() {
    var splash = $('#splash');
    function hideSplash() { splash.classList.add('off'); ssSet('pv4-splash', '1'); }
    if (ssGet('pv4-splash')) splash.classList.add('off'); else { setTimeout(hideSplash, 2400); splash.addEventListener('click', hideSplash); splash.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') hideSplash(); }); }

    $('#menuBtn').addEventListener('click', openDrawer);
    $('#dClose').addEventListener('click', closeOverlay);
    $('#drawerBg').addEventListener('click', function (e) { if (e.target.id === 'drawerBg') closeOverlay(); });
    $('#mClose').addEventListener('click', closeOverlay);
    $('#modalBg').addEventListener('click', function (e) { if (e.target.id === 'modalBg') closeOverlay(); });
    $$('.nav button').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.tab === 'drawer') openDrawer(); else if (curState.v === 'home') $('#s-home').scrollTo({ top: 0, behavior: 'smooth' }); else go({ v: 'home' }); }); });
    $$('[data-back]').forEach(function (b) { b.addEventListener('click', back); });
    var sl = $('#slides'), dots = $$('#dots i');
    function cur() { return Math.round(sl.scrollLeft / sl.clientWidth); }
    sl.addEventListener('scroll', function () { var i = cur(); dots.forEach(function (d, k) { d.classList.toggle('on', k === i); }); });
    $('#prev').addEventListener('click', function () { sl.scrollTo({ left: Math.max(0, cur() - 1) * sl.clientWidth, behavior: 'smooth' }); });
    $('#next').addEventListener('click', function () { sl.scrollTo({ left: Math.min(dots.length - 1, cur() + 1) * sl.clientWidth, behavior: 'smooth' }); });
    $$('[data-act]').forEach(function (b) { b.addEventListener('click', function () { var a = b.dataset.act; if (a === 'read') actRead(); else if (a === 'study') actStudy(); else go({ v: 'marks' }); }); });
    $$('.tt button').forEach(function (c) { c.addEventListener('click', function () { testament = c.dataset.t; $$('.tt button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); }); drawBooks(); }); });
    $('#goSearch').addEventListener('click', function () { go({ v: 'search' }); });
    var qt = null; $('#q').addEventListener('input', function (e) { clearTimeout(qt); var v = e.target.value; qt = setTimeout(function () { runSearch(v); }, 250); });
    $('#fsz').addEventListener('click', function (e) { var s = e.target.closest('button'); if (!s) return; lsSet('pv4-fs', s.dataset.s); applyAppearance(); });
    $('#thm').addEventListener('click', function (e) { var s = e.target.closest('button'); if (!s) return; lsSet('pv4-theme', s.dataset.m); applyAppearance(); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance);
    $('#inst').addEventListener('click', install); $('#shr').addEventListener('click', share);
    $('#dlbtn').addEventListener('click', downloadModal);
    $('#expbtn').addEventListener('click', function () {
      exportAll().then(function (o) {
        var a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' })), download: 'palavra-viva-backup.json' });
        document.body.appendChild(a); a.click(); a.remove(); toast('Backup gerado');
      }, function () { toast('Não foi possível gerar o backup.'); });
    });
    $('#impfile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      f.text().then(function (t) { return importAll(JSON.parse(t)); }).then(function () { toast('Backup importado'); }, function (er) { toast(er.message || 'Arquivo inválido.'); });
      e.target.value = '';
    });
    $('#persist').addEventListener('click', function () {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (ok) { toast(ok ? 'Dados protegidos' : 'O navegador não concedeu a proteção.'); refreshMenuInfo(); });
      else toast('Este navegador não oferece essa proteção.');
    });
    $$('[data-d]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.dataset.d;
        if (d === 'audio') { $('#audioPanel').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (d === 'cfg') go({ v: 'menu' });
        else if (d === 'dl') downloadModal(); else if (d === 'inst') { if (isStandalone()) { closeOverlay(); toast('O app já está instalado.'); } else if (deferred) { closeOverlay(); install(); } else installHelp(); }
        else if (d === 'shr') { closeOverlay(); share(); } else if (d === 'bless') blessModal(); else if (d === 'contact') contactModal(); else if (d === 'about') aboutModal();
      });
    });
    bindAudio();
    window.addEventListener('online', function () {
      syncManifest().then(function (m) { if (m && manifest && m.generation !== manifest.generation) { manifest = m; indexManifest(); if (curState.v === 'home') render(curState); } }, function () { /* ok */ });
    });
  }

  function fillRights() {
    var t = cfg.ownerName ? '© ' + (cfg.year || new Date().getFullYear()) + ' ' + cfg.ownerName + ' · Todos os direitos reservados' : '';
    ['rightsHome', 'rightsMenu'].forEach(function (id) { var e = $('#' + id); if (e) { e.textContent = t; e.hidden = !t; } });
  }

  /* ---------- partida ---------- */
  (async function start() {
    applyAppearance(); bindStatic(); refreshInstall();
    await loadConfig();
    fillRights();
    $('#blessItem').hidden = !cfg.pixKey;
    setupSW();
    try {
      manifest = await syncManifest();
      if (!manifest) throw new Error('Sem conexão e sem conteúdo guardado. Abra o app uma vez com internet.');
      indexManifest();
      var s = history.state;
      if (s && s.v && !s.o) curState = s; else { curState = { v: 'home', d: Math.max(0, ((s && s.d) || 1) - 1) }; history.replaceState(curState, ''); }
      render(curState);
    } catch (e) { fail(e); }
  })();
})();
