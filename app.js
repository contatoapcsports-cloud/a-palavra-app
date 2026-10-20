/* Palavra Viva: app (interface + leitura + estudo). Offline primeiro. Sem dependências externas.
   Regras do plano: conteúdo só entra se o hash conferir; aba sem conteúdo não aparece; o último conteúdo válido nunca é descartado. */
(function () {
  'use strict';
  var core = window.PVCore, BK = window.PVBooks, SH = window.PVShare;
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
  var cfg = { ownerName: '', year: '', contactEmail: 'contato.palavravivabr@gmail.com', pixKey: '', siteUrl: '', shareLabel: '', audio: [] };
  async function loadConfig() {
    try {
      var r = await fetch('config.json');
      if (r.ok) { var j = await r.json(); Object.keys(cfg).forEach(function (k) { if (j[k] != null) cfg[k] = j[k]; }); }
    } catch (e) { /* sem config: usa o padrão */ }
  }

  /* ---------- aparência ---------- */
  var splashOn = true, appReady = function () { /* definido em bindStatic */ };
  function applyAppearance() {
    var s = parseFloat(lsGet('pv4-fs', '1.125')); if (!(s >= 1 && s <= 1.5)) s = 1.125;
    document.documentElement.style.setProperty('--fs', s + 'rem');
    $$('#fsz button').forEach(function (b) { b.setAttribute('aria-pressed', String(parseFloat(b.dataset.s) === s)); });
    var m = lsGet('pv4-theme', 'auto');
    if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m); else { m = 'auto'; document.documentElement.removeAttribute('data-theme'); }
    $$('#thm button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === m)); });
    var dark = m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', splashOn ? '#06201a' : (dark ? '#12191A' : '#1F4D43'));
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
  var SCREENS = ['home', 'chap', 'read', 'study', 'ens', 'search', 'marks', 'menu', 'err'];
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
      else if (s.v === 'ens') viewEnsinos(); else if (s.v === 'search') viewSearch(); else if (s.v === 'marks') viewMarks(); else if (s.v === 'menu') viewMenu(); else viewHome();
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
  var testament = 'at', homeQ = null;
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
    homeQ = null; $('#qShare').hidden = true;
    $('#testbar').hidden = manifest.production !== false;
    drawBooks();
    var last = await kvGet('onde-parei'), first = firstAvailable(), r = $('#resume');
    if (last && bookOf(last.book)) { r.hidden = false; $('#resumeEb').textContent = 'Continuar leitura'; $('#resumeTxt').textContent = last.label; r.onclick = function () { go({ v: 'read', b: last.book, c: last.chapter }); }; }
    else if (first) { var fb = bookOf(first.book); r.hidden = false; $('#resumeEb').textContent = 'Começar a leitura'; $('#resumeTxt').textContent = fb.name + ' ' + first.chapter; r.onclick = function () { go({ v: 'read', b: first.book, c: first.chapter }); }; }
    else r.hidden = true;
    var f = featured(); $('#cardStudy').hidden = !f; $('#railSec').hidden = false;
    var np = (manifest.passages || []).length; $('#cardEns').hidden = !np; $('#ensBanner').hidden = !np; if (np) $('#ensBannerTxt').textContent = 'Aprenda a Palavra: ' + np + (np === 1 ? ' ensino pronto' : ' ensinos prontos');
    if (np) { $('#ensTitle').textContent = 'Aprenda a Palavra'; $('#ensSmall').textContent = np + (np === 1 ? ' ensino pronto' : ' ensinos prontos') + ' · toque para ver'; }
    if (f) {
      try {
        var p = await loadPackage(pkgBy[f.path]);
        if (p.pergunta) { $('#qEyebrow').textContent = 'Para pensar antes de ler'; $('#qTitle').textContent = p.pergunta; $('#qText').textContent = 'Uma pergunta para abrir o coração antes de ler ' + f.ref + '.'; homeQ = { f: f, p: p }; $('#qShare').hidden = false; }
      } catch (e) { /* sem rede e sem cache: fica o texto padrão */ }
    }
  }
  function actRead() { kvGet('onde-parei').then(function (last) { var f = firstAvailable(); if (last && bookOf(last.book)) go({ v: 'read', b: last.book, c: last.chapter }); else if (f) go({ v: 'read', b: f.book, c: f.chapter }); else toast('Ainda não há texto bíblico neste aparelho.'); }); }
  function actStudy() { var f = featured(); if (f) go({ v: 'study', id: f.id }); else toast('Ainda não há ensino publicado neste aparelho.'); }

  /* ---------- link direto para um ensino (#estudo=ID) ---------- */
  var pendingLink = null;
  function takeLink() {
    var id = SH.parseDeepLink(location.hash); if (!id) return null;
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* ok */ }
    return id;
  }
  function tryDeepLink(id, final) {
    var ok = manifest && (manifest.passages || []).some(function (p) { return p.id === id; });
    if (ok) { go({ v: 'study', id: id }); return; }
    if (final) toast('Esse ensino ainda não está neste aparelho. Conecte-se à internet e abra de novo.'); else pendingLink = id;
  }
  function settleLink() { if (pendingLink) { var id = pendingLink; pendingLink = null; tryDeepLink(id, true); } }

  /* ---------- capítulos ---------- */
  function viewChap(s) {
    var b = bookOf(s.b); if (!b) return go({ v: 'home' }, true);
    showScreen('chap'); $('#chapTitle').textContent = b.name;
    var g = clear($('#chapgrid'));
    for (var n = 1; n <= b.total; n++) (function (n) {
      var ok = b.chapters.indexOf(n) >= 0, ens = passagesOf(b.id, n).length > 0;
      g.appendChild(h('button', { type: 'button', class: ens ? 'has' : null, text: String(n), 'aria-label': 'Capítulo ' + n + (ok ? '' : ', sem conteúdo') + (ens ? ', com ensino' : ''), 'aria-disabled': ok ? 'false' : 'true',
        onclick: function () { if (ok) go({ v: 'read', b: b.id, c: n }); else toast('Este capítulo ainda não foi incluído no app.'); } }));
    })(n);
  }

  /* ---------- leitura ---------- */

  /* ---------- leitura em voz alta (voz sintetizada do aparelho, preferindo masculina) ---------- */
  var TTS = { on: false, i: 0, itens: [], voz: null };
  function ttsOk() { return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
  function vozesPt() {
    return speechSynthesis.getVoices().filter(function (v) { return /^pt/i.test(v.lang); }).sort(function (x, y) { return (/^pt[-_]?br/i.test(y.lang) ? 1 : 0) - (/^pt[-_]?br/i.test(x.lang) ? 1 : 0); });
  }
  var HOMEM = /(\bmale\b|masculin|ptd\b|-ptd|-pte|felipe|antonio|ant[oô]nio|ricardo|daniel|marcos|jorge|luciano|thiago|paulo|\bhomem)/i;
  var MULHER = /(female|feminin|\bptc\b|-afs|-ptf|maria|francisca|luciana|vitoria|vit[oó]ria|fernanda|camila|ana\b|helena|giovanna|leila|yara)/i;
  function escolherVoz() {
    var vs = vozesPt(); if (!vs.length) return null;
    var salva = ''; try { salva = localStorage.getItem('pv_voz') || ''; } catch (x) { /* ok */ }
    var i;
    if (salva) for (i = 0; i < vs.length; i++) if (vs[i].voiceURI === salva) return { v: vs[i], grave: false, manual: true };
    for (i = 0; i < vs.length; i++) if (HOMEM.test(vs[i].name + ' ' + vs[i].voiceURI) && !MULHER.test(vs[i].name + ' ' + vs[i].voiceURI)) return { v: vs[i], grave: false };
    for (i = 0; i < vs.length; i++) if (/pt[-_]?br/i.test(vs[i].lang) && !MULHER.test(vs[i].name + ' ' + vs[i].voiceURI)) return { v: vs[i], grave: true };
    return { v: vs[0], grave: true }; // sem voz masculina identificável: tom mais grave
  }
  function preencherVozes() {
    var sel = $('#lsVoz'), rt = $('#lsRate'); if (!sel) return;
    var vs = vozesPt(); if (!vs.length) { sel.hidden = true; rt.hidden = true; return; }
    var atual = escolherVoz();
    sel.innerHTML = '';
    vs.forEach(function (v, n) {
      var o = document.createElement('option'); o.value = v.voiceURI;
      o.textContent = 'Voz ' + (n + 1) + (HOMEM.test(v.name + ' ' + v.voiceURI) ? ' (masculina)' : MULHER.test(v.name + ' ' + v.voiceURI) ? ' (feminina)' : '') + ' · ' + v.lang;
      if (atual && atual.v.voiceURI === v.voiceURI) o.selected = true; sel.appendChild(o);
    });
    sel.hidden = false; rt.hidden = false;
    try { var r = localStorage.getItem('pv_rate'); if (r) rt.value = r; } catch (x) { /* ok */ }
    sel.onchange = function () { try { localStorage.setItem('pv_voz', sel.value); } catch (x) { /* ok */ } if (TTS.on) { TTS.voz = escolherVoz(); try { speechSynthesis.cancel(); } catch (x) { /* ok */ } } };
    rt.onchange = function () { try { localStorage.setItem('pv_rate', rt.value); } catch (x) { /* ok */ } };
  }
  function ttsStop() {
    TTS.on = false; try { speechSynthesis.cancel(); } catch (x) { /* sem voz */ }
    $$('.v.lendo').forEach(function (e) { e.classList.remove('lendo'); });
    var p = $('#lsPlay'), st = $('#lsStop'); if (p) { p.textContent = '▶ Ouvir capítulo'; } if (st) st.hidden = true;
  }
  function ttsFalar() {
    if (!TTS.on) return;
    var el = TTS.itens[TTS.i];
    $$('.v.lendo').forEach(function (e) { e.classList.remove('lendo'); });
    if (!el) { ttsStop(); var nx = $('#chNext'); if (nx && !nx.hidden) { toast('Fim do capítulo'); } return; }
    el.classList.add('lendo'); el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var u = new SpeechSynthesisUtterance($('span', el).textContent); // lê só o texto, sem dizer o número do versículo
    u.lang = 'pt-BR'; u.rate = parseFloat(($('#lsRate') || {}).value) || 0.92; u.pitch = TTS.voz && TTS.voz.grave ? 0.7 : 0.9;
    if (TTS.voz && TTS.voz.v) { u.voice = TTS.voz.v; u.lang = TTS.voz.v.lang || 'pt-BR'; }
    u.onend = function () { if (TTS.on) { TTS.i++; ttsFalar(); } };
    u.onerror = function (e) { if (e && (e.error === 'canceled' || e.error === 'interrupted')) return; ttsStop(); toast('Não foi possível ler em voz alta neste aparelho.'); };
    speechSynthesis.speak(u);
  }
  function bindListen() {
    var box = $('#listen'); if (!box) return;
    if (!ttsOk()) { box.hidden = true; return; }
    box.hidden = false; preencherVozes();
    var info = $('#lsInfo');
    $('#lsPlay').onclick = function () {
      if (TTS.on) {
        if (speechSynthesis.paused) { speechSynthesis.resume(); $('#lsPlay').textContent = '❚❚ Pausar'; }
        else { speechSynthesis.pause(); $('#lsPlay').textContent = '▶ Continuar'; }
        return;
      }
      TTS.itens = $$('#rtext .v'); if (!TTS.itens.length) return;
      TTS.voz = escolherVoz();
      if (!TTS.voz) { info.textContent = 'Este aparelho não tem voz em português instalada. Em Configurações > Idioma > Saída de texto para fala, instale o português do Brasil.'; return; }
      info.textContent = 'Voz: ' + TTS.voz.v.name + (TTS.voz.grave ? ' (tom grave)' : '');
      TTS.i = 0; TTS.on = true; $('#lsPlay').textContent = '❚❚ Pausar'; $('#lsStop').hidden = false;
      try { speechSynthesis.cancel(); } catch (x) { /* ok */ }
      ttsFalar();
    };
    $('#lsStop').onclick = function () { ttsStop(); };
    if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = function () { preencherVozes(); };
  }

  async function viewRead(s) {
    ttsStop(); bindListen();
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
        [h('span', {}, [h('strong', { text: 'Entender ' + p.ref })]), h('span', { class: 'cta', style: 'min-height:40px', text: 'Abrir' })]));
    });
    if (s.verse) { var t = $('.v[data-n="' + s.verse + '"]', box); if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); } }
  }

  /* ---------- ensinos prontos (lista por livro) ---------- */
  function viewEnsinos() {
    showScreen('ens');
    var body = clear($('#ensBody')), ps = manifest.passages || [];
    if (!ps.length) { body.appendChild(h('p', { class: 'empty', text: 'Os primeiros ensinos ainda estão sendo preparados.' })); return; }
    body.appendChild(h('p', { class: 'lead', text: 'Cada ensino ajuda você a ler, entender, ver Cristo no texto e viver a Palavra. Toque para abrir.' }));
    var order = {}; catalog().forEach(function (b, i) { order[b.id] = i; });
    var by = {};
    ps.forEach(function (p) { (by[p.book] = by[p.book] || []).push(p); });
    Object.keys(by).sort(function (x, y) { return (order[x] - order[y]); }).forEach(function (bid) {
      var bk = bookOf(bid), grp = h('div', { class: 'ensgroup' }, [h('h3', { text: bk ? bk.name : bid })]), list = h('div', { class: 'list' });
      by[bid].sort(function (x, y) { return (x.chapter - y.chapter) || String(x.id).localeCompare(String(y.id), undefined, { numeric: true }); }).forEach(function (p) {
        list.appendChild(h('button', { class: 'hit ens', type: 'button', onclick: function () { go({ v: 'study', id: p.id }); } }, [
          h('span', { class: 'thumb', style: '--img:url(' + SH.photoFor(p.id) + ')', 'aria-hidden': 'true' }),
          h('span', { class: 'etxt' }, [h('strong', { text: p.titulo || p.ref }), h('span', { class: 'ref-mini', text: p.ref })])]));
      });
      grp.appendChild(list); body.appendChild(grp);
    });
  }

  /* ---------- estudo em camadas ---------- */
  async function viewStudy(s) {
    var meta = (manifest.passages || []).filter(function (p) { return p.id === s.id; })[0];
    if (!meta) return go({ v: 'home' }, true);
    showScreen('study'); $('#studyTitle').textContent = meta.ref;
    var shareBtn = $('#studyShare'); shareBtn.hidden = true;
    var tabs = clear($('#depth')), panels = clear($('#panels')), head = clear($('#studyHead'));
    panels.appendChild(h('p', { class: 'empty', text: 'Carregando…' }));
    var p;
    try { p = await loadPackage(pkgBy[meta.path]); }
    catch (e) { clear(panels); panels.appendChild(h('div', { class: 'err' }, [h('p', { text: e.message }), h('button', { class: 'btn', type: 'button', text: 'Tentar de novo', onclick: function () { viewStudy(s); } })])); return; }
    if (curState !== s) return;
    var refs = (p.refs || []).map(function (r) { return { text: r, to: resolveRef(r) }; }).filter(function (r) { return r.to; });
    var shown = core.visibleTabs({ verses: p.verses, entender: p.entender, ligar: p.ligar, viver: p.viver, guarde: p.guarde, ore: p.ore, quiz: p.quiz, refs: refs });
    head.appendChild(h('div', { class: 'scover', style: '--img:url(' + SH.photoFor(meta.id) + ')', 'aria-hidden': 'true' }));
    if (p.titulo) { head.appendChild(h('div', { class: 'sref', text: meta.ref })); head.appendChild(h('h2', { class: 'stitle', text: p.titulo })); }
    shareBtn.hidden = false; shareBtn.onclick = function () { shareStudy(meta, p); };
    var NAMES = { ler: 'Ler', entender: 'Entender', ligar: 'Ligar ao evangelho', viver: 'Viver', testar: 'Testar', aprofundar: 'Aprofundar' };
    var stamp = function () {
      var st = core.stampText(p); if (!st) return null;
      var ic = h('span', { 'aria-hidden': 'true' }); ic.innerHTML = SHIELD; /* SVG fixo do próprio app, sem dados externos */
      return h('div', { class: 'stamp' }, [ic, h('span', { text: st })]);
    };
    var build = {
      ler: function () {
        var n = [];
        if (p.pergunta) n.push(h('div', { class: 'pergunta' }, [h('b', { text: 'Para pensar antes de ler' }), h('p', { text: p.pergunta })]));
        n.push(h('span', { class: 'tag', text: 'Texto bíblico' }));
        n.push(h('div', { class: 'text' }, p.verses.map(function (v) { return h('span', { class: 'v' }, [h('sup', { text: String(v.n) }), h('span', { text: v.t })]); })));
        n.push(h('button', { class: 'btn alt', type: 'button', text: 'Compartilhar este estudo', onclick: function () { shareStudy(meta, p); } }));
        return n;
      },
      entender: function () {
        /* trechos curtos: a primeira ideia em destaque, o resto fácil de acompanhar no celular */
        var parts = SH.chunkText(p.entender).map(function (t, i) { return h('p', { text: t, class: i === 0 ? 'lead1' : null, style: 'margin-bottom:10px' }); });
        return [h('div', { class: 'cardx study' }, parts), stamp()];
      },
      ligar: function () {
        return [
          h('div', { class: 'seal' }, [h('b', { text: p.ligar.selo === true ? 'Cristo neste texto' : 'Ligar ao evangelho' }), h('p', { text: p.ligar.texto })]), stamp()];
      },
      viver: function () {
        var n = [];
        if (p.viver) n.push(h('div', { class: 'cardx study viver' }, [h('div', { class: 'sub', text: 'Como viver' })].concat(String(p.viver).split(/\n\s*\n/).map(function (t) { return h('p', { text: t.trim(), style: 'margin-bottom:8px' }); }))));
        if (p.guarde) n.push(h('div', { class: 'guarde' }, [h('div', { class: 'mtag', style: 'margin:0 0 6px', text: 'Guarde no coração' }), h('p', { text: p.guarde })]));
        if (p.ore) n.push(h('div', { class: 'cardx study viver' }, [h('div', { class: 'sub', text: 'Ore' }), h('p', { text: p.ore })]));
        n.push(stamp()); return n;
      },
      testar: function () {
        var qz = p.quiz, wrap = h('div', { class: 'quiz' }), fb = h('div', { class: 'fb', hidden: true, role: 'status' }), done = false;
        wrap.appendChild(h('p', { class: 'q', text: qz.pergunta }));
        var btns = qz.opcoes.map(function (o, i) {
          var b = h('button', { class: 'opt', type: 'button', text: o, onclick: function () {
            if (done) return;
            if (i === qz.certa) { done = true; b.classList.add('ok'); fb.hidden = false; fb.textContent = 'Isso mesmo! ' + (qz.explicacao || ''); }
            else { b.classList.add('no'); b.disabled = true; fb.hidden = false; fb.textContent = 'Quase. Releia o texto na aba Ler e tente de novo.'; }
          } });
          wrap.appendChild(b); return b;
        });
        wrap.appendChild(fb);
        return [h('span', { class: 'tag app', text: 'Teste o que você aprendeu' }), h('div', { class: 'cardx study' }, [wrap]), stamp()];
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
  var searchToken = 0, sidx = null, sidxPath = '', pidx = null, pidxKey = '';
  function viewSearch() { showScreen('search'); var q = $('#q'); setTimeout(function () { q.focus(); }, 60); if (q.value) runSearch(q.value); }
  async function ensureIndex() {
    if (!manifest.busca) return null;
    if (sidx && sidxPath === manifest.busca) return sidx;
    var pkg = await loadPackage(pkgBy[manifest.busca]);
    sidx = core.searchPrepare(pkg.rows); sidxPath = manifest.busca;
    return sidx;
  }
  function passageIndex() {
    var ps = manifest.passages || [], key = manifest.generation + ':' + ps.length;
    if (pidx && pidxKey === key) return pidx;
    pidx = core.searchPrepare(ps.map(function (p) { return [p.id, 0, 0, (p.titulo || '') + ' ' + p.ref + ' ' + (p.temas || []).join(' ')]; })); pidxKey = key;
    return pidx;
  }
  function snippet(text, ranges) {
    var m = ranges[0] || { start: 0, end: 0 }, from = Math.max(0, m.start - 70), to = Math.min(text.length, Math.max(m.end, m.start) + 110), out = [], pos = from;
    if (from > 0) { var sp = text.indexOf(' ', from); if (sp >= 0 && sp < m.start) from = pos = sp + 1; out.push('…'); }
    if (to < text.length) { var sp2 = text.lastIndexOf(' ', to); if (sp2 > m.end) to = sp2; }
    ranges.forEach(function (r) { if (r.start < pos || r.start >= to) return; out.push(text.slice(pos, r.start)); out.push(h('mark', { text: text.slice(r.start, r.end) })); pos = r.end; });
    out.push(text.slice(pos, to)); if (to < text.length) out.push('…');
    return out;
  }
  async function runSearch(raw) {
    var token = ++searchToken, q = raw.trim(), box = clear($('#results'));
    if (q.length < 2) return;
    var nq = core.normalize(q), list = h('div', { class: 'list' });
    /* 1) referência direta: "João 3:16" */
    var ref = core.parseRef(q), to = ref ? resolveRef(q) : null;
    if (to) { var rb = bookOf(to.book); list.appendChild(h('button', { class: 'item', type: 'button', onclick: function () { go({ v: 'read', b: to.book, c: to.chapter, verse: to.verse }); } }, [h('strong', { text: 'Abrir ' + rb.name + ' ' + to.chapter + (to.verse ? ':' + to.verse : '') }), h('small', { text: 'Ir direto' })])); }
    /* 2) livros */
    catalog().filter(function (b) { return core.normalize(b.name).indexOf(nq) === 0 || core.normalize(b.abbr) === nq || (nq.length >= 3 && core.normalize(b.name).split(' ').some(function (w) { return w.indexOf(nq) === 0; })); }).slice(0, 6).forEach(function (b) {
      list.appendChild(h('button', { class: 'item', type: 'button', onclick: function () { if (b.chapters.length) go({ v: 'chap', b: b.id }); else toast('O texto de ' + b.name + ' ainda não foi incluído no app.'); } }, [h('strong', { text: b.name }), h('small', { text: b.chapters.length ? 'Livro' : 'Sem conteúdo neste aparelho' })]));
    });
    if (list.children.length) box.appendChild(list);
    /* 3) ensinos do app */
    var pr = core.searchRun(passageIndex(), q).hits.slice(0, 6), ps = manifest.passages || [];
    if (pr.length) {
      box.appendChild(h('p', { class: 'count', text: 'Ensinos sobre "' + q + '"' }));
      var pl = h('div', { class: 'list' });
      pr.forEach(function (x) { var p = ps[x.i]; pl.appendChild(h('button', { class: 'hit', type: 'button', onclick: function () { go({ v: 'study', id: p.id }); } }, [h('strong', { text: p.titulo || p.ref }), h('span', { text: p.titulo ? p.ref : '' })])); });
      box.appendChild(pl);
    }
    /* 4) versículos: palavra inteira (e suas formas), não pedaços de outras palavras */
    var info = h('p', { class: 'count', text: 'Buscando…' }); box.appendChild(info);
    var hitsBox = h('div', { class: 'list' }); box.appendChild(hitsBox);
    var idx;
    try { idx = await ensureIndex(); } catch (e) { idx = null; }
    if (token !== searchToken) return;
    if (!idx) { info.textContent = 'A busca no texto ainda não está neste aparelho. Conecte-se à internet uma vez e abra o app de novo.'; return; }
    var res = core.searchRun(idx, q), shown = 0, PAGE = 30, more = h('button', { class: 'btn', type: 'button', style: 'margin:12px auto 0' });
    function names(id) { var b = BK.byId(id); return b ? b.name : id; }
    function draw() {
      var end = Math.min(res.hits.length, shown + PAGE);
      for (var k = shown; k < end; k++) (function (row) {
        var t = row[3];
        hitsBox.appendChild(h('button', { class: 'hit', type: 'button', onclick: function () { go({ v: 'read', b: row[0], c: row[1], verse: row[2] }); } },
          [h('strong', { text: names(row[0]) + ' ' + row[1] + ':' + row[2] }), h('span', {}, snippet(t, core.highlightRanges(t, q)))]));
      })(idx.rows[res.hits[k].i]);
      shown = end; more.style.display = shown >= res.hits.length ? 'none' : 'block'; more.textContent = 'Mostrar mais ' + Math.min(PAGE, res.hits.length - shown);
    }
    more.onclick = draw;
    info.textContent = res.hits.length ? res.hits.length + (res.hits.length === 1 ? ' versículo' : ' versículos') + ' com "' + q + '"' + (res.q.tokens.length > 1 && !res.q.phrase ? ' (todas as palavras)' : '') + '.'
      : (list.children.length || pr.length ? '' : 'Nada encontrado para "' + q + '". Tente outra palavra ou escreva entre aspas uma frase exata.');
    draw(); box.appendChild(more);
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

  /* compartilhar: cartão (foto de paz + frase curta + nome + link) enviado pelo menu do aparelho.
     Se o aparelho não aceitar imagem, vai só o texto com o link; se não houver menu, o link é copiado. Nada é medido nem enviado a servidor. */
  function shareCard(o) {
    toast('Preparando o cartão…');
    var base = SH.baseUrl(cfg.siteUrl, location.href), link = o.id ? SH.studyLink(base, o.id) : base;
    return SH.cardBlob({ text: o.text, sub: o.sub || '', link: cfg.shareLabel || '', photo: SH.photoFor(o.id) })
      .catch(function () { return null; })
      .then(function (blob) { return SH.send({ title: SH.NAME, text: o.msg, url: link, blob: blob, filename: 'cartao.jpg' }, copy); });
  }
  function share() { return shareCard({ text: 'Aprenda a Palavra, no seu ritmo.', msg: SH.appMessage() }); }
  function shareStudy(meta, p) {
    var titulo = p.titulo || meta.ref;
    return shareCard({ id: meta.id, text: p.guarde || p.pergunta || titulo, sub: meta.ref, msg: SH.studyMessage({ titulo: titulo, ref: meta.ref, pergunta: p.pergunta }) });
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
      row('Projeto', 'Palavra Viva — Aprendendo as Escrituras. Gratuito, sem anúncios e sem coleta de dados.'),
      cfg.ownerName ? row('Responsável', cfg.ownerName) : null,
      row('Texto bíblico e referências', lic.text || ''),
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
    var splash = $('#splash'), t0 = Date.now();
    function hideSplash() { if (!splashOn) return; splashOn = false; splash.classList.add('off'); ssSet('pv4-splash', '1'); applyAppearance(); }
    /* a abertura fica na tela, em verde-escuro, até o app terminar de carregar (mínimo 0,7 s) */
    appReady = function () { setTimeout(hideSplash, Math.max(0, 700 - (Date.now() - t0))); };
    if (ssGet('pv4-splash')) { splashOn = false; splash.classList.add('off'); applyAppearance(); }
    else { setTimeout(hideSplash, 8000); splash.addEventListener('click', hideSplash); splash.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') hideSplash(); }); }

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
    $$('[data-act]').forEach(function (b) { b.addEventListener('click', function () { var a = b.dataset.act; if (a === 'read') actRead(); else if (a === 'study') actStudy(); else if (a === 'ensinos') go({ v: 'ens' }); else go({ v: 'marks' }); }); });
    $$('.tt button').forEach(function (c) { c.addEventListener('click', function () { testament = c.dataset.t; $$('.tt button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); }); drawBooks(); }); });
    $('#goSearch').addEventListener('click', function () { go({ v: 'search' }); });
    var qt = null; $('#q').addEventListener('input', function (e) { clearTimeout(qt); var v = e.target.value; qt = setTimeout(function () { runSearch(v); }, 250); });
    $('#fsz').addEventListener('click', function (e) { var s = e.target.closest('button'); if (!s) return; lsSet('pv4-fs', s.dataset.s); applyAppearance(); });
    $('#thm').addEventListener('click', function (e) { var s = e.target.closest('button'); if (!s) return; lsSet('pv4-theme', s.dataset.m); applyAppearance(); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyAppearance);
    $('#inst').addEventListener('click', install); $('#shr').addEventListener('click', share);
    $('#homeShare').addEventListener('click', share);
    $('#qShare').addEventListener('click', function () {
      if (!homeQ) return;
      shareCard({ id: homeQ.f.id, text: homeQ.p.pergunta, sub: homeQ.f.ref, msg: SH.questionMessage({ pergunta: homeQ.p.pergunta }) });
    });
    window.addEventListener('hashchange', function () { var id = takeLink(); if (id && manifest) tryDeepLink(id, true); });
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
    setupSW();
    var deep = takeLink(); // link direto recebido (#estudo=ID): abre depois da tela inicial
    /* abre na hora com o que já está guardado no aparelho; a internet só atualiza por trás */
    var stored = null;
    try { var cc = await caches.open(CONTENT), sm = await cc.match('content-manifest.json'); if (sm) stored = await sm.json(); } catch (e) { stored = null; }
    var cfgDone = loadConfig().then(function () { fillRights(); $('#blessItem').hidden = !cfg.pixKey; });
    function showFirst() {
      indexManifest();
      var s = history.state;
      if (s && s.v && !s.o) curState = s; else { curState = { v: 'home', d: Math.max(0, ((s && s.d) || 1) - 1) }; history.replaceState(curState, ''); }
      render(curState);
    }
    try {
      if (stored && stored.bible) {
        manifest = stored; showFirst();
        if (deep) tryDeepLink(deep, false);
        syncManifest().then(function (m) {
          if (m && manifest && m.generation !== manifest.generation) { manifest = m; indexManifest(); if (curState && curState.v === 'home') render(curState); }
          settleLink();
        }, function () { /* sem internet: segue com o guardado */ settleLink(); });
      } else {
        await cfgDone;
        manifest = await syncManifest();
        if (!manifest) throw new Error('Sem conexão e sem conteúdo guardado. Abra o app uma vez com internet.');
        showFirst();
        if (deep) tryDeepLink(deep, true);
      }
    } catch (e) { fail(e); }
    appReady();
  })();
})();
