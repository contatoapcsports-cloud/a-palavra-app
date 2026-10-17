import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CODES = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
const CH = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];
function fixture(skip) {
  const d = mkdtempSync(join(tmpdir(), 'usfm-'));
  CODES.forEach((c, i) => {
    if (c === skip) return;
    let u = `\\id ${c} teste\n\\h Livro\n\\mt1 Título\n`;
    for (let ch = 1; ch <= CH[i]; ch++) {
      u += `\\c ${ch}\n\\s1 Cabeçalho\n\\p\n\\v 1 Texto ${c} ${ch}:1 com \\w palavra|strong="G1"\\w* e nota\\f + \\fr 1:1 \\ft rodapé\\f* fim.\n\\q1\n\\v 2 Linha um\n\\q2 linha dois\\add inserida\\add*.\n`;
    }
    writeFileSync(join(d, `${String(i + 1).padStart(2, '0')}-${c}.usfm`), u);
  });
  return d;
}
test('importa 66 livros e 1189 capítulos limpando notas e marcadores', () => {
  const d = fixture(), out = mkdtempSync(join(tmpdir(), 'raiz-'));
  const r = spawnSync('python3', ['-I', join(root, 'scripts/import-ebible.py'), d, '--raiz', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = JSON.parse(readFileSync(join(out, 'content-src/biblia/43/43-3.json'), 'utf8'));
  assert.equal(j.book, '43'); assert.equal(j.chapter, 3);
  assert.equal(j.verses[0].t, 'Texto JHN 3:1 com palavra e nota fim.');
  assert.equal(j.verses[1].t, 'Linha um linha dois inserida.');
  assert.ok(existsSync(join(out, 'content-src/biblia/19/19-150.json')));
  assert.match(readFileSync(join(out, 'docs/importacao.txt'), 'utf8'), /1189 de 1189/);
});
test('livro ausente faz a importação falhar', () => {
  const d = fixture('MRK'), out = mkdtempSync(join(tmpdir(), 'raiz-'));
  const r = spawnSync('python3', ['-I', join(root, 'scripts/import-ebible.py'), d, '--raiz', out], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stdout, /livro ausente: Marcos/);
});
