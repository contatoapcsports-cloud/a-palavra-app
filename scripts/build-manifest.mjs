/* Lê content-src/, grava content/<nome>.<hash12>.json e escreve content-manifest.json com geração+1. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'content-src'), out = join(root, 'content');
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') && basename(p) !== 'meta.json' ? [p] : []; }).sort();
const meta = JSON.parse(readFileSync(join(src, 'meta.json'), 'utf8'));
const mpath = join(root, 'content-manifest.json');
const prev = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : null;
mkdirSync(out, { recursive: true });
const packages = [], books = new Map(meta.books.map(b => [b.id, { id: b.id, name: b.name, chapters: [] }]));
const passages = [], searchRows = [];
let searchTest = false;
const order = new Map(meta.books.map((x, i) => [x.id, i]));
for (const f of walk(src)) {
  const bytes = readFileSync(f);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const name = basename(f, '.json') + '.' + hash.slice(0, 12) + '.json';
  writeFileSync(join(out, name), bytes);
  const data = JSON.parse(bytes.toString('utf8'));
  const isChapter = f.includes(join(src, 'biblia'));
  const path = 'content/' + name;
  packages.push({ path, sha256: hash, size: bytes.length, precache: isChapter, kind: isChapter ? 'biblia' : 'camada2', ...(data._teste ? { teste: true } : {}) });
  if (isChapter) {
    books.get(data.book).chapters.push({ n: data.chapter, path });
    if (data._teste) searchTest = true;
    for (const v of data.verses) searchRows.push([data.book, data.chapter, v.n, v.t]);
  } else passages.push({ id: data.id, ref: data.ref, book: data.book, chapter: data.chapter, path, ...(data.titulo ? { titulo: data.titulo } : {}), ...(Array.isArray(data.temas) && data.temas.length ? { temas: data.temas } : {}) });
}
books.forEach(b => b.chapters.sort((a, c) => a.n - c.n));
/* índice de busca: todos os versículos num só pacote (a busca acha em toda a Bíblia sem abrir capítulo por capítulo) */
let buscaPath = null;
if (searchRows.length) {
  searchRows.sort((a, c) => ((order.has(a[0]) ? order.get(a[0]) : -1) - (order.has(c[0]) ? order.get(c[0]) : -1)) || (a[1] - c[1]) || (a[2] - c[2]));
  const bytes = Buffer.from(JSON.stringify({ v: 1, ...(searchTest ? { _teste: true } : {}), rows: searchRows }), 'utf8');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const name = 'busca.' + hash.slice(0, 12) + '.json';
  writeFileSync(join(out, name), bytes);
  buscaPath = 'content/' + name;
  packages.push({ path: buscaPath, sha256: hash, size: bytes.length, precache: true, kind: 'busca', ...(searchTest ? { teste: true } : {}) });
}
const keep = new Set(packages.map(p => basename(p.path)));
const history = [...(prev?.history || []), ...(prev ? [{ generation: prev.generation, contentVersion: prev.contentVersion, packages: prev.packages.map(p => p.path) }] : [])].slice(-3);
for (const h of history) h.packages.forEach(p => keep.add(basename(p)));
for (const f of readdirSync(out)) if (!keep.has(f)) rmSync(join(out, f));
const manifest = { generation: Math.max((prev?.generation || 0) + 1, meta.minGeneration || 1), contentVersion: meta.contentVersion, production: meta.production, license: meta.license, bible: [...books.values()], passages, ...(buscaPath ? { busca: buscaPath } : {}), packages, revoked: prev?.revoked || [], history };
writeFileSync(mpath, JSON.stringify(manifest, null, 2) + '\n');
console.log('manifesto geração', manifest.generation, '-', packages.length, 'pacotes');
