import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PD = require('../src/palavra-dia.js');

test('há entradas completas e sem texto vazio', () => {
  assert.ok(PD.dados.length >= 14);
  for (const e of PD.dados) for (const k of ['ref', 'texto', 'reflexao', 'oracao']) assert.ok(e[k] && e[k].trim().length > (k === 'ref' ? 5 : 10), e.ref + ' ' + k);
});
test('o versículo é idêntico ao texto da BLIVRE no repositório', () => {
  for (const e of PD.dados) {
    const c = JSON.parse(fs.readFileSync(`content-src/biblia/${e.b}/${e.b}-${e.c}.json`, 'utf8'));
    const t = c.verses.filter(v => v.n >= e.v && v.n <= e.ate).map(v => v.t).join(' ');
    assert.equal(e.texto, t, e.ref);
  }
});
test('a escolha do dia é estável no dia, muda no dia seguinte e cobre todos os itens', () => {
  const n = PD.dados.length, d0 = new Date(2026, 9, 23, 0, 5), d1 = new Date(2026, 9, 23, 23, 55), d2 = new Date(2026, 9, 24, 8, 0);
  assert.equal(PD.indiceDoDia(d0, n), PD.indiceDoDia(d1, n));
  assert.equal(PD.indiceDoDia(d2, n), (PD.indiceDoDia(d0, n) + 1) % n);
  const vistos = new Set(); for (let i = 0; i < n; i++) vistos.add(PD.indiceDoDia(new Date(2026, 0, 1 + i), n));
  assert.equal(vistos.size, n);
});
test('o roteiro de narração segue a ordem da tela e termina em Amém', () => {
  const e = PD.dados[0], r = PD.roteiro(e);
  assert.ok(r.startsWith('Palavra do dia. ' + e.ref));
  assert.ok(r.indexOf(e.texto) < r.indexOf(e.reflexao) && r.indexOf(e.reflexao) < r.indexOf(e.oracao));
  assert.ok(r.endsWith('Amém.'));
});
test('o texto de compartilhamento traz versículo, referência, tradução, reflexão, oração e a identificação do app', () => {
  const e = PD.dados[1], t = PD.textoParaCompartilhar(e, 'https://exemplo.test/app/');
  for (const parte of [e.texto, e.ref, 'BLIVRE', e.reflexao, e.oracao, 'Palavra Viva', 'https://exemplo.test/app/']) assert.ok(t.includes(parte), parte);
});
