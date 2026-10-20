import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const S = createRequire(import.meta.url)('../src/share.js');

test('o nome do app é Palavra Viva — Aprendendo as Escrituras', () => {
  assert.equal(S.NAME, 'Palavra Viva — Aprendendo as Escrituras');
  assert.ok(S.appMessage().startsWith(S.NAME));
});
test('link direto: só aceita ids simples e troca qualquer #anterior', () => {
  assert.equal(S.parseDeepLink('#estudo=43-3-1-12'), '43-3-1-12');
  for (const h of ['', '#', '#estudo=', '#estudo=a b', '#estudo=<x>', '#outro=1', '#estudo=' + 'a'.repeat(41)])
    assert.equal(S.parseDeepLink(h), null, h);
  const base = 'https://exemplo.org/app/';
  assert.equal(S.studyLink(base + '#velho', '43-3-1-12'), base + '#estudo=43-3-1-12');
  assert.equal(S.parseDeepLink('#' + S.studyLink(base, '43-3-1-12').split('#')[1]), '43-3-1-12');
});
test('baseUrl usa o siteUrl da configuração e tira #/?', () => {
  assert.equal(S.baseUrl('https://a.org/x/', 'https://b.org/y/'), 'https://a.org/x/');
  assert.equal(S.baseUrl('', 'https://b.org/y/?q=1#z'), 'https://b.org/y/');
});
test('foto do cartão: estável por ensino, sempre uma das 3 do app', () => {
  const ok = new Set(['assets/hero-dawn.jpg', 'assets/hero-reading.jpg', 'assets/hero-bible.jpg']);
  assert.equal(S.photoFor(null), 'assets/hero-dawn.jpg');
  const seen = new Set();
  for (let i = 1; i < 60; i++) { const p = S.photoFor('43-' + i + '-1-12'); assert.ok(ok.has(p)); assert.equal(p, S.photoFor('43-' + i + '-1-12')); seen.add(p); }
  assert.ok(seen.size > 1, 'varia entre ensinos');
});
const SAMPLE = 'Jesus fala à multidão. No último dia da festa, Ele convida quem tem sede (v.37-38). A reação varia: alguns o reconhecem como profeta (cf. João 4.19). O contexto mostra que a festa era a Festa dos Tabernáculos! Qual é o ponto? Beber da água viva.';
test('frases: não quebra "cf." e não perde nenhuma palavra', () => {
  const s = S.splitSentences(SAMPLE);
  assert.ok(s.length >= 5);
  assert.ok(s.some(x => x.includes('cf. João 4.19')), 'cf. fica junto de João');
  assert.equal(s.join(' '), SAMPLE);
});
test('trechos: curtos, sem perda de texto, respeitam parágrafos', () => {
  const c = S.chunkText(SAMPLE, 120);
  assert.ok(c.length > 1 && c.every(t => t.length <= 160));
  assert.equal(c.join(' '), SAMPLE);
  assert.equal(S.chunkText('A.\n\nB.').length, 2);
  assert.deepEqual(S.chunkText(''), []);
});
test('quebra de linhas do cartão', () => {
  const m = t => t.length * 10;
  const l = S.wrapLines(m, 'um dois três quatro cinco', 100);
  assert.ok(l.every(x => m(x) <= 100 || !x.includes(' ')));
  assert.equal(l.join(' '), 'um dois três quatro cinco');
  assert.deepEqual(S.wrapLines(m, '', 100), []);
});
test('mensagens de compartilhamento levam o nome e a pergunta', () => {
  const m = S.studyMessage({ titulo: 'Água viva', ref: 'João 7:33-42', pergunta: 'Onde está a água viva?' });
  assert.ok(m.includes('“Água viva”') && m.includes('João 7:33-42') && m.includes(S.NAME) && m.includes('Onde está'));
  assert.ok(S.questionMessage({ pergunta: 'Por quê?' }).includes(S.NAME));
});
