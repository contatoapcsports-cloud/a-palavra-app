/* Traduções adicionais (ONBV, BLT, TfT): cobertura, integridade, créditos e BLIVRE preservada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const m = J('content-manifest.json'), meta = J('content-src/meta.json');
const CHAPS = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,
  28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];
const extras = (m.versions || []).filter(v => !v.padrao);
const pendente = extras.length === 0 ? 'traduções adicionais ainda não importadas (rode o fluxo importar-versoes)' : false;

test('manifesto declara BLIVRE como padrão e as quatro traduções adicionais', { skip: pendente }, () => {
  assert.equal(m.versions.filter(v => v.padrao).length, 1);
  assert.equal(m.versions.find(v => v.padrao).id, 'blivre');
  assert.deepEqual(extras.map(v => v.id).sort(), ['a1911', 'blt', 'onbv', 'tft']);
});

test('BLIVRE preservada: 66 livros e 1189 capítulos continuam no manifesto original', () => {
  assert.equal(m.bible.length, 66);
  assert.equal(m.bible.reduce((n, b) => n + b.chapters.length, 0), 1189);
  assert.ok(m.busca && m.packages.some(p => p.path === m.busca));
});

for (const v of extras) {
  test(`${v.sigla}: metadados, licença e crédito obrigatórios`, () => {
    for (const k of ['nome', 'sigla', 'edicao', 'cobertura', 'licenca', 'licencaUrl', 'fonteUrl', 'credito', 'direitos', 'alteracoes', 'obtidoEm', 'origem'])
      assert.ok(typeof v[k] === 'string' && v[k].trim().length > 0, 'falta ' + k);
    if (v.id === 'a1911') {
      assert.ok(/Domínio público nos EUA/.test(v.licenca) && /não é parecer jurídico/.test(v.credito));
      for (const n of ['Júlio Reis', 'abi278', 'Sergio Queiroz', 'Online Distributed Proofreading Team', 'João Ferreira d’Almeida']) assert.ok(v.credito.includes(n), 'crédito sem ' + n);
      assert.ok(/bf9c6053bfb441d117a2a128d4edec9fbe935f415bc8f7bf4e1f3f9121790215/.test(v.origem));
      return;
    }
    assert.equal(v.licenca, 'CC BY-SA 4.0');
    assert.ok(/Atribuição-CompartilhaIgual 4\.0/.test(v.credito) && /Copyright ©/.test(v.credito));
    assert.ok(/não foi modificado/.test(v.alteracoes) && /não foi modificado/.test(v.credito));
  });

  test(`${v.sigla}: cobertura ${v.cobertura} completa, sem lacunas e sem mistura com outras versões`, () => {
    const ids = v.cobertura === 'nt' ? Array.from({ length: 27 }, (_, i) => String(40 + i)) : Array.from({ length: 66 }, (_, i) => String(1 + i));
    assert.deepEqual(v.bible.map(b => b.id), ids);
    for (const b of v.bible) {
      assert.equal(b.chapters.length, CHAPS[Number(b.id) - 1], 'capítulos de ' + b.name);
      b.chapters.forEach((c, i) => assert.equal(c.n, i + 1));
      for (const c of b.chapters) {
        const pkg = m.packages.find(p => p.path === c.path);
        assert.ok(pkg && pkg.kind === 'biblia-v' && pkg.version === v.id && pkg.precache === false, 'pacote de ' + c.path);
        const d = J(c.path);
        assert.equal(d.version, v.id); assert.equal(d.book, b.id); assert.equal(d.chapter, c.n);
        const nums = d.verses.map(x => x.n);
        assert.deepEqual(nums, [...new Set(nums)].sort((a, c2) => a - c2), 'ordem/duplicatas em ' + c.path);
        assert.ok(d.verses.every(x => x.t && x.t.trim() === x.t && !/\\[a-z+]/i.test(x.t)), 'marca USFM sobrando em ' + c.path);
        assert.ok(d.verses.every(x => !x.ate || x.ate > x.n));
      }
    }
    if (v.cobertura === 'nt') assert.ok(v.bible.every(b => Number(b.id) >= 40));
  });

  test(`${v.sigla}: começo, meio e fim abrem e a busca tem índice próprio`, () => {
    const pick = v.cobertura === 'nt' ? [['40', 1], ['43', 3], ['66', 22]] : [['1', 1], ['19', 23], ['66', 22]];
    for (const [bid, n] of pick) {
      const c = v.bible.find(b => b.id === bid).chapters.find(x => x.n === n);
      assert.ok(J(c.path).verses.length > 0, `${bid}:${n}`);
    }
    const idx = J(v.busca);
    assert.equal(idx.version, v.id);
    const total = v.bible.reduce((s, b) => s + b.chapters.reduce((t, c) => t + J(c.path).verses.length, 0), 0);
    assert.equal(idx.rows.length, total);
    assert.ok(idx.rows.every(r => r.length === 4 && (v.cobertura !== 'nt' || Number(r[0]) >= 40)));
  });
}

test('textos conhecidos: João 3:16 existe em todas as traduções e Mateus 14:21 (TfT) foi restaurado', { skip: pendente }, () => {
  for (const v of extras) {
    const b = v.bible.find(x => x.id === '43'); if (!b) continue;
    const d = J(b.chapters.find(c => c.n === 3).path);
    assert.ok(d.verses.find(x => x.n === 16 || (x.n < 16 && x.ate >= 16)), v.sigla + ' sem João 3:16');
  }
  const tft = extras.find(v => v.id === 'tft');
  const d = J(tft.bible.find(b => b.id === '40').chapters.find(c => c.n === 14).path);
  assert.ok(/5\.000 homens/.test(d.verses.find(x => x.n === 21).t));
});

test('relatórios de importação e de origem existem para cada versão', { skip: pendente }, () => {
  for (const v of extras) {
    const f = join(root, 'docs', `importacao-${v.id}.txt`);
    assert.ok(existsSync(f), 'falta ' + f);
    const t = readFileSync(f, 'utf8');
    assert.ok(/ERROS \(0\)/.test(t) && /SHA-256/.test(t), v.id);
  }
});

test('o app lista as versões, mostra cobertura/crédito e não força rede (sem endereço externo no código)', () => {
  const app = readFileSync(join(root, 'app.js'), 'utf8'), html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(/function versionModal/.test(app) && /Somente Novo Testamento/.test(app) && /creditModal/.test(app));
  assert.ok(html.includes('id="verBar"') && html.includes('id="verCred"') && html.includes('id="verbtn"'));
  assert.ok(!/https?:\/\//.test(app));
});

test('a pasta content-src/biblia (BLIVRE) não recebeu arquivos de outras versões', () => {
  let n = 0;
  for (const d of readdirSync(join(root, 'content-src', 'biblia'))) for (const f of readdirSync(join(root, 'content-src', 'biblia', d))) { n++; assert.ok(!J(`content-src/biblia/${d}/${f}`).version); }
  assert.equal(n, 1189);
});

test('A1911: 66 livros, 1189 capítulos, 31105 versículos, sem notas/referências/marcas no texto, Salmos com título separado', { skip: pendente }, () => {
  const v = extras.find(x => x.id === 'a1911');
  let n = 0, caps = 0;
  const lixo = /\b(?:Mar|Luc|Mat|João|Act|Rom)\.?\s*\d+\.\d|&c\.|etc\.|\[[A-Z0-9]{1,3}\]|_|\*\*\*/;
  for (const b of v.bible) for (const c of b.chapters) {
    const d = J(c.path); caps++; n += d.verses.length;
    for (const x of d.verses) assert.ok(!lixo.test(x.t), `texto editorial/marca em ${b.name} ${c.n}:${x.n}`);
    if (b.id === '19') assert.ok(d.verses.length > 0);
  }
  assert.equal(v.bible.length, 66); assert.equal(caps, 1189); assert.equal(n, 31105);
  assert.ok(J(v.bible.find(b => b.id === '19').chapters.find(c => c.n === 3).path).titulo.startsWith('Psalmo de David'));
  assert.ok(/^No principio creou Deus/.test(J(v.bible[0].chapters[0].path).verses[0].t), 'grafia histórica preservada');
  assert.ok(/Porque Deus amou o mundo/.test(J(v.bible.find(b => b.id === '43').chapters.find(c => c.n === 3).path).verses.find(x => x.n === 16).t));
});
