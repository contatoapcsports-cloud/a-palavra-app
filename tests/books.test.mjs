import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const B = createRequire(import.meta.url)('../src/books.js');
test('cânon: 66 livros, 39 do AT e 27 do NT, 1189 capítulos', () => {
  const l = B.all();
  assert.equal(l.length, 66);
  assert.equal(l.filter(b => b.testament === 'at').length, 39);
  assert.equal(l.filter(b => b.testament === 'nt').length, 27);
  assert.equal(l.reduce((a, b) => a + b.chapters, 0), 1189);
});
test('ids numéricos únicos e livros conhecidos nos lugares certos', () => {
  const l = B.all();
  assert.equal(new Set(l.map(b => b.id)).size, 66);
  assert.equal(B.byId('1').name, 'Gênesis');
  assert.equal(B.byId('19').chapters, 150);
  assert.equal(B.byId('43').name, 'João');
  assert.equal(B.byId('66').name, 'Apocalipse');
  assert.equal(B.byId('999'), null);
});
