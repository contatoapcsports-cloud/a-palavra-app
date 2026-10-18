/* Fábrica de ensinos: um modelo gera, dois de famílias diferentes (entre si e do gerador) auditam os 36 critérios.
   Os DOIS precisam aprovar tudo. Cada provedor gratuito tem limite diário: quando um acaba, a fábrica troca pelo próximo modelo permitido;
   se não sobrar nenhuma combinação válida, a execução para e retoma no horário seguinte. Vários ensinos andam em paralelo (CONCURRENCIA).
   Uso: node scripts/fabrica/rodar.mjs [raiz]   Variáveis: MAX_ITENS, MAX_MINUTOS, CONCURRENCIA, GROQ_API_KEY, GEMINI_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Groq, Gemini, Cloudflare, QuotaError } from './provedores.mjs';
import { montarFila } from './fila.mjs';
import { validarLocal, refsValidas } from './local.mjs';
import { SISTEMA_GERADOR, pedidoGerador, SISTEMA_AUDITOR, pedidoAuditor } from './prompts.mjs';
import { GATES } from './criterios.mjs';

const raiz = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '../..'));
const R = (...p) => join(raiz, ...p);
const J = p => JSON.parse(readFileSync(R(p), 'utf8'));
const cfg = J('fabrica/config.json');
const doutrina = existsSync(R('fabrica/doutrina.md')) ? readFileSync(R('fabrica/doutrina.md'), 'utf8') : '';
const env = process.env, MAX_ITENS = +(env.MAX_ITENS || 20), MAX_MIN = +(env.MAX_MINUTOS || 150), CONC = Math.max(1, +(env.CONCURRENCIA || 1)), rapido = env.FABRICA_SEM_ESPERA === '1';
const t0 = Date.now();
const linhas = [];
const log = (...a) => { const s = a.join(' '); linhas.push(s); console.log(s); };
const core = createRequire(import.meta.url)(R('src/core.js'));
const BK = createRequire(import.meta.url)(R('src/books.js'));

/* ---------- estado ---------- */
const estadoPath = R('fabrica/estado.json');
const estado = existsSync(estadoPath) ? J('fabrica/estado.json') : { unidades: {}, uso: {} };
estado.unidades = estado.unidades || {}; estado.uso = estado.uso || {};
const salvarEstado = () => { mkdirSync(R('fabrica'), { recursive: true }); writeFileSync(estadoPath, JSON.stringify(estado, null, 1) + '\n'); };

/* ---------- Bíblia instalada (para citações, referências e contexto) ---------- */
const capCache = new Map();
const capitulo = (livro, n) => { const k = livro + '-' + n; if (!capCache.has(k)) { const f = R('content-src/biblia', String(livro), k + '.json'); capCache.set(k, existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).verses : null); } return capCache.get(k); };
const existe = {
  livro: nome => { const q = core.normalize(nome); const b = BK.all().find(x => core.normalize(x.name) === q || core.normalize(x.abbr) === q); return b ? b.id : null; },
  verso: (livro, cap, v) => { const c = capitulo(livro, cap); return !!(c && c.some(x => x.n === v)); }
};

/* ---------- ensinos já prontos ---------- */
function carregarProntos() {
  const out = [], base = R('content-src/camada2');
  if (!existsSync(base)) return out;
  for (const d of readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === 'teste') continue;
    for (const f of readdirSync(join(base, d.name))) if (f.endsWith('.json')) { try { const x = JSON.parse(readFileSync(join(base, d.name, f), 'utf8')); if (!x._teste) out.push({ id: x.id, titulo: x.titulo || '', entender: x.entender || '', viver: x.viver || '', ore: x.ore || '', guarde: x.guarde || '' }); } catch { /* ignora arquivo ruim */ } }
  }
  return out;
}

/* ---------- provedores (um objeto por modelo; o mesmo modelo pode gerar ou auditar, mas nunca os dois no mesmo ensino) ---------- */
const CHAVES = { groq: ['GROQ_API_KEY'], gemini: ['GEMINI_API_KEY'], cloudflare: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] };
const defs = new Map();
for (const lista of [cfg.geradores, cfg.auditores_1, cfg.auditores_2]) for (const d of lista) if (d.provedor) defs.set(d.id, d);
const objs = new Map();
function obter(id) {
  if (objs.has(id)) return objs.get(id);
  const d = defs.get(id); if (!d) { console.error('Modelo sem definição na configuração: ' + id); process.exit(1); }
  const comum = { nome: id, tipo: d.provedor, familia: d.familia, semEspera: rapido };
  let o;
  if (d.provedor === 'groq') o = new Groq({ ...comum, modelo: d.modelo, esforco: d.esforco, chave: env.GROQ_API_KEY, ...(env.GROQ_BASE_URL ? { base: env.GROQ_BASE_URL } : {}) });
  else if (d.provedor === 'gemini') o = new Gemini({ ...comum, modelo: env.GEMINI_MODEL || d.modelo, chave: env.GEMINI_API_KEY, ...(env.GEMINI_BASE_URL ? { base: env.GEMINI_BASE_URL } : {}) });
  else o = new Cloudflare({ ...comum, modelos: d.modelos, chave: env.CLOUDFLARE_API_TOKEN, conta_id: env.CLOUDFLARE_ACCOUNT_ID, ...(env.CLOUDFLARE_BASE_URL ? { base: env.CLOUDFLARE_BASE_URL } : {}) });
  objs.set(id, o); return o;
}
const gens = cfg.geradores.map(d => obter(d.id)), aud1s = cfg.auditores_1.map(d => obter(d.id)), aud2s = cfg.auditores_2.map(d => obter(d.id));
const provs = [...objs.values()];
for (const [prov, nomes] of Object.entries(CHAVES)) if ([...objs.values()].some(o => o.tipo === prov)) for (const v of nomes) if (!env[v]) { log('FALTA o segredo ' + v + ': a fábrica não roda sem ele.'); finalizar(1); }
/* combinação válida: três famílias diferentes e nenhum modelo com limite diário esgotado */
function escolher() {
  for (const g of gens) {
    if (g.bloqueado) continue;
    const a1 = aud1s.find(a => !a.bloqueado && a.familia !== g.familia); if (!a1) continue;
    const a2 = aud2s.find(a => !a.bloqueado && a.familia !== g.familia && a.familia !== a1.familia); if (!a2) continue;
    return { g, a1, a2 };
  }
  return null;
}

/* ---------- montagem do ensino ---------- */
function rng(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function montar(g, u) {
  const t = g.teste || {}, rand = rng(u.id), erradas = Array.isArray(t.erradas) ? t.erradas.slice(0, 2) : [];
  const ops = [String(t.certa || ''), ...erradas.map(String)];
  const ordem = ops.map((_, i) => i).sort(() => rand() - 0.5);
  const opcoes = ordem.map(i => ops[i]), certa = ordem.indexOf(0);
  const refs = refsValidas(Array.isArray(g.refs) ? g.refs : [], existe, u).map(x => x.split('|')[1]);
  return {
    id: u.id, ref: u.ref, book: u.book, chapter: u.chapter, verses: u.verses,
    titulo: String(g.titulo || '').trim(), temas: (Array.isArray(g.temas) ? g.temas : []).map(x => String(x).trim().toLowerCase()),
    pergunta: String(g.pergunta || '').trim(), entender: String(g.entender || '').trim(),
    ligar: { texto: String(g.ligar || '').trim(), selo: g.ligar_selo === true },
    viver: String(g.viver || '').trim(), guarde: String(g.guarde || '').trim(), ore: String(g.ore || '').trim(),
    quiz: { pergunta: String(t.pergunta || '').trim(), opcoes, certa, explicacao: String(t.explicacao || '').trim() },
    refs
  };
}
function lerAuditoria(r) {
  const c = r && (r.criterios || r.gates || r.gate_results);
  if (!c || typeof c !== 'object') return { erro: 'sem o objeto criterios' };
  const falhas = [], faltam = [];
  for (const g of GATES) {
    const v = String(c[g] == null ? '' : c[g]).trim().toUpperCase();
    if (v === 'P' || v === 'PASS' || v === 'PASSOU') continue;
    if (v === 'F' || v === 'FAIL' || v === 'FALHOU') falhas.push(g); else faltam.push(g);
  }
  if (faltam.length) return { erro: 'criterios sem P/F: ' + faltam.slice(0, 5).join(',') };
  const motivos = new Map(); (Array.isArray(r.problemas) ? r.problemas : []).forEach(p => { if (p && p.criterio) motivos.set(String(p.criterio), String(p.motivo || '')); });
  return { falhas: falhas.map(g => g + (motivos.get(g) ? ': ' + motivos.get(g) : '')), aprovado: falhas.length === 0 };
}
async function auditar(prov, u, d) {
  for (let t = 1; t <= 2; t++) {
    const r = await prov.json({ system: SISTEMA_AUDITOR(doutrina), user: pedidoAuditor(u, d), max: prov.tipo === 'gemini' ? 8192 : 4000, temp: 0.1 });
    const a = lerAuditoria(r);
    if (!a.erro) return a;
    log('    [' + u.id + '] ' + prov.nome + ': resposta fora do formato (' + a.erro + ')' + (t === 1 ? ', tentando de novo' : ''));
  }
  throw new Error(prov.nome + ': formato de auditoria inválido duas vezes');
}

async function produzir(u, ctx, c) {
  let feedback = null; const L = '  [' + u.id + '] ';
  for (let rodada = 1; rodada <= cfg.rodadas_por_unidade; rodada++) {
    const g = await c.g.json({ system: SISTEMA_GERADOR(doutrina), user: pedidoGerador(u, ctx.recentes, feedback), max: 6000, temp: 0.6 });
    const d = montar(g, u);
    const erros = validarLocal(d, { versos: u.verses, existentes: ctx.prontos });
    if (erros.length) { log(L + 'rodada ' + rodada + ': verificação automática recusou: ' + erros.join(', ')); feedback = { anterior: g, falhas: erros.map(x => 'automático: ' + x) }; estado.unidades[u.id].ultimo = 'automático: ' + erros.slice(0, 4).join(', '); continue; }
    const a1 = await auditar(c.a1, u, d);
    if (!a1.aprovado) { log(L + 'rodada ' + rodada + ': ' + c.a1.nome + ' recusou: ' + a1.falhas.join(' | ').slice(0, 400)); feedback = { anterior: g, falhas: a1.falhas.map(x => c.a1.familia + ': ' + x) }; estado.unidades[u.id].ultimo = c.a1.nome + ': ' + a1.falhas.join(' | ').slice(0, 300); continue; }
    const a2 = await auditar(c.a2, u, d);
    if (!a2.aprovado) { log(L + 'rodada ' + rodada + ': ' + c.a2.nome + ' recusou: ' + a2.falhas.join(' | ').slice(0, 400)); feedback = { anterior: g, falhas: a2.falhas.map(x => c.a2.familia + ': ' + x) }; estado.unidades[u.id].ultimo = c.a2.nome + ': ' + a2.falhas.join(' | ').slice(0, 300); continue; }
    d.audit = {
      generator: { model: c.g.modelo, family: c.g.familia },
      auditors: [{ model: c.a1.modelo, family: c.a1.familia }, { model: c.a2.modelo, family: c.a2.familia }],
      gates: Object.fromEntries(GATES.map(x => [x, 'P'])), humanReviewed: false, contractVersion: cfg.contrato, auditedAt: new Date().toISOString(), rounds: rodada
    };
    return d;
  }
  return null;
}

/* ---------- laço principal ---------- */
function finalizar(cod) {
  linhas.push('');
  for (const p of provs) { linhas.push(p.resumo()); const u = estado.uso[p.nome] = estado.uso[p.nome] || { chamadas: 0, entrada: 0, saida: 0 }; u.chamadas += p.chamadas; u.entrada += p.tokensIn; u.saida += p.tokensOut; }
  salvarEstado();
  mkdirSync(R('docs'), { recursive: true });
  writeFileSync(R('docs/fabrica.txt'), 'Fábrica de ensinos — execução de ' + new Date().toISOString() + '\n' + linhas.join('\n') + '\n');
  process.exit(cod);
}
async function main() {
  const fila = montarFila(R(), cfg);
  const prontos = carregarProntos(), idsProntos = new Set(prontos.map(x => x.id));
  let feitos = 0, recusados = 0, falhasSeguidas = 0, pulados = 0, andamento = 0, parar = false, cursor = 0;
  const emUso = new Set();
  log('Fila: ' + fila.length + ' trechos; prontos: ' + idsProntos.size + '; limite desta execução: ' + MAX_ITENS + ' ensinos / ' + MAX_MIN + ' min; ' + CONC + ' em paralelo.');
  function proximo() {
    while (cursor < fila.length) {
      const u = fila[cursor++];
      if (idsProntos.has(u.id) || emUso.has(u.id)) continue;
      const e = estado.unidades[u.id] = estado.unidades[u.id] || { execucoes: 0 };
      if (e.estado === 'travado') { pulados++; continue; }
      const idx = u.cap.findIndex(v => v.n === u.v1), fim = u.cap.findIndex(v => v.n === u.v2);
      u.antes = u.cap.slice(Math.max(0, idx - 3), idx); u.depois = u.cap.slice(fim + 1, fim + 4);
      return u;
    }
    return null;
  }
  async function tratar(u) {
    const e = estado.unidades[u.id]; emUso.add(u.id);
    log('> ' + u.ref + ' (' + u.id + ')');
    for (let tentativa = 1; tentativa <= 6 && !parar; tentativa++) {
      const combo = escolher();
      if (!combo) { log('  Nenhuma combinação válida de gerador e auditores com limite livre; parando. Continua no próximo horário.'); parar = true; return; }
      log('  [' + u.id + '] gerador ' + combo.g.nome + ' (' + combo.g.familia + '); auditores ' + combo.a1.nome + ' (' + combo.a1.familia + ') e ' + combo.a2.nome + ' (' + combo.a2.familia + ')');
      try {
        const d = await produzir(u, { prontos, recentes: prontos.slice(-12).map(x => x.titulo).filter(Boolean) }, combo);
        if (d) {
          const dir = R('content-src/camada2', u.book); mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, u.id + '.json'), JSON.stringify(d, null, 1) + '\n');
          prontos.push({ id: d.id, titulo: d.titulo, entender: d.entender, viver: d.viver, ore: d.ore, guarde: d.guarde }); idsProntos.add(d.id);
          e.estado = 'pronto'; e.titulo = d.titulo; feitos++; falhasSeguidas = 0;
          log('  PRONTO [' + u.id + ']: "' + d.titulo + '" (aprovado pelos dois auditores em ' + d.audit.rounds + ' rodada(s))');
        } else {
          e.execucoes++; recusados++; falhasSeguidas = 0;
          if (e.execucoes >= cfg.execucoes_ate_travar) { e.estado = 'travado'; log('  TRAVADO [' + u.id + '] após ' + e.execucoes + ' execuções sem aprovação; precisa de olhar humano: ' + (e.ultimo || '')); }
          else log('  [' + u.id + '] não aprovado nesta execução (' + e.execucoes + '/' + cfg.execucoes_ate_travar + '); tenta de novo depois');
        }
        return;
      } catch (err) {
        if (err instanceof QuotaError || err.quota) { log('  LIMITE DIÁRIO [' + u.id + ']: ' + err.message.slice(0, 300) + ' — troca de modelo, se houver outro permitido.'); continue; }
        falhasSeguidas++; e.ultimo = 'erro: ' + String(err.message).slice(0, 200);
        log('  ERRO [' + u.id + ']: ' + String(err.message).slice(0, 300));
        if (falhasSeguidas >= 4) { log('Quatro erros seguidos; parando para não gastar à toa.'); parar = true; }
        return;
      }
    }
  }
  async function trabalhador() {
    while (!parar) {
      if (feitos + andamento >= MAX_ITENS) { log('Limite de itens desta execução atingido.'); return; }
      if ((Date.now() - t0) / 60000 > MAX_MIN) { log('Tempo máximo da execução atingido.'); parar = true; return; }
      const u = proximo(); if (!u) return;
      andamento++;
      try { await tratar(u); } finally { andamento--; emUso.delete(u.id); salvarEstado(); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, trabalhador));
  const total = fila.length, ok = idsProntos.size;
  log('Resumo: ' + feitos + ' novos ensinos, ' + recusados + ' não aprovados, ' + pulados + ' travados ignorados. Total pronto: ' + ok + ' de ' + total + ' trechos.');
  finalizar(0);
}
main().catch(e => { log('FALHA INESPERADA: ' + (e && e.stack || e)); finalizar(0); });
