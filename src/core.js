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

  return { normalize: normalize, findMatch: findMatch, parseRef: parseRef, stampText: stampText, missingPackages: missingPackages, PREFIX: PREFIX, sha256Hex: sha256Hex, verifyPackage: verifyPackage, planUpdate: planUpdate, cleanupPlan: cleanupPlan, visibleTabs: visibleTabs };
});
