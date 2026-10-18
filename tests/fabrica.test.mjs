import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, cpSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { GATES } from '../scripts/fabrica/criterios.mjs';
import { validarLocal } from '../scripts/fabrica/local.mjs';
import { cortar } from '../scripts/fabrica/fila.mjs';
import { extrairJson } from '../scripts/fabrica/provedores.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BOM = {
  titulo: 'Nascer de novo: a conversa de Nicodemos',
  temas: ['novo nascimento', 'fé', 'espírito'],
  pergunta: 'O que Jesus quis dizer quando falou em nascer de novo?',
  entender: 'Nicodemos era um líder religioso respeitado, e mesmo assim procurou Jesus de noite, quando ninguém estava vendo. Ele reconhece que Jesus vem de Deus por causa dos sinais, mas ainda não entendeu o que está em jogo.\n\nJesus responde de um jeito inesperado: "Em verdade, em verdade te digo" que ninguém vê o Reino de Deus sem nascer de novo. Não se trata de recomeçar a vida por esforço próprio, e sim de uma obra do Espírito, que age como o vento: não se controla, mas se percebe pelos efeitos. A dúvida de Nicodemos mostra como é difícil aceitar que Deus é quem dá o novo começo.',
  ligar: 'Este encontro prepara o caminho para o versículo mais conhecido do capítulo. O novo nascimento só é possível por causa de Jesus, que veio para trazer vida e não condenação. Quem nasce do alto recebe a vida que só Cristo dá, por meio da fé nele.',
  ligar_selo: true,
  viver: 'Muita gente tenta melhorar por conta própria e se cansa. A conversa com Nicodemos convida a parar de se apoiar nas próprias credenciais e a pedir a Deus um coração novo.\n\nEsta semana, tire alguns minutos para dizer a Deus, com sinceridade, onde você tem tentado resolver tudo sozinho, e peça a ajuda do Espírito.',
  guarde: 'Quem nasce do Espírito recebe de Deus um novo começo que nenhum esforço humano consegue produzir.',
  ore: 'Senhor, como Nicodemos, eu venho a Ti com perguntas. Faze em mim o novo nascimento que só o Teu Espírito pode dar, e ajuda-me a confiar em Jesus e não nas minhas próprias conquistas.',
  teste: { pergunta: 'Por que Nicodemos foi procurar Jesus de noite?', certa: 'Para conversar com Jesus longe da multidão e fazer suas perguntas', erradas: ['Porque Jesus só atendia depois do pôr do sol', 'Porque queria prender Jesus sem ser visto'], explicacao: 'O texto não diz o motivo exato, mas a visita noturna sugere cautela de um líder que queria ouvir Jesus em particular.' },
  refs: ['Romanos 5:8', 'Efésios 2:8-9']
};
const tudoP = () => ({ criterios: Object.fromEntries(GATES.map(g => [g, 'P'])), problemas: [] });
const comF = g => ({ criterios: { ...tudoP().criterios, [g]: 'F' }, problemas: [{ criterio: g, motivo: 'oração genérica demais' }] });

/* servidor falso das três APIs; "roteiro" define o que cada chamada devolve */
function servidor(roteiro) {
  const cont = { groq: 0, gemini: 0, cf: 0 };
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.url.startsWith('/openai/v1/chat/completions')) { const n = cont.groq++; const g = roteiro.groq(n, JSON.parse(body)); return g.status ? send(g.status, g.body) : send(200, { choices: [{ message: { content: JSON.stringify(g) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1000, completion_tokens: 900 } }); }
      if (req.url.includes(':generateContent')) { const n = cont.gemini++; const g = roteiro.gemini(n); return g.status ? send(g.status, g.body) : send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(g) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 300 } }); }
      if (req.url.includes('/ai/run/')) { const n = cont.cf++; const g = roteiro.cf(n); return g.status ? send(g.status, g.body) : send(200, { success: true, result: { response: JSON.stringify(g), usage: { prompt_tokens: 2000, completion_tokens: 300 } } }); }
      send(404, {});
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, cont, url: 'http://127.0.0.1:' + srv.address().port })));
}
function rodar(roteiro, conc = 1) {
  return servidor(roteiro).then(async ({ srv, cont, url }) => {
    const d = mkdtempSync(join(tmpdir(), 'fab-'));
    cpSync(join(root, 'src'), join(d, 'src'), { recursive: true });
    mkdirSync(join(d, 'fabrica'));
    for (const f of ['config.json', 'doutrina.md']) cpSync(join(root, 'fabrica', f), join(d, 'fabrica', f)); // sem estado.json real
    cpSync(join(root, 'tests/fixtures/fabrica/content-src'), join(d, 'content-src'), { recursive: true });
    const out = await new Promise(res => {
      const ch = spawn('node', [join(root, 'scripts/fabrica/rodar.mjs'), d], { env: { ...process.env, FABRICA_SEM_ESPERA: '1', MAX_ITENS: '3', CONCURRENCIA: String(conc), GROQ_API_KEY: 'k1', GEMINI_API_KEY: 'k2', CLOUDFLARE_API_TOKEN: 'k3', CLOUDFLARE_ACCOUNT_ID: 'acc', GROQ_BASE_URL: url, GEMINI_BASE_URL: url, CLOUDFLARE_BASE_URL: url } });
      let o = ''; ch.stdout.on('data', c => o += c); ch.stderr.on('data', c => o += c); ch.on('close', code => res({ code, o }));
    });
    srv.close();
    return { d, cont, ...out };
  });
}
const doc = d => JSON.parse(readFileSync(join(d, 'content-src/camada2/43/43-3-1-12.json'), 'utf8'));

test('caminho feliz: gera, os dois auditores aprovam, grava com auditoria completa', async () => {
  const r = await rodar({ groq: () => BOM, gemini: () => tudoP(), cf: () => tudoP() });
  assert.equal(r.code, 0, r.o);
  const p = doc(r.d);
  assert.equal(p.id, '43-3-1-12'); assert.equal(p.ref, 'João 3:1-12');
  assert.equal(p.verses.length, 12);
  assert.equal(p.audit.auditors.length, 2);
  assert.deepEqual(new Set([p.audit.generator.family, ...p.audit.auditors.map(a => a.family)]).size, 3);
  assert.equal(Object.keys(p.audit.gates).length, 36); assert.ok(Object.values(p.audit.gates).every(x => x === 'P'));
  assert.equal(p.quiz.opcoes.length, 3); assert.equal(p.quiz.opcoes[p.quiz.certa], BOM.teste.certa);
  assert.deepEqual(p.refs, ['Romanos 5:8', 'Efésios 2:8-9']);
  assert.ok(existsSync(join(r.d, 'docs/fabrica.txt')) && existsSync(join(r.d, 'fabrica/estado.json')));
});
test('auditor que recusa devolve o motivo ao gerador; só vale quando os dois aprovam a nova versão', async () => {
  let pedidoFeedback = '';
  const r = await rodar({ groq: (n, b) => { if (n === 1) pedidoFeedback = b.messages[1].content; return BOM; }, gemini: n => n === 0 ? comF('NO_GENERIC_PRAYER') : tudoP(), cf: () => tudoP() });
  assert.equal(r.code, 0, r.o);
  assert.ok(pedidoFeedback.includes('NO_GENERIC_PRAYER') && pedidoFeedback.includes('oração genérica demais'));
  assert.equal(doc(r.d).audit.rounds, 2);
  assert.equal(r.cont.gemini, 2); assert.equal(r.cont.cf, 1, 'o segundo auditor só é chamado depois que o primeiro aprova');
});
test('segundo auditor recusando impede a publicação, mesmo com o primeiro aprovando', async () => {
  const r = await rodar({ groq: () => BOM, gemini: () => tudoP(), cf: () => comF('UNSUPPORTED_CLAIM') });
  assert.equal(r.code, 0, r.o);
  assert.ok(!existsSync(join(r.d, 'content-src/camada2/43/43-3-1-12.json')));
  assert.ok(r.o.includes('não aprovado'));
});
test('verificação automática barra texto ruim antes de gastar auditoria', async () => {
  const ruim = { ...BOM, ore: 'Senhor, however, ajuda-me.' };
  const r = await rodar({ groq: () => ruim, gemini: () => tudoP(), cf: () => tudoP() });
  assert.equal(r.cont.gemini, 0);
  assert.ok(!existsSync(join(r.d, 'content-src/camada2/43/43-3-1-12.json')));
});
test('limite diário de um auditor para a execução sem publicar nada', async () => {
  const r = await rodar({ groq: () => BOM, gemini: () => ({ status: 429, body: { error: { message: 'You exceeded your current quota, please check: requests per day limit' } } }), cf: () => tudoP() });
  assert.equal(r.code, 0, r.o);
  assert.ok(r.o.includes('LIMITE DIÁRIO'));
  assert.ok(!existsSync(join(r.d, 'content-src/camada2/43/43-3-1-12.json')));
  assert.equal(r.cont.cf, 0);
});
test('resposta de auditor fora do formato não conta como aprovação', async () => {
  const r = await rodar({ groq: () => BOM, gemini: () => ({ criterios: { TARGET_FIDELITY: 'P' } }), cf: () => tudoP() });
  assert.ok(!existsSync(join(r.d, 'content-src/camada2/43/43-3-1-12.json')));
});
test('verificação local: citação inventada, repetição e referências', () => {
  const versos = [{ n: 1, t: 'E havia um homem dos fariseus, cujo nome era Nicodemos.' }];
  const base = { ...BOM, ligar: { texto: BOM.ligar, selo: true }, quiz: { pergunta: BOM.teste.pergunta, opcoes: ['a1', 'b2', 'c3'], certa: 0, explicacao: BOM.teste.explicacao } };
  const erros = validarLocal({ ...base, entender: base.entender + ' Ele disse "esta frase nunca esteve no texto bíblico dado".' }, { versos, existentes: [] });
  assert.ok(erros.some(e => e.includes('citacao_fora_do_texto')));
  const rep = validarLocal(base, { versos, existentes: [{ id: 'x', titulo: 'Outro', entender: base.entender, viver: '', ore: '', guarde: '' }] });
  assert.ok(rep.some(e => e.startsWith('parecido_com')));
});
test('trechos longos são cortados em partes de tamanho parecido', () => {
  const v = Array.from({ length: 36 }, (_, i) => ({ n: i + 1, t: 'frase ' + (i + 1) + '.' }));
  const p = cortar(v, 12);
  assert.ok(p.length >= 3 && p.every(x => x.length >= 6 && x.length <= 15), p.map(x => x.length).join(','));
  assert.equal(p.flat().length, 36);
});
test('extrairJson aceita cerca de código e texto em volta', () => {
  assert.deepEqual(extrairJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extrairJson('Aqui está: {"a":2} fim'), { a: 2 });
});
test('Cloudflare sem modo JSON (400) tenta de novo sem o parâmetro e a auditoria vale', async () => {
  const r = await rodar({ groq: () => BOM, gemini: () => tudoP(), cf: n => n % 2 === 0 ? { status: 400, body: { success: false, errors: [{ message: 'response_format is not supported for this model' }] } } : tudoP() });
  assert.equal(r.code, 0, r.o);
  assert.ok(existsSync(join(r.d, 'content-src/camada2/43/43-3-1-12.json')), r.o);
});
test('limite diário do gerador principal: troca para o outro modelo e continua, com famílias diferentes', async () => {
  const diario = { status: 429, body: { error: { message: 'Rate limit reached for model openai/gpt-oss-120b on tokens per day (TPD): Limit 200000, Used 199900. Please try again in 7m12.96s.' } } };
  const r = await rodar({ groq: (n, b) => b.model.includes('gpt-oss') ? diario : BOM, gemini: () => tudoP(), cf: () => tudoP() });
  assert.equal(r.code, 0, r.o);
  const p = doc(r.d);
  assert.equal(p.audit.generator.family, 'alibaba');
  assert.deepEqual(p.audit.auditors.map(a => a.family), ['google', 'meta']);
});
test('três ensinos em paralelo: todos gravados, cada um com três famílias diferentes', async () => {
  const r = await rodar({ groq: () => BOM, gemini: () => tudoP(), cf: () => tudoP() }, 3);
  assert.equal(r.code, 0, r.o);
  assert.ok(existsSync(join(r.d, 'content-src/camada2/43/43-3-1-12.json')), r.o);
  assert.ok(r.o.includes('Resumo'), r.o);
  const feitos = ['43/43-3-1-12', '45/45-5-1-10', '49/49-2-1-10'].filter(x => existsSync(join(r.d, 'content-src/camada2', x + '.json')));
  assert.ok(feitos.length >= 1);
  for (const x of feitos) { const p = JSON.parse(readFileSync(join(r.d, 'content-src/camada2', x + '.json'), 'utf8')); assert.equal(new Set([p.audit.generator.family, ...p.audit.auditors.map(a => a.family)]).size, 3); }
});
