import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const core = createRequire(import.meta.url)('../src/core.js');
const rows = [
  ['1', 1, 1, 'Sara foi morar num mesmo lugar e não podiam morar juntos.'],
  ['1', 2, 1, 'Ele é profeta, e orará por ti, e viverás.'],
  ['1', 3, 1, 'E o jovem iremos até ali, e adoraremos, e voltaremos a vós.'],
  ['1', 4, 1, 'Para ficar de luto por Sara e para chorar por ela.'],
  ['1', 5, 1, 'Então Jesus disse: É preciso orar sempre, e nunca desanimar.'],
  ['1', 6, 1, 'Eu oro por eles; os que oraram ontem, e orando agora.'],
  ['1', 7, 1, 'O homem pecou no seu coração, e a oração foi ouvida.'],
  ['1', 8, 1, 'Ouça a minha oração, Senhor; as orações do povo subiram.'],
  ['1', 9, 1, 'A graça de Deus e o perdão dos pecados por Jesus Cristo.'],
  ['1', 10, 1, 'Jesus Cristo é o Senhor; o Cristo, o Filho de Deus.']
];
const idx = core.searchPrepare(rows);
const ids = q => core.searchRun(idx, q).hits.map(h => rows[h.i][1]);

test('"orar" não acha morar, chorar, adorar nem orará de outra raiz', () => {
  const r = ids('Orar');
  assert.ok(r.includes(5) && r.includes(6) && r.includes(2));
  assert.ok(!r.includes(1) && !r.includes(3) && !r.includes(4));
});
test('"oração" acha oração e orações primeiro, depois formas de orar; nunca coração', () => {
  const r = ids('Oração');
  assert.deepEqual(r.slice(0, 2).sort((a, b) => a - b), [7, 8]);
  assert.ok(r.includes(5) && r.includes(6) && r.includes(2) && r.length === 5);
  assert.ok(!r.includes(1) && !r.includes(3) && !r.includes(4));
});
test('"perdão" também acha perdoou, mas depois da palavra exata', () => {
  const rr = [['1', 1, 1, 'Ele perdoou os seus pecados.'], ['1', 1, 2, 'Há perdão em ti.']];
  const x = core.searchPrepare(rr); const r = core.searchRun(x, 'perdão').hits.map(h => h.i);
  assert.deepEqual(r, [1, 0]);
});
test('acento e caixa não atrapalham', () => { assert.deepEqual(ids('ORACAO').slice(0, 2).sort((a, b) => a - b), [7, 8]); });
test('várias palavras: todas precisam aparecer; ordem exata vem primeiro', () => {
  assert.deepEqual(ids('Jesus Cristo').slice(0, 2).sort((a, b) => a - b), [9, 10]);
  assert.deepEqual(ids('graça perdão'), [9]);
  assert.deepEqual(ids('graça orar'), []);
});
test('palavras de ligação são ignoradas ("o perdão")', () => { assert.deepEqual(ids('o perdão'), [9]); });
test('frase entre aspas exige as palavras juntas', () => {
  assert.deepEqual(ids('"Jesus Cristo"').sort((a, b) => a - b), [9, 10]);
  assert.deepEqual(ids('"Cristo Jesus"'), []);
});
test('destaque marca só a palavra inteira no texto original', () => {
  const t = rows[0][3], r = core.highlightRanges(t, 'morar');
  assert.equal(r.length, 2); assert.equal(t.slice(r[0].start, r[0].end), 'morar');
  const t2 = rows[6][3], r2 = core.highlightRanges(t2, 'oração');
  assert.equal(r2.length, 1); assert.equal(t2.slice(r2[0].start, r2[0].end), 'oração');
});
test('busca vazia ou só espaços não devolve nada', () => { assert.deepEqual(ids('   '), []); });
