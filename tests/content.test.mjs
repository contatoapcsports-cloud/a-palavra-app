import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validate } from '../scripts/validate-content.mjs';
import { check } from '../scripts/mini-schema.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/* cada teste monta um conteúdo de teste próprio a partir de tests/fixtures; não depende do conteúdo real do repositório */
const copy = () => { const d = mkdtempSync(join(tmpdir(), 'pv-')); cpSync(join(root, 'tests/fixtures/content-src'), join(d, 'content-src'), { recursive: true }); const r = spawnSync('node', [join(root, 'scripts/build-manifest.mjs'), d], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return d; };
const mf = d => JSON.parse(readFileSync(join(d, 'content-manifest.json'), 'utf8'));
const save = (d, m) => writeFileSync(join(d, 'content-manifest.json'), JSON.stringify(m));
test('conteúdo atual é válido', () => assert.deepEqual(validate(), []));
test('arquivo adulterado é detectado', () => {
  const d = copy(); const p = mf(d).packages[0].path;
  writeFileSync(join(d, p), readFileSync(join(d, p), 'utf8') + ' ');
  assert.ok(validate(d).some(e => e.includes('hash diferente')));
});
test('produção com conteúdo de teste é recusada', () => {
  const d = copy(); const m = mf(d); m.production = true; save(d, m);
  assert.ok(validate(d).some(e => e.includes('produção com conteúdo de teste')));
});
test('marca de teste retirada do manifesto é detectada', () => {
  const d = copy(); const m = mf(d); delete m.packages[0].teste; save(d, m);
  assert.ok(validate(d).some(e => e.includes('marca de teste')));
});
test('passagem real exige auditoria com famílias diferentes e 36 critérios', () => {
  const d = copy(); const m = mf(d);
  const e = m.packages.find(p => p.kind === 'camada2');
  const gates = Object.fromEntries(Array.from({ length: 36 }, (_, i) => ['c' + (i + 1), 'P']));
  const doc = JSON.parse(readFileSync(join(d, e.path), 'utf8')); delete doc._teste;
  const write = x => { const b = Buffer.from(JSON.stringify(x)); const h = createHash('sha256').update(b).digest('hex'); const np = 'content/real.' + h.slice(0, 12) + '.json'; writeFileSync(join(d, np), b); e.path = np; e.sha256 = h; e.size = b.length; delete e.teste; m.passages[0].path = np; save(d, m); };
  write(doc);
  assert.ok(validate(d).some(x => x.includes('sem auditoria')));
  doc.audit = { generator: { model: 'q', family: 'qwen' }, auditors: [{ model: 'g', family: 'gemma' }, { model: 'g2', family: 'gemma' }], gates, humanReviewed: false, contractVersion: '1' };
  write(doc);
  assert.ok(validate(d).some(x => x.includes('famílias diferentes')));
  doc.audit.auditors[1].family = 'llama'; doc.audit.gates.c7 = 'F';
  write(doc);
  assert.ok(validate(d).some(x => x.includes('36 critérios')));
  doc.audit.gates.c7 = 'P';
  write(doc);
  assert.deepEqual(validate(d).filter(x => !x.includes('marca')), []);
});
test('mini-schema recusa tipos errados', () => {
  assert.ok(check({ type: 'object', required: ['a'] }, {}).length);
  assert.ok(check({ type: 'integer' }, 'x').length);
});
