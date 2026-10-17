#!/usr/bin/env python3
"""Converte a Bíblia em USFM (eBible.org, porbr2018) em content-src/ do app.
Uso: python3 scripts/import-ebible.py <pasta-com-usfm> [--raiz .]
Falha (código 1) se faltar livro/capítulo; lacunas de versículo vão para docs/importacao.txt."""
import sys, re, json, shutil
from pathlib import Path

CODES = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL "
         "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()
CHAPS = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,
         28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22]
NAMES = ["Gênesis","Êxodo","Levítico","Números","Deuteronômio","Josué","Juízes","Rute","1 Samuel","2 Samuel","1 Reis","2 Reis","1 Crônicas","2 Crônicas","Esdras","Neemias","Ester","Jó","Salmos","Provérbios","Eclesiastes","Cantares","Isaías","Jeremias","Lamentações","Ezequiel","Daniel","Oseias","Joel","Amós","Obadias","Jonas","Miqueias","Naum","Habacuque","Sofonias","Ageu","Zacarias","Malaquias",
         "Mateus","Marcos","Lucas","João","Atos","Romanos","1 Coríntios","2 Coríntios","Gálatas","Efésios","Filipenses","Colossenses","1 Tessalonicenses","2 Tessalonicenses","1 Timóteo","2 Timóteo","Tito","Filemom","Hebreus","Tiago","1 Pedro","2 Pedro","1 João","2 João","3 João","Judas","Apocalipse"]
assert len(CODES) == 66 and len(CHAPS) == 66 and len(NAMES) == 66, (len(CODES), len(CHAPS), len(NAMES))

NOTE = re.compile(r'\\(f|fe|x|xt|ef|ex)\b.*?\\\1\*', re.S)
SKIP = {'id','ide','h','toc1','toc2','toc3','mt','mt1','mt2','mt3','ms','ms1','mr','s','s1','s2','s3','r','d','sp','rem','b','cl','cp','cd','sr','imt','is','ip','iot','io','ili','ie'}

def clean(t):
    t = NOTE.sub('', t)
    t = re.sub(r'\\w\s+([^|\\]*)\|[^\\]*\\w\*', r'\1', t)   # \w palavra|lemma\w*
    t = re.sub(r'\\\+?\w+\*?', '', t)          # demais marcadores de caractere (\add, \nd, \wj ...)
    return re.sub(r'\s+', ' ', t).strip()

def parse(path):
    raw = path.read_text(encoding='utf-8-sig')
    raw = NOTE.sub('', raw)
    m = re.search(r'^\\id\s+(\w{3})', raw, re.M)
    if not m: return None
    code, chapters, ch, vs = m.group(1).upper(), {}, None, None
    for line in raw.splitlines():
        mm = re.match(r'\\(\w+)\*?\s?(.*)$', line.strip())
        if not mm: 
            if vs is not None and line.strip(): vs[1].append(line.strip())
            continue
        tag, rest = mm.group(1), mm.group(2)
        if tag == 'c':
            n = re.match(r'(\d+)', rest)
            if n: ch = int(n.group(1)); chapters[ch] = []; vs = None
        elif tag == 'v' and ch is not None:
            n = re.match(r'(\d+)(?:[-–](\d+))?[a-b]?\s*(.*)$', rest)
            if n:
                vs = [int(n.group(1)), [n.group(3)], int(n.group(2)) if n.group(2) else None]
                chapters[ch].append(vs)
        elif tag in SKIP: 
            if tag in ('s','s1','s2','s3','r','d','b','ms','ms1','mr','sp'): vs = vs if tag == 'b' else vs
            continue
        elif vs is not None and rest:
            vs[1].append(rest)
    return code, chapters

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src = Path(args[0]); root = Path(sys.argv[sys.argv.index('--raiz')+1]) if '--raiz' in sys.argv else Path('.')
    found = {}
    for f in sorted(list(src.rglob('*.usfm')) + list(src.rglob('*.SFM')) + list(src.rglob('*.sfm'))):
        r = parse(f)
        if r and r[0] in CODES: found[r[0]] = r[1]
    erros, avisos = [], []
    out = root / 'content-src' / 'biblia'
    if out.exists(): shutil.rmtree(out)
    total = 0
    for i, code in enumerate(CODES):
        bid = str(i + 1)
        if code not in found: erros.append(f'livro ausente: {NAMES[i]} ({code})'); continue
        chs = found[code]
        for c in range(1, CHAPS[i] + 1):
            verses = []
            for n, parts, ate in chs.get(c, []):
                t = clean(' '.join(parts))
                if t: verses.append({'n': n, 't': t})
            if not verses: erros.append(f'capítulo vazio: {NAMES[i]} {c}'); continue
            nums = [v['n'] for v in verses]
            if nums != sorted(set(nums)): erros.append(f'versículos fora de ordem: {NAMES[i]} {c}')
            falt = [k for k in range(1, max(nums)+1) if k not in nums]
            if falt: avisos.append(f'{NAMES[i]} {c}: faltam versículos {falt}')
            d = out / bid; d.mkdir(parents=True, exist_ok=True)
            (d / f'{bid}-{c}.json').write_text(json.dumps({'book': bid, 'chapter': c, 'verses': verses}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            total += 1
        extra = [c for c in chs if c > CHAPS[i]]
        if extra: erros.append(f'capítulos a mais em {NAMES[i]}: {extra}')
    docs = root / 'docs'; docs.mkdir(exist_ok=True)
    (docs / 'importacao.txt').write_text('Capítulos gravados: %d de 1189\nERROS (%d):\n%s\nAVISOS (%d):\n%s\n' % (total, len(erros), '\n'.join(erros), len(avisos), '\n'.join(avisos)), encoding='utf-8')
    if '--producao' in sys.argv and not erros:
        for t in (root/'content-src'/'camada2'/'teste', ):
            if t.exists(): shutil.rmtree(t)
        mp = root/'content-src'/'meta.json'; meta = json.loads(mp.read_text(encoding='utf-8'))
        meta.update(contentVersion='1.0.0', production=True,
                    license={'text': 'Texto bíblico: Bíblia Livre (BLIVRE), 2018, de Diego Santos, Mario Sérgio e Marco Teles, licença Creative Commons Atribuição 4.0 (CC BY 4.0). Fonte: eBible.org. O app não altera o texto.', 'url': 'https://ebible.org/porbr2018/copyright.htm'},
                    books=[{'id': str(i+1), 'name': NAMES[i]} for i in range(66)])
        mp.write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('capítulos', total, 'erros', len(erros), 'avisos', len(avisos))
    if erros: print('\n'.join(erros[:20])); sys.exit(1)

main()
