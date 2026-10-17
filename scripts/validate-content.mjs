/* Valida content-manifest.json e content/ . Sai com código 1 se algo estiver errado. */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './mini-schema.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
export function validate(rootDir = root) {
  const R = p => JSON.parse(readFileSync(join(rootDir, p), 'utf8'));
  const errs = [];
  const m = R('content-manifest.json');
  errs.push(...check(J('schemas/manifest.schema.json'), m, 'manifesto'));
  if (errs.length) return errs;
  const seen = new Set();
  for (const p of m.packages) {
    if (seen.has(p.path)) errs.push('caminho duplicado: ' + p.path); seen.add(p.path);
    const f = join(rootDir, p.path);
    if (!existsSync(f)) { errs.push('arquivo ausente: ' + p.path); continue; }
    const bytes = readFileSync(f);
    const h = createHash('sha256').update(bytes).digest('hex');
    if (h !== p.sha256) errs.push('hash diferente do manifesto: ' + p.path);
    if (!basename(p.path).includes('.' + h.slice(0, 12) + '.')) errs.push('hash no nome não confere: ' + p.path);
    if (bytes.length !== p.size) errs.push('tamanho diferente: ' + p.path);
    let d; try { d = JSON.parse(bytes.toString('utf8')); } catch { errs.push('JSON inválido: ' + p.path); continue; }
    const isTest = d._teste === true;
    if (isTest !== (p.teste === true)) errs.push('marca de teste incoerente: ' + p.path);
    if (isTest && m.production) errs.push('produção com conteúdo de teste: ' + p.path);
    if (p.kind === 'biblia') errs.push(...check(J('schemas/chapter.schema.json'), d, p.path));
    else {
      errs.push(...check(J('schemas/passage.schema.json'), d, p.path));
      if (!isTest) {
        const a = d.audit;
        if (!a) errs.push('passagem real sem auditoria: ' + p.path);
        else {
          const fams = a.auditors.map(x => x.family);
          if (new Set(fams).size < 2 || fams.includes(a.generator.family)) errs.push('auditores sem famílias diferentes entre si e do gerador: ' + p.path);
          const gates = Object.values(a.gates || {});
          if (gates.length !== 36 || gates.some(g => g !== 'P')) errs.push('os 36 critérios precisam estar todos P: ' + p.path);
        }
      }
    }
  }
  for (const b of m.bible) for (const c of b.chapters) if (!seen.has(c.path)) errs.push('capítulo sem pacote: ' + c.path);
  const ids = new Set();
  for (const ps of m.passages || []) { if (ids.has(ps.id)) errs.push('id repetido: ' + ps.id); ids.add(ps.id); if (!seen.has(ps.path)) errs.push('passagem sem pacote: ' + ps.id); }
  return errs;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const e = validate();
  if (e.length) { console.error(e.join('\n')); process.exit(1); }
  console.log('conteúdo válido');
}
