#!/usr/bin/env python3
"""Converte uma tradução adicional em USFM (eBible.org) para content-src/versoes/<id>/.
Uso: python3 -I scripts/import-versao.py <id> <pasta-com-usfm> [--raiz .]
  <id>: sigla minúscula da versão (ex.: onbv, blt, tft). Os metadados da versão (nome, licença, cobertura)
  ficam em content-src/meta.json, campo "versions"; este script grava só os capítulos e o relatório.
Reaproveita o mesmo analisador do importador da BLIVRE (notas de rodapé, títulos e marcas USFM são removidos;
o texto dos versículos não é alterado). Falha (código 1) se faltar livro ou capítulo da cobertura declarada."""
import sys, re, json, shutil, hashlib, importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
src = (HERE / 'import-ebible.py').read_text(encoding='utf-8')
src = src.replace('\nmain()\n', '\n')  # usa só as funções/constantes, sem executar main()
ns = {'__name__': 'import_ebible_base'}
exec(compile(src, 'import-ebible.py', 'exec'), ns)
CODES, CHAPS, NAMES, parse, clean = ns['CODES'], ns['CHAPS'], ns['NAMES'], ns['parse'], ns['clean']

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2: sys.exit(__doc__)
    vid, usfm = args[0].lower(), Path(args[1])
    root = Path(sys.argv[sys.argv.index('--raiz') + 1]) if '--raiz' in sys.argv else Path('.')
    meta = json.loads((root / 'content-src' / 'meta.json').read_text(encoding='utf-8'))
    ver = next((v for v in meta.get('versions', []) if v['id'] == vid), None)
    if not ver: sys.exit('versão "%s" não declarada em content-src/meta.json (campo versions)' % vid)
    wanted = ver['livros']  # ids de livro (strings "1".."66")
    found, hashes = {}, {}
    for f in sorted(list(usfm.rglob('*.usfm')) + list(usfm.rglob('*.SFM')) + list(usfm.rglob('*.sfm'))):
        r = parse(f)
        if r and r[0] in CODES:
            found[r[0]] = r[1]; hashes[f.name] = hashlib.sha256(f.read_bytes()).hexdigest()
    erros, avisos, total = [], [], 0
    out = root / 'content-src' / 'versoes' / vid
    if out.exists(): shutil.rmtree(out)
    for bid in wanted:
        i = int(bid) - 1; code = CODES[i]
        if code not in found: erros.append(f'livro ausente: {NAMES[i]} ({code})'); continue
        chs = found[code]
        for c in range(1, CHAPS[i] + 1):
            verses, cobre = [], set()
            for n, parts, ate in chs.get(c, []):
                t = clean(' '.join(parts))
                if n == 0:  # marca "\\v 000" na origem (ex.: "5.\\v 000 homens"): erro de marcação; une ao versículo anterior
                    if verses and t:
                        verses[-1]['t'] = (verses[-1]['t'] + '000 ' + t).strip()
                        avisos.append(f'{NAMES[i]} {c}:{verses[-1]["n"]}: marca "\\v 000" na origem unida ao versículo anterior (texto: "{t[:20]}")')
                    else: erros.append(f'versículo 0 sem versículo anterior: {NAMES[i]} {c}')
                    continue
                if t:
                    v = {'n': n, 't': t}
                    if ate and ate > n: v['ate'] = ate
                    verses.append(v)
                    cobre.update(range(n, (ate or n) + 1))
                if ate: avisos.append(f'{NAMES[i]} {c}:{n}-{ate}: versículos agrupados no texto de origem (gravado como {n}-{ate})')
            if not verses: erros.append(f'capítulo vazio: {NAMES[i]} {c}'); continue
            nums = [v['n'] for v in verses]
            if nums != sorted(set(nums)): erros.append(f'versículos fora de ordem ou repetidos: {NAMES[i]} {c}')
            falt = [k for k in range(1, max(nums) + 1) if k not in cobre]
            if falt: avisos.append(f'{NAMES[i]} {c}: faltam versículos {falt}')
            d = out / bid; d.mkdir(parents=True, exist_ok=True)
            (d / f'{bid}-{c}.json').write_text(json.dumps({'version': vid, 'book': bid, 'chapter': c, 'verses': verses}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            total += 1
        extra = [c for c in chs if c > CHAPS[i]]
        if extra: erros.append(f'capítulos a mais em {NAMES[i]}: {extra}')
    esperado = sum(CHAPS[int(b) - 1] for b in wanted)
    sobra = [CODES[int(b) - 1] for b in wanted if False]
    fora = [k for k in found if CODES.index(k) + 1 not in [int(b) for b in wanted]]
    if fora: avisos.append('livros no arquivo de origem fora da cobertura declarada (ignorados): ' + ', '.join(fora))
    docs = root / 'docs'; docs.mkdir(exist_ok=True)
    reg = ['Versão: %s (%s)' % (ver['nome'], vid), 'Livros: %d · capítulos gravados: %d de %d' % (len(wanted), total, esperado),
           'SHA-256 dos arquivos USFM de origem:'] + ['  %s  %s' % (h, n) for n, h in sorted(hashes.items())] + \
          ['ERROS (%d):' % len(erros)] + erros + ['AVISOS (%d):' % len(avisos)] + avisos
    (docs / f'importacao-{vid}.txt').write_text('\n'.join(reg) + '\n', encoding='utf-8')
    print(vid, 'capítulos', total, 'de', esperado, 'erros', len(erros), 'avisos', len(avisos))
    if erros: print('\n'.join(erros[:20])); sys.exit(1)

main()
