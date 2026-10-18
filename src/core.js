/* Núcleo do Palavra Viva: lógica pura, usada pelo app, pelo service worker e pelos testes.
   Sem rede, sem dependências. Regras da seção 5 do plano. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PVCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PREFIX = 'pv4-';

  async function sha256Hex(bytes) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* Confere um pacote baixado contra a entrada do manifesto. Falha fechada. */
  async function verifyPackage(bytes, entry) {
    if (!entry || typeof entry.sha256 !== 'string') return { ok: false, reason: 'entrada_invalida' };
    const h = await sha256Hex(bytes);
    if (h !== entry.sha256) return { ok: false, reason: 'hash_diferente' };
    if (typeof entry.size === 'number' && bytes.byteLength !== entry.size) return { ok: false, reason: 'tamanho_diferente' };
    return { ok: true };
  }

  /* Decide se um manifesto novo é aceito e o que remover do cache.
     Aceita só geração MAIOR (rollback também incrementa a geração).
     Remove do cache o que não consta no manifesto novo e o que foi revogado. */
  function planUpdate(current, incoming, cachedPaths) {
    if (!incoming || !Number.isInteger(incoming.generation) || !Array.isArray(incoming.packages)) {
      return { accept: false, reason: 'manifesto_invalido', remove: [] };
    }
    if (current && Number.isInteger(current.generation)) {
      if (incoming.generation < current.generation) return { accept: false, reason: 'geracao_menor', remove: [] };
      if (incoming.generation === current.generation) return { accept: false, reason: 'mesma_geracao', remove: [] };
    }
    const keep = new Set(incoming.packages.map(function (p) { return p.path; }));
    const revoked = new Set(incoming.revoked || []);
    const shaByPath = new Map();
    ((current && current.packages) || []).forEach(function (p) { shaByPath.set(p.path, p.sha256); });
    incoming.packages.forEach(function (p) { shaByPath.set(p.path, p.sha256); });
    const remove = (cachedPaths || []).filter(function (p) {
      return !keep.has(p) || revoked.has(shaByPath.get(p));
    });
    return { accept: true, reason: 'ok', remove: remove };
  }

  /* Nomes de cache a apagar: só os do app (prefixo pv4-) que não estão na lista de mantidos. */
  function cleanupPlan(cacheNames, keep) {
    const k = new Set(keep || []);
    return (cacheNames || []).filter(function (n) { return n.indexOf(PREFIX) === 0 && !k.has(n); });
  }

  /* Abas visíveis de uma passagem: aba sem conteúdo nunca aparece; nunca "em breve". */
  function visibleTabs(passage) {
    const tabs = [];
    if (!passage) return tabs;
    const has = function (v) { return typeof v === 'string' && v.trim().length > 0; };
    if (Array.isArray(passage.verses) && passage.verses.length) tabs.push('ler');
    if (has(passage.entender)) tabs.push('entender');
    if (passage.ligar && has(passage.ligar.texto)) tabs.push('ligar');
    if (has(passage.viver) || has(passage.guarde) || has(passage.ore)) tabs.push('viver');
    const q = passage.quiz;
    if (q && has(q.pergunta) && Array.isArray(q.opcoes) && q.opcoes.length >= 2 && Number.isInteger(q.certa) && q.certa >= 0 && q.certa < q.opcoes.length) tabs.push('testar');
    if (Array.isArray(passage.refs) && passage.refs.length) tabs.push('aprofundar');
    return tabs;
  }


  /* Texto sem acento e em minúsculas, para busca. */
  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /* Acha a consulta no texto ignorando acento e caixa. Devolve {start,end} nos índices do texto ORIGINAL, ou null. */
  function findMatch(text, query) {
    const q = normalize(query).trim();
    if (!q) return null;
    let nt = '';
    const map = [];
    const src = String(text == null ? '' : text);
    for (let i = 0; i < src.length; i++) {
      const n = normalize(src[i]);
      for (let k = 0; k < n.length; k++) { nt += n[k]; map.push(i); }
    }
    const idx = nt.indexOf(q);
    if (idx < 0) return null;
    return { start: map[idx], end: map[idx + q.length - 1] + 1 };
  }


  /* ---------- busca por palavras (precisa: acha a palavra e suas flexões, não pedaços de outras palavras) ---------- */
  const STOP = new Set('a o as os e de do da dos das em no na nos nas um uma uns umas que se ao aos com por para ou mas me te lhe eu tu ele ela vos meu teu seu sua minha tua como mais'.split(' '));
  const AR = ['o', 'as', 'a', 'amos', 'ais', 'am', 'ei', 'ou', 'aram', 'ava', 'avam', 'ando', 'ado', 'ada', 'ados', 'adas', 'e', 'es', 'em', 'ai', 'ara', 'arao', 'arei', 'aria', 'asse', 'ar', 'armos', 'arem', 'ares', 'emos'];
  const ER = ['o', 'es', 'e', 'emos', 'eis', 'em', 'i', 'eu', 'eram', 'ia', 'iam', 'endo', 'ido', 'ida', 'idos', 'idas', 'a', 'am', 'ei', 'era', 'erao', 'eria', 'er', 'ermos', 'erem'];
  const IR = ['o', 'es', 'e', 'imos', 'is', 'em', 'i', 'iu', 'iram', 'ia', 'iam', 'indo', 'ido', 'ida', 'idos', 'idas', 'a', 'am', 'ira', 'irao', 'iria', 'ir', 'irem'];
  const wordsOf = function (norm) { return norm.match(/[a-z0-9]+/g) || []; };
  /* formas aceitas para uma palavra pesquisada (plural/feminino e, se for verbo, conjugações regulares) */
  function variantsOf(q) {
    const v = new Set([q]);
    if (q.length < 3) return v;
    v.add(q + 's'); v.add(q + 'es');
    if (q.endsWith('s') && q.length > 3) v.add(q.slice(0, -1));
    if (q.endsWith('es') && q.length > 4) v.add(q.slice(0, -2));
    if (q.endsWith('ao')) { const b = q.slice(0, -2); v.add(b + 'oes'); v.add(b + 'aes'); v.add(b + 'aos'); }
    if (/(oes|aes|aos)$/.test(q)) v.add(q.slice(0, -3) + 'ao');
    if (q.endsWith('o')) { const b = q.slice(0, -1); v.add(b + 'a'); v.add(b + 'os'); v.add(b + 'as'); }
    if (q.endsWith('a')) { const b = q.slice(0, -1); v.add(b + 'o'); v.add(b + 'as'); v.add(b + 'os'); }
    if (q.endsWith('l')) v.add(q.slice(0, -1) + 'is');
    if (q.endsWith('m')) v.add(q.slice(0, -1) + 'ns');
    return v;
  }
  function verbFormsOf(q) {
    const out = new Set();
    if (q.length < 4) return out;
    const end = q.slice(-2), stem = q.slice(0, -2);
    const list = end === 'ar' ? AR : end === 'er' ? ER : end === 'ir' ? IR : null;
    if (!list || stem.length < 2) return out;
    list.forEach(function (e) { out.add(stem + e); });
    return out;
  }
  /* Pontua uma palavra do texto contra uma palavra pesquisada: 0 = não é a mesma palavra. */
  /* grupos de palavras da mesma ideia (verbo e substantivo): quem busca "oração" também quer ver "orou", mas essas vêm depois das formas exatas */
  const GRUPOS = ['orar oracao', 'perdoar perdao', 'amar amor', 'salvar salvacao salvador', 'esperar esperanca', 'louvar louvor', 'adorar adoracao', 'pecar pecado pecador', 'arrepender arrependimento', 'batizar batismo', 'ressuscitar ressurreicao', 'abencoar bencao', 'confiar confianca', 'obedecer obediencia', 'servir servo servico', 'julgar juizo julgamento', 'redimir redencao redentor', 'santificar santo santificacao', 'consolar consolo consolacao', 'temer temor', 'jejuar jejum', 'clamar clamor', 'libertar liberdade libertacao', 'reconciliar reconciliacao', 'sofrer sofrimento', 'tentar tentacao', 'ensinar ensino ensinamento', 'pregar pregacao', 'profetizar profeta profecia', 'unir uniao', 'perseverar perseveranca', 'agradecer gratidao', 'gloriar gloria glorificar', 'arrepender conversao converter'].map(function (g) { return g.split(' '); });
  function relatedOf(q) {
    const out = [];
    if (q.length < 3) return out;
    GRUPOS.forEach(function (g) {
      const hit = g.some(function (l) { return l === q || variantsOf(l).has(q) || verbFormsOf(l).has(q); });
      if (hit) g.forEach(function (l) { if (l !== q) out.push({ v: variantsOf(l), f: verbFormsOf(l), l: l }); });
    });
    return out;
  }
  function makeMatcher(q) {
    const variants = variantsOf(q), verbs = verbFormsOf(q), rel = relatedOf(q);
    return function (w) {
      if (w === q) return 3;
      if (variants.has(w)) return 2.5;
      if (verbs.has(w)) return 2.2;
      if (q.length >= 4 && w.length > q.length && w.length - q.length <= 4 && w.startsWith(q)) return 1.2;
      for (let i = 0; i < rel.length; i++) if (w === rel[i].l || rel[i].v.has(w) || rel[i].f.has(w)) return 1.5;
      return 0;
    };
  }
  function parseQuery(raw) {
    let s = String(raw == null ? '' : raw).trim(), phrase = false;
    if (s.length > 2 && /^["“].*["”]$/.test(s)) { phrase = true; s = s.slice(1, -1); }
    const all = wordsOf(normalize(s));
    let toks = phrase ? all : all.filter(function (w) { return !STOP.has(w); });
    if (!toks.length) toks = all;
    return { phrase: phrase, tokens: toks.slice(0, 8) };
  }
  /* rows: [[livro, capítulo, versículo, texto], ...] */
  function searchPrepare(rows) {
    const words = new Array(rows.length), norm = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) { const n = normalize(rows[i][3]); norm[i] = n; words[i] = wordsOf(n); }
    return { rows: rows, norm: norm, words: words };
  }
  function searchRun(idx, raw) {
    const q = parseQuery(raw);
    if (!q.tokens.length) return { q: q, hits: [] };
    const hits = [];
    if (q.phrase) {
      const needle = q.tokens.join(' ');
      for (let i = 0; i < idx.words.length; i++) if ((' ' + idx.words[i].join(' ') + ' ').indexOf(' ' + needle + ' ') >= 0) hits.push({ i: i, score: 10 + q.tokens.length });
      return { q: q, hits: hits };
    }
    const ms = q.tokens.map(makeMatcher);
    for (let i = 0; i < idx.words.length; i++) {
      const ws = idx.words[i]; let total = 0, ok = true; const pos = [];
      for (let t = 0; t < ms.length && ok; t++) {
        let best = 0, at = -1;
        for (let k = 0; k < ws.length; k++) { const sc = ms[t](ws[k]); if (sc > best) { best = sc; at = k; if (sc === 3) break; } }
        if (!best) ok = false; else { total += best; pos.push(at); }
      }
      if (!ok) continue;
      for (let t = 1; t < pos.length; t++) if (pos[t] === pos[t - 1] + 1) total += 3; else if (Math.abs(pos[t] - pos[t - 1]) <= 4) total += 1;
      hits.push({ i: i, score: total + 2 / (1 + idx.norm[i].length / 100) });
    }
    hits.sort(function (a, b) { return (b.score - a.score) || (a.i - b.i); });
    return { q: q, hits: hits };
  }
  /* Trechos {start,end} do texto ORIGINAL que casam com a busca (para destacar). */
  function highlightRanges(text, raw) {
    const q = parseQuery(raw), out = [], src = String(text == null ? '' : text);
    const re = /[\p{L}\p{N}]+/gu; let m;
    if (q.phrase) {
      const parts = []; while ((m = re.exec(src))) parts.push({ w: normalize(m[0]), s: m.index, e: m.index + m[0].length });
      for (let i = 0; i + q.tokens.length <= parts.length; i++) {
        let ok = true; for (let t = 0; t < q.tokens.length; t++) if (parts[i + t].w !== q.tokens[t]) { ok = false; break; }
        if (ok) out.push({ start: parts[i].s, end: parts[i + q.tokens.length - 1].e });
      }
      return out;
    }
    const ms = q.tokens.map(makeMatcher);
    while ((m = re.exec(src))) { const w = normalize(m[0]); if (ms.some(function (f) { return f(w) > 0; })) out.push({ start: m.index, end: m.index + m[0].length }); }
    return out;
  }

  /* Separa "Livro de Teste 1:2" ou "João 3:16" em {name, chapter, verse}. */
  function parseRef(ref) {
    const m = /^\s*(.+?)\s+(\d+)(?::(\d+))?(?:\s*[-–]\s*\d+)?\s*$/.exec(String(ref || ''));
    if (!m) return null;
    return { name: m[1], chapter: parseInt(m[2], 10), verse: m[3] ? parseInt(m[3], 10) : null };
  }

  /* Selo de autoria do ensino. Texto fixo exigido pelo plano; "Revisado por pessoa" só se humanReviewed === true. */
  function stampText(passage) {
    if (!passage) return '';
    if (passage._teste === true) return 'Exemplo de teste: este texto é fictício.';
    let t = 'Ensino do app, não é a Bíblia. Gerado por IA e conferido por outras IAs.';
    if (passage.audit && passage.audit.humanReviewed === true) t += ' Revisado por pessoa.';
    return t;
  }

  /* Cronograma de download: lista de pacotes que faltam no cache. */
  function missingPackages(manifest, cachedPaths) {
    const have = new Set(cachedPaths || []);
    return ((manifest && manifest.packages) || []).filter(function (p) { return !have.has(p.path); });
  }

  return { searchPrepare: searchPrepare, searchRun: searchRun, highlightRanges: highlightRanges, parseQuery: parseQuery, normalize: normalize, findMatch: findMatch, parseRef: parseRef, stampText: stampText, missingPackages: missingPackages, PREFIX: PREFIX, sha256Hex: sha256Hex, verifyPackage: verifyPackage, planUpdate: planUpdate, cleanupPlan: cleanupPlan, visibleTabs: visibleTabs };
});
