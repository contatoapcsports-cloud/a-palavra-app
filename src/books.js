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

/* Miniaturas dos ensinos: paisagens pintadas no aparelho (canvas), sem baixar imagens e sem internet.
   Só no navegador; no teste em Node não faz nada. */
if (typeof document !== 'undefined') {
(function () {
  var THEMES = [
    ['lago', '\\b(agua|aguas|sede|fonte|batism\\w*|rio|rios|mar|mares|tempestad\\w*|barco|barcos|pescad\\w*|onda|ondas|lago|redes)\\b'],
    ['trigo', '\\b(pao|paes|fome|multiplic\\w*|trigo|colheita|seme\\w*|fruto|frutos|vinha|videira|semeador)\\b'],
    ['amanhecer', '\\b(luz|aurora|amanhec\\w*|brilh\\w*|claridade|trevas|ilumin\\w*|nasc\\w*)\\b'],
    ['ceu', '\\b(espirito|fogo|pentecost\\w*|poder|chama|gloria|vento)\\b'],
    ['colina', '\\b(cruz|sacrific\\w*|cordeiro|redenc\\w*|morte|ressurre\\w*|sangue|calvario|sepulcro|tumba)\\b'],
    ['montanha', '\\b(caminho|segu\\w*|discipul\\w*|chamad\\w*|jornada|montanha|monte|tentac\\w*|subir)\\b'],
    ['deserto', '\\b(deserto|jejum|exilio|provac\\w*)\\b'],
    ['campo', '\\b(amor|perdao|perdo\\w*|miseric\\w*|graca|compaix\\w*|alegria|paz|descanso|pastor|ovelha\\w*)\\b']
  ];
  var byKey = null, loading = false, queued = false;
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function lin(g, W, y0, y1, stops) { var l = g.createLinearGradient(0, y0 * W, 0, y1 * W); stops.forEach(function (s, i) { l.addColorStop(i / (stops.length - 1), s); }); g.fillStyle = l; return l; }
  function hills(g, W, y, amp, col, r, f) {
    var p1 = r() * 6, p2 = r() * 6, p3 = r() * 6; g.fillStyle = col; g.beginPath(); g.moveTo(0, W);
    for (var x = 0; x <= W; x += 2) { var t = x / W; g.lineTo(x, W * (y - amp * (0.5 * Math.sin(t * f * 6.28 + p1) + 0.3 * Math.sin(t * f * 13 + p2) + 0.2 * Math.sin(t * f * 27 + p3)))); }
    g.lineTo(W, W); g.closePath(); g.fill();
  }
  function glow(g, W, x, y, rad, c) { var q = g.createRadialGradient(x, y, 0, x, y, rad); q.addColorStop(0, c); q.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = q; g.fillRect(0, 0, W, W); }
  function rays(g, W, x, y, r, a) { g.save(); g.translate(x, y); for (var i = 0; i < 9; i++) { var an = -3.14 + (i / 8) * 3.14 + (r() - 0.5) * 0.2; g.fillStyle = 'rgba(255,240,190,' + a + ')'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an - 0.05) * W * 1.5, Math.sin(an - 0.05) * W * 1.5); g.lineTo(Math.cos(an + 0.05) * W * 1.5, Math.sin(an + 0.05) * W * 1.5); g.fill(); } g.restore(); }
  function clouds(g, W, r, n, col, y0, y1) { for (var i = 0; i < n; i++) { var x = r() * W, y = (y0 + r() * (y1 - y0)) * W, w = W * (0.2 + r() * 0.35); for (var k = 0; k < 6; k++) { g.fillStyle = col; g.beginPath(); g.ellipse(x + (r() - 0.5) * w, y + (r() - 0.5) * W * 0.04, w * (0.3 + r() * 0.3), W * (0.03 + r() * 0.04), 0, 0, 6.3); g.fill(); } } }
  var SCENES = {
    amanhecer: function (g, W, r) { var sx = W * (0.3 + r() * 0.4), sy = W * 0.6; lin(g, W, 0, 0.65, ['#3f7396', '#f0b872', '#fbe6a8']); g.fillRect(0, 0, W, W); glow(g, W, sx, sy, W * 0.7, 'rgba(255,244,200,.95)'); rays(g, W, sx, sy, r, 0.09); hills(g, W, 0.68, 0.1, '#6d8a56', r, 1.2); hills(g, W, 0.8, 0.12, '#46663f', r, 1.6); hills(g, W, 0.95, 0.1, '#274333', r, 2); },
    lago: function (g, W, r) { var sx = W * (0.3 + r() * 0.4); lin(g, W, 0, 0.55, ['#5f9bc6', '#f5dcab']); g.fillRect(0, 0, W, W); glow(g, W, sx, W * 0.5, W * 0.5, 'rgba(255,240,200,.9)'); hills(g, W, 0.56, 0.07, '#4a6c6c', r, 1.4); lin(g, W, 0.55, 1, ['#a7c9d2', '#2d6580']); g.fillRect(0, W * 0.55, W, W); for (var i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,245,215,' + (0.15 + r() * 0.3) + ')'; g.fillRect(sx - W * 0.15 + r() * W * 0.3, W * (0.57 + r() * 0.4), W * (0.04 + r() * 0.1), 1.2); } var bx = W * (0.4 + r() * 0.25), by = W * 0.74; g.fillStyle = '#1d2b2c'; g.beginPath(); g.moveTo(bx - 14, by); g.lineTo(bx + 14, by); g.lineTo(bx + 9, by + 5); g.lineTo(bx - 9, by + 5); g.fill(); g.fillRect(bx - 1, by - 16, 1.6, 16); g.beginPath(); g.moveTo(bx + 1, by - 15); g.lineTo(bx + 11, by - 2); g.lineTo(bx + 1, by - 2); g.fill(); },
    trigo: function (g, W, r) { var sx = W * (0.25 + r() * 0.5); lin(g, W, 0, 0.5, ['#76aedb', '#f9e0a2']); g.fillRect(0, 0, W, W); glow(g, W, sx, W * 0.42, W * 0.5, 'rgba(255,245,205,.9)'); hills(g, W, 0.5, 0.05, '#8c9c5c', r, 1.3); lin(g, W, 0.5, 1, ['#e0b04a', '#8d6a1c']); g.fillRect(0, W * 0.5, W, W); for (var i = 0; i < 520; i++) { var x = r() * W, y = W * (0.52 + r() * 0.5), h = 7 + (y / W - 0.5) * 40, l = (r() - 0.5) * 5, t = (y / W - 0.5); g.strokeStyle = 'hsl(' + (38 + r() * 12) + ',' + (60 + r() * 20) + '%,' + (38 + t * 40 + r() * 14) + '%)'; g.lineWidth = 0.7 + t * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y - h); g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.ellipse(x + l, y - h, 1 + t * 1.6, 2.2 + t * 3, 0, 0, 6.3); g.fill(); } },
    ceu: function (g, W, r) { var sx = W * (0.35 + r() * 0.3), sy = W * 0.45; lin(g, W, 0, 1, ['#1b2a54', '#7b4f6e', '#f09a52']); g.fillRect(0, 0, W, W); glow(g, W, sx, sy, W * 0.6, 'rgba(255,225,150,.95)'); rays(g, W, sx, sy, r, 0.12); clouds(g, W, r, 7, 'rgba(255,200,150,.55)', 0.2, 0.7); clouds(g, W, r, 5, 'rgba(40,40,80,.45)', 0.1, 0.5); hills(g, W, 0.88, 0.06, '#171b2a', r, 1.5); },
    colina: function (g, W, r) { var sx = W * (0.5 + (r() - 0.5) * 0.3); lin(g, W, 0, 0.8, ['#26355b', '#b2698a', '#f6b062']); g.fillRect(0, 0, W, W); glow(g, W, sx, W * 0.55, W * 0.6, 'rgba(255,225,160,.9)'); rays(g, W, sx, W * 0.55, r, 0.08); clouds(g, W, r, 6, 'rgba(40,40,80,.4)', 0.1, 0.45); g.fillStyle = '#1c2227'; g.beginPath(); g.moveTo(0, W); g.quadraticCurveTo(W * 0.5, W * 0.38, W, W); g.fill(); hills(g, W, 1.02, 0.1, '#10161a', r, 1); },
    montanha: function (g, W, r) { lin(g, W, 0, 0.7, ['#6f9cc7', '#f5dfb4']); g.fillRect(0, 0, W, W); glow(g, W, W * 0.7, W * 0.3, W * 0.5, 'rgba(255,245,210,.8)'); [['#8da4bf', 0.45], ['#5d7896', 0.58], ['#3b5472', 0.72]].forEach(function (m) { g.fillStyle = m[0]; g.beginPath(); g.moveTo(0, W); var x = 0, y = W * m[1]; g.lineTo(0, y); while (x < W) { x += W * (0.07 + r() * 0.1); y = W * (m[1] - 0.2 * r()); g.lineTo(Math.min(x, W), y); x += W * (0.04 + r() * 0.07); y = W * (m[1] + 0.05 * r()); g.lineTo(Math.min(x, W), y); } g.lineTo(W, W); g.fill(); }); hills(g, W, 0.88, 0.07, '#2f4a35', r, 1.2); g.strokeStyle = 'rgba(240,215,160,.85)'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(W * 0.3, W); g.bezierCurveTo(W * 0.7, W * 0.9, W * 0.2, W * 0.8, W * 0.55, W * 0.7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(W * 0.55, W * 0.7); g.bezierCurveTo(W * 0.7, W * 0.66, W * 0.5, W * 0.63, W * 0.62, W * 0.6); g.stroke(); },
    deserto: function (g, W, r) { var sx = W * (0.3 + r() * 0.4); lin(g, W, 0, 0.55, ['#78b4dc', '#f8e3b2']); g.fillRect(0, 0, W, W); glow(g, W, sx, W * 0.4, W * 0.5, 'rgba(255,245,210,.9)'); hills(g, W, 0.58, 0.07, '#e6bb72', r, 1); hills(g, W, 0.74, 0.1, '#cc9449', r, 1.3); hills(g, W, 0.92, 0.1, '#a56f2e', r, 1.6); },
    campo: function (g, W, r) { var sx = W * (0.3 + r() * 0.4); lin(g, W, 0, 0.6, ['#e98f6a', '#f7c47c', '#fce9b4']); g.fillRect(0, 0, W, W); glow(g, W, sx, W * 0.5, W * 0.6, 'rgba(255,238,190,.95)'); hills(g, W, 0.6, 0.06, '#7f9a52', r, 1.2); hills(g, W, 0.78, 0.08, '#5f8040', r, 1.5); lin(g, W, 0.8, 1, ['#4b6d32', '#2f4a22']); g.fillRect(0, W * 0.82, W, W); for (var i = 0; i < 70; i++) { g.fillStyle = ['#fff3c4', '#ffd25e', '#ffffff'][(r() * 3) | 0]; g.beginPath(); g.arc(r() * W, W * (0.8 + r() * 0.2), 0.8 + r() * 1.4, 0, 6.3); g.fill(); } },
    vale: function (g, W, r) { lin(g, W, 0, 0.7, ['#8dbad3', '#f1efd6']); g.fillRect(0, 0, W, W); glow(g, W, W * (0.3 + r() * 0.4), W * 0.35, W * 0.5, 'rgba(255,248,215,.9)'); [['#7d9e7c', 0.55], ['#5b8062', 0.68], ['#3f6350', 0.82]].forEach(function (m, i) { hills(g, W, m[1], 0.09, m[0], r, 1.1 + i * 0.4); g.fillStyle = 'rgba(240,244,228,0.28)'; g.fillRect(0, W * (m[1] + 0.02), W, W * 0.08); }); hills(g, W, 1, 0.1, '#254232', r, 1.5); }
  };
  function thumb(p) {
    var t = norm((p.titulo || '') + ' ' + (p.temas || []).join(' ')), kind = 'vale', hs = 7, i;
    for (i = 0; i < THEMES.length; i++) { if (new RegExp(THEMES[i][1]).test(t)) { kind = THEMES[i][0]; break; } }
    String(p.id).split('').forEach(function (ch) { hs = (hs * 31 + ch.charCodeAt(0)) % 99991; });
    var W = 112, c = document.createElement('canvas'); c.width = c.height = W; c.className = 'thumb'; c.setAttribute('aria-hidden', 'true');
    try { SCENES[kind](c.getContext('2d'), W, rng(hs)); } catch (e) { /* fica o fundo verde */ }
    return c;
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
  st.textContent = '.hit.hasimg{flex-direction:row;align-items:center;gap:12px}.thumb{flex:none;width:56px;height:56px;border-radius:14px;background:#1f4a3b;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}.hit .txt{display:flex;flex-direction:column;gap:2px;min-width:0}';
  document.head.appendChild(st);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  load();
})();
}
