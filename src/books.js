/* Cânon bíblico fixo (66 livros): nomes, siglas, testamento e número de capítulos.
   O conteúdo (texto) vem dos pacotes; aqui só a estrutura, que não muda. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PVBooks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* [nome, sigla, capítulos] — AT = 39 primeiros, NT = 27 últimos */
  var RAW = [
    ['Gênesis', 'Gn', 50], ['Êxodo', 'Êx', 40], ['Levítico', 'Lv', 27], ['Números', 'Nm', 36], ['Deuteronômio', 'Dt', 34],
    ['Josué', 'Js', 24], ['Juízes', 'Jz', 21], ['Rute', 'Rt', 4], ['1 Samuel', '1Sm', 31], ['2 Samuel', '2Sm', 24],
    ['1 Reis', '1Rs', 22], ['2 Reis', '2Rs', 25], ['1 Crônicas', '1Cr', 29], ['2 Crônicas', '2Cr', 36], ['Esdras', 'Ed', 10],
    ['Neemias', 'Ne', 13], ['Ester', 'Et', 10], ['Jó', 'Jó', 42], ['Salmos', 'Sl', 150], ['Provérbios', 'Pv', 31],
    ['Eclesiastes', 'Ec', 12], ['Cantares', 'Ct', 8], ['Isaías', 'Is', 66], ['Jeremias', 'Jr', 52], ['Lamentações', 'Lm', 5],
    ['Ezequiel', 'Ez', 48], ['Daniel', 'Dn', 12], ['Oseias', 'Os', 14], ['Joel', 'Jl', 3], ['Amós', 'Am', 9],
    ['Obadias', 'Ob', 1], ['Jonas', 'Jn', 4], ['Miqueias', 'Mq', 7], ['Naum', 'Na', 3], ['Habacuque', 'Hc', 3],
    ['Sofonias', 'Sf', 3], ['Ageu', 'Ag', 2], ['Zacarias', 'Zc', 14], ['Malaquias', 'Ml', 4],
    ['Mateus', 'Mt', 28], ['Marcos', 'Mc', 16], ['Lucas', 'Lc', 24], ['João', 'Jo', 21], ['Atos', 'At', 28],
    ['Romanos', 'Rm', 16], ['1 Coríntios', '1Co', 16], ['2 Coríntios', '2Co', 13], ['Gálatas', 'Gl', 6], ['Efésios', 'Ef', 6],
    ['Filipenses', 'Fp', 4], ['Colossenses', 'Cl', 4], ['1 Tessalonicenses', '1Ts', 5], ['2 Tessalonicenses', '2Ts', 3],
    ['1 Timóteo', '1Tm', 6], ['2 Timóteo', '2Tm', 4], ['Tito', 'Tt', 3], ['Filemom', 'Fm', 1], ['Hebreus', 'Hb', 13],
    ['Tiago', 'Tg', 5], ['1 Pedro', '1Pe', 5], ['2 Pedro', '2Pe', 3], ['1 João', '1Jo', 5], ['2 João', '2Jo', 1],
    ['3 João', '3Jo', 1], ['Judas', 'Jd', 1], ['Apocalipse', 'Ap', 22]
  ];
  var LIST = RAW.map(function (r, i) {
    return { id: String(i + 1), name: r[0], abbr: r[1], chapters: r[2], testament: i < 39 ? 'at' : 'nt' };
  });
  var BY_ID = {};
  LIST.forEach(function (b) { BY_ID[b.id] = b; });

  function all() { return LIST.slice(); }
  function byId(id) { return BY_ID[String(id)] || null; }

  return { all: all, byId: byId };
});

/* Miniaturas dos ensinos (só no navegador; no teste em Node não faz nada). */
if (typeof document !== 'undefined') {
(function () {
  var COLORS = [['#1f5c4a', '#0d2e26'], ['#7a5a1c', '#3b2a0a'], ['#2c4a6e', '#12233a'], ['#6b2f3a', '#2e1218'], ['#3d5a2a', '#17260e'], ['#5a3d73', '#26172f']];
  var MOTIFS = [
    ['luz|aurora|amanhec|brilh|claridade|trevas|ilumin', '<circle cx="28" cy="28" r="9"/><path d="M28 6v8M28 42v8M6 28h8M42 28h8M12 12l6 6M38 38l6 6M44 12l-6 6M18 38l-6 6"/>'],
    ['agua|sede|fonte|batism|rio |mar |tempestad|barco|pescad|onda', '<path d="M8 22q5-6 10 0t10 0 10 0 10 0M8 32q5-6 10 0t10 0 10 0 10 0M8 42q5-6 10 0t10 0 10 0 10 0"/>'],
    ['pao|fome|multiplic|trigo|colheita|seme|fruto|vinha', '<path d="M28 50V16M28 22c-6-1-8-5-8-10 6 0 8 4 8 10zM28 22c6-1 8-5 8-10-6 0-8 4-8 10zM28 34c-6-1-8-5-8-10 6 0 8 4 8 10zM28 34c6-1 8-5 8-10-6 0-8 4-8 10z"/>'],
    ['cruz|sacrific|cordeiro|redenc|morte|ressurre|sangue|calvario', '<path d="M28 6v44M14 20h28"/>'],
    ['amor|perdao|perdo|miseric|graca|coracao|compaix|alegria|paz', '<path d="M28 48C8 34 10 14 21 14c4 0 7 3 7 6 0-3 3-6 7-6 11 0 13 20-7 34z"/>'],
    ['espirito|fogo|pomba|pentecost|poder|chama', '<path d="M29 6c2 11 14 15 14 29a15 15 0 0 1-30 0c0-7 5-10 6-17 4 3 5 6 6 9 3-7 2-14 4-21z"/>'],
    ['caminho|segu|discipul|chamad|jornada|montanha|monte|deserto|tentac', '<path d="M5 46l16-26 9 14 6-9 15 21z"/>'],
    ['', '<path d="M8 14h15q5 0 5 5v27q0-5-5-5H8zM48 14H33q-5 0-5 5v27q0-5 5-5h15z"/>']
  ];
  var byKey = null, loading = false, queued = false;
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function thumb(p) {
    var t = norm((p.titulo || '') + ' ' + (p.temas || []).join(' ')), m = MOTIFS[MOTIFS.length - 1][1], hs = 0, i;
    for (i = 0; i < MOTIFS.length - 1; i++) { if (new RegExp(MOTIFS[i][0]).test(t)) { m = MOTIFS[i][1]; break; } }
    String(p.id).split('').forEach(function (ch) { hs = (hs * 31 + ch.charCodeAt(0)) % 9973; });
    var c = COLORS[hs % COLORS.length], d = document.createElement('span');
    d.className = 'thumb'; d.setAttribute('aria-hidden', 'true');
    d.style.background = 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ')';
    d.innerHTML = '<svg viewBox="0 0 56 56" focusable="false">' + m + '</svg>';
    return d;
  }
  function decorate() {
    queued = false;
    if (!byKey) return;
    var btns = document.querySelectorAll('.hit:not([data-th])');
    Array.prototype.forEach.call(btns, function (b) {
      b.setAttribute('data-th', '1');
      var st = b.querySelector(':scope > strong'), sp = b.querySelector(':scope > span');
      if (!st || !sp) return;
      var p = byKey[st.textContent + '|' + sp.textContent];
      if (!p) return;
      var wrap = document.createElement('span');
      wrap.className = 'txt'; wrap.appendChild(st); wrap.appendChild(sp);
      b.appendChild(wrap); b.insertBefore(thumb(p), wrap); b.classList.add('hasimg');
    });
  }
  function schedule() { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(decorate); } }
  function load() {
    if (loading) return; loading = true;
    fetch('content-manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      byKey = {};
      (m.passages || []).forEach(function (p) { byKey[(p.titulo || p.ref) + '|' + p.ref] = p; byKey[p.titulo + '|' + p.ref] = p; });
      schedule();
    }).catch(function () { loading = false; });
  }
  var st = document.createElement('style');
  st.textContent = '.hit.hasimg{flex-direction:row;align-items:center;gap:12px}.thumb{flex:none;width:52px;height:52px;border-radius:14px;display:grid;place-items:center;color:#f6e7c1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}.thumb svg{width:34px;height:34px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}.hit .txt{display:flex;flex-direction:column;gap:2px;min-width:0}';
  document.head.appendChild(st);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  load();
})();
}
