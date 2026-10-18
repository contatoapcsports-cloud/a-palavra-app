/* Monta a fila de unidades de ensino a partir dos capítulos em content-src/biblia.
   Cada unidade é um trecho de até MAX versículos, cortado de preferência no fim de uma frase. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export function refDe(nomeLivro, cap, v1, v2) { return nomeLivro + ' ' + cap + ':' + v1 + (v2 > v1 ? '-' + v2 : ''); }
export function cortar(versos, max) {
  const n = versos.length;
  if (n <= max + 2) return [versos];
  const k = Math.ceil(n / max), partes = []; let ini = 0;
  for (let i = 1; i <= k; i++) {
    let fim = i === k ? n : Math.round(n * i / k);
    if (i < k) { // procura fim de frase perto do corte ideal
      for (let d = 0; d <= 3; d++) {
        const c = [fim + d, fim - d].find(x => x > ini + 3 && x < n - 2 && /[.!?:;”"»)]\s*$/.test(versos[x - 1].t));
        if (c) { fim = c; break; }
      }
    }
    partes.push(versos.slice(ini, fim)); ini = fim;
  }
  return partes.filter(p => p.length);
}
export function montarFila(raiz, cfg) {
  const meta = JSON.parse(readFileSync(join(raiz, 'content-src/meta.json'), 'utf8'));
  const nomes = new Map(meta.books.map(b => [b.id, b.name]));
  const ordem = (cfg.ordem_livros || []).map(String);
  const ids = [...ordem, ...meta.books.map(b => b.id).filter(i => !ordem.includes(i))];
  const fila = [];
  for (const bid of ids) {
    const dir = join(raiz, 'content-src/biblia', bid);
    if (!existsSync(dir)) continue;
    const caps = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8'))).sort((a, b) => a.chapter - b.chapter);
    for (const c of caps) {
      for (const parte of cortar(c.verses, cfg.max_versiculos || 12)) {
        const v1 = parte[0].n, v2 = parte[parte.length - 1].n;
        fila.push({ id: bid + '-' + c.chapter + '-' + v1 + '-' + v2, book: bid, bookName: nomes.get(bid), chapter: c.chapter, v1, v2, ref: refDe(nomes.get(bid), c.chapter, v1, v2), verses: parte.map(v => ({ n: v.n, t: v.t })), cap: c.verses });
      }
    }
  }
  return fila;
}
