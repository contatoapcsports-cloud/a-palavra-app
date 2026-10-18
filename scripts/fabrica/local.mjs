/* Verificações automáticas (sem IA) antes de gastar auditoria: tamanho, idioma, citações, repetição, referências. */
const norm = v => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const palavras = v => norm(v).split(' ').filter(Boolean);
const jaccard = (a, b) => { const A = new Set(palavras(a).filter(x => x.length > 2)), B = new Set(palavras(b).filter(x => x.length > 2)); if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i); };
const escritaEstranha = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Thai}]/u;
const ingles = /\b(?:however|therefore|because|without|instead|although|whereas|would|should|could|through|scripture|worship|repentance|obedience|believers|fulfillment|the|and|with)\b/i;
const meta = [/\bgemini\b/i, /\bgroq\b/i, /intelig[eê]ncia artificial/i, /\bprompt\b/i, /\bapi\b/i, /\bauditor(?:ia)?\b/i, /certificad[oa]/i, /\bjson\b/i, /\bcomo (?:uma )?ia\b/i];
const modelos = [/a passagem chama aten[cç][aã]o para o que deus revela/i, /ao reler o contexto/i, /o ponto central de .+ merece ser guardado/i, /escolha uma atitude concreta e humilde/i, /ajuda-me a ouvir o ensino sobre/i, /^este vers[ií]culo ensina sobre\b/i, /\bo texto diz\s*:/i, /^diante do ensino sobre\b/i, /^guarde\s*:/i, /usa este ensino sobre/i, /guarde este ponto\s*:/i, /neste trecho, deus nos ensina que/i];
const CAMPOS = { titulo: [8, 90], pergunta: [15, 170], entender: [450, 1500], ligar: [150, 750], viver: [200, 850], guarde: [15, 220], ore: [80, 450] };

export function citacoes(txt) { return String(txt || '').match(/[“"][^”"]{3,}[”"]/g) || []; }
export function validarLocal(d, ctx) {
  const e = [];
  const str = (x, nome, [min, max]) => { if (typeof x !== 'string' || !x.trim()) { e.push(nome + ':vazio'); return false; } const l = x.trim().length; if (l < min) e.push(nome + ':curto:' + l); if (l > max) e.push(nome + ':longo:' + l); return true; };
  for (const [c, lim] of Object.entries(CAMPOS)) if (c !== 'ligar') str(d[c], c, lim);
  if (d.pergunta && !/\?\s*$/.test(d.pergunta)) e.push('pergunta:sem_interrogacao');
  if (typeof d.ligar !== 'object' || !d.ligar) e.push('ligar:ausente'); else { str(d.ligar.texto, 'ligar.texto', CAMPOS.ligar); if (typeof d.ligar.selo !== 'boolean') e.push('ligar.selo:nao_booleano'); }
  const textos = { titulo: d.titulo, pergunta: d.pergunta, entender: d.entender, ligar: d.ligar && d.ligar.texto, viver: d.viver, guarde: d.guarde, ore: d.ore, 'quiz.pergunta': d.quiz && d.quiz.pergunta, 'quiz.explicacao': d.quiz && d.quiz.explicacao };
  if (d.guarde && palavras(d.guarde).length > 26) e.push('guarde:mais_de_26_palavras');
  if (d.guarde && palavras(d.guarde).length < 4) e.push('guarde:muito_curto');
  if (d.entender && String(d.entender).split(/\n\s*\n/).filter(x => x.trim()).length < 2) e.push('entender:menos_de_2_paragrafos');
  if (!Array.isArray(d.temas) || d.temas.length < 2 || d.temas.length > 6 || d.temas.some(t => typeof t !== 'string' || t.trim().length < 2 || t.length > 30)) e.push('temas:invalidos');
  const q = d.quiz;
  if (!q || typeof q !== 'object') e.push('quiz:ausente');
  else {
    if (!Array.isArray(q.opcoes) || q.opcoes.length !== 3 || q.opcoes.some(o => typeof o !== 'string' || o.trim().length < 2 || o.length > 140) || new Set(q.opcoes.map(norm)).size !== 3) e.push('quiz:opcoes_invalidas');
    if (!Number.isInteger(q.certa) || q.certa < 0 || q.certa > 2) e.push('quiz:certa_invalida');
    if (typeof q.explicacao !== 'string' || q.explicacao.trim().length < 20 || q.explicacao.length > 320) e.push('quiz:explicacao_invalida');
    if (typeof q.pergunta !== 'string' || q.pergunta.trim().length < 10 || q.pergunta.length > 220) e.push('quiz:pergunta_invalida');
  }
  const todo = Object.values(textos).filter(x => typeof x === 'string').join('\n') + (q && Array.isArray(q.opcoes) ? '\n' + q.opcoes.join('\n') : '');
  for (const [campo, t] of Object.entries(textos)) {
    if (typeof t !== 'string') continue;
    if (/<[^>]+>/.test(t) || /[{}[\]]/.test(t)) e.push(campo + ':marcacao');
    if (escritaEstranha.test(t)) e.push(campo + ':escrita_estranha');
    const m = ingles.exec(t); if (m) e.push(campo + ':ingles:' + m[0].toLowerCase());
    for (const p of meta) if (p.test(t)) e.push(campo + ':linguagem_de_sistema');
    for (const p of modelos) if (p.test(t.trim())) e.push(campo + ':frase_modelo');
    if (/\.\.\.\s*$/.test(t.trim())) e.push(campo + ':truncado');
  }
  /* citações: curtas e presentes no texto bíblico dado */
  const alvo = norm(ctx.versos.map(v => v.t).join(' '));
  for (const [campo, t] of Object.entries(textos)) for (const c of citacoes(t)) {
    const n = palavras(c).length;
    if (n > 16) e.push(campo + ':citacao_longa');
    else if (n >= 4 && !alvo.includes(norm(c))) e.push(campo + ':citacao_fora_do_texto');
  }
  if (norm(d.entender).length >= 60 && norm(d.entender).includes(norm(ctx.versos.map(v => v.t).join(' ')).slice(0, 200))) e.push('entender:copia_o_texto');
  const pares = [['entender', 'viver'], ['entender', 'ore'], ['entender', 'ligar'], ['viver', 'ore'], ['viver', 'ligar'], ['ligar', 'ore']];
  for (const [a, b] of pares) if (jaccard(textos[a], textos[b]) >= 0.5) e.push('repete_entre_secoes:' + a + ':' + b);
  /* repetição em relação aos ensinos já prontos */
  for (const o of ctx.existentes || []) {
    if (jaccard(d.entender, o.entender) >= 0.45) e.push('parecido_com:' + o.id);
    for (const campo of ['entender', 'viver', 'ore', 'guarde']) {
      const a = palavras(d[campo]).slice(0, 5).join(' '), b = palavras(o[campo]).slice(0, 5).join(' ');
      if (a && a === b) { e.push('abertura_repetida:' + campo + ':' + o.id); break; }
    }
    if (palavras(d.titulo).join(' ') === palavras(o.titulo).join(' ')) e.push('titulo_repetido:' + o.id);
  }
  /* referências cruzadas: precisam existir no texto da Bíblia instalado */
  const refs = Array.isArray(d.refs) ? d.refs : [];
  if (refs.length < 2 || refs.length > 5) e.push('refs:quantidade');
  return [...new Set(e)];
}

/* confere "Livro cap:v" contra os capítulos existentes; devolve só as válidas e fora do trecho */
export function refsValidas(refs, existe, trecho) {
  const ok = [];
  for (const r of refs || []) {
    const m = /^\s*(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\s*$/.exec(String(r));
    if (!m) continue;
    const livro = existe.livro(m[1]); if (!livro) continue;
    const cap = +m[2], v1 = +m[3], v2 = m[4] ? +m[4] : v1;
    if (!existe.verso(livro, cap, v1) || !existe.verso(livro, cap, v2) || v2 < v1) continue;
    if (livro === trecho.book && cap === trecho.chapter && v1 >= trecho.v1 && v2 <= trecho.v2) continue;
    ok.push(livro + '|' + m[0].trim());
  }
  return ok;
}
