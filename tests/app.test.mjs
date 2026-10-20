import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

test('os arquivos do app compilam (erro de sintaxe derruba o app inteiro)', () => {
  const files = ['app.js', 'sw.js', ...readdirSync(join(root, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f)];
  for (const f of files) assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
});
test('o nome do app é Palavra Viva — Aprendendo as Escrituras (sem "A Palavra" como nome)', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.name, 'Palavra Viva — Aprendendo as Escrituras');
  assert.equal(m.short_name, 'Palavra Viva');
  const html = read('index.html');
  assert.ok(html.includes('<title>Palavra Viva — Aprendendo as Escrituras</title>'));
  for (const f of ['index.html', 'manifest.json', 'app.js', 'src/share.js'])
    assert.ok(!/(^|[^A-Za-zÀ-ú])A Palavra\s*[—:-]/.test(read(f)), f + ' ainda usa "A Palavra" como nome');
});
test('o compartilhamento está ligado: index.html carrega share.js antes do app.js e o app usa o cartão', () => {
  const html = read('index.html'), app = read('app.js');
  assert.ok(html.indexOf('src/share.js') > 0 && html.indexOf('src/share.js') < html.indexOf('app.js"'));
  for (const id of ['qShare', 'homeShare', 'studyShare']) assert.ok(html.includes('id="' + id + '"') && app.includes("'#" + id + "'"), id);
  assert.ok(app.includes('SH.cardBlob') && app.includes('SH.studyLink') && app.includes('SH.parseDeepLink') && app.includes('SH.chunkText'));
});
