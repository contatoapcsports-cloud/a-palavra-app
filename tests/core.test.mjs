import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const core = createRequire(import.meta.url)('../src/core.js');
const enc = s => new TextEncoder().encode(s);
test('hash incorreto é rejeitado', async () => {
  const good = await core.sha256Hex(enc('abc'));
  assert.equal((await core.verifyPackage(enc('abc'), { sha256: good, size: 3 })).ok, true);
  assert.equal((await core.verifyPackage(enc('abd'), { sha256: good, size: 3 })).reason, 'hash_diferente');
  assert.equal((await core.verifyPackage(enc('abc'), { sha256: good, size: 9 })).reason, 'tamanho_diferente');
  assert.equal((await core.verifyPackage(enc('abc'), null)).ok, false);
});
test('só geração maior é aceita', () => {
  const cur = { generation: 5, packages: [] };
  assert.equal(core.planUpdate(cur, { generation: 6, packages: [] }, []).accept, true);
  assert.equal(core.planUpdate(cur, { generation: 5, packages: [] }, []).accept, false);
  assert.equal(core.planUpdate(cur, { generation: 4, packages: [] }, []).reason, 'geracao_menor');
  assert.equal(core.planUpdate(cur, { generation: 'x', packages: [] }, []).accept, false);
});
test('removidos e revogados saem do cache', () => {
  const cur = { generation: 1, packages: [{ path: 'a', sha256: 'h1' }, { path: 'b', sha256: 'h2' }, { path: 'c', sha256: 'h3' }] };
  const inc = { generation: 2, packages: [{ path: 'a', sha256: 'h1' }, { path: 'b', sha256: 'h2' }], revoked: ['h2'] };
  const p = core.planUpdate(cur, inc, ['a', 'b', 'c']);
  assert.deepEqual(p.remove.sort(), ['b', 'c']);
});
test('limpeza só toca o prefixo pv4-', () => {
  assert.deepEqual(core.cleanupPlan(['pv4-x', 'pv4-keep', 'outro-app', 'workbox-1'], ['pv4-keep']), ['pv4-x']);
});
test('sem aba vazia e sem "em breve"', () => {
  assert.deepEqual(core.visibleTabs(null), []);
  assert.deepEqual(core.visibleTabs({ verses: [{ n: 1, t: 'x' }], entender: '  ', ligar: { texto: '' }, refs: [] }), ['ler']);
  const all = core.visibleTabs({ verses: [1], entender: 'a', ligar: { texto: 'b' }, refs: ['c'] });
  assert.deepEqual(all, ['ler', 'entender', 'ligar', 'aprofundar']);
  assert.ok(!JSON.stringify(all).toLowerCase().includes('breve'));
});
test('busca ignora acento e caixa, e devolve a posição no texto original', () => {
  assert.deepEqual(core.findMatch('Ação de graças', 'ACAO'), { start: 0, end: 4 });
  assert.deepEqual(core.findMatch('Porque Deus amou o mundo', 'amou'), { start: 12, end: 16 });
  assert.equal(core.findMatch('texto', 'zzz'), null);
  assert.equal(core.findMatch('texto', '   '), null);
});
test('referências são lidas com nome, capítulo e versículo', () => {
  assert.deepEqual(core.parseRef('1 João 3:16'), { name: '1 João', chapter: 3, verse: 16 });
  assert.deepEqual(core.parseRef('Livro de Teste 2:1-2'), { name: 'Livro de Teste', chapter: 2, verse: 1 });
  assert.deepEqual(core.parseRef('João 3'), { name: 'João', chapter: 3, verse: null });
  assert.equal(core.parseRef('sem número'), null);
});
test('selo: "Revisado por pessoa" só com humanReviewed true; teste nunca parece ensino real', () => {
  const base = 'Ensino do app, não é a Bíblia. Gerado por IA e conferido por outras IAs.';
  assert.equal(core.stampText({ audit: { humanReviewed: false } }), base);
  assert.equal(core.stampText({ audit: { humanReviewed: true } }), base + ' Revisado por pessoa.');
  assert.equal(core.stampText({}), base);
  assert.ok(core.stampText({ _teste: true }).includes('fictício'));
  assert.ok(!core.stampText({ _teste: true }).includes('Revisado'));
});
test('baixar tudo calcula só o que falta', () => {
  const m = { packages: [{ path: 'a' }, { path: 'b' }, { path: 'c' }] };
  assert.deepEqual(core.missingPackages(m, ['b']).map(p => p.path), ['a', 'c']);
  assert.deepEqual(core.missingPackages(m, ['a', 'b', 'c']), []);
});
