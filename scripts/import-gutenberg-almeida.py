#!/usr/bin/env python3
"""Converte a Almeida Revista e Corrigida (reimpressão de 1911), Project Gutenberg eBook 62383 (texto UTF-8),
em content-src/versoes/a1911/<livro>/<livro>-<cap>.json (mesmo formato das demais versões).
Uso: python3 -I scripts/import-gutenberg-almeida.py <pg62383.txt> [--raiz .] [--ref content-src/biblia]
Regras (só técnicas; a ortografia histórica é preservada):
 - o miolo é o texto entre as marcas START/END do Gutenberg; avisos de licença do Gutenberg ficam de fora;
 - títulos de livro, subtítulos em itálico (_..._), datas "[Antes de Christo ...]" e blocos de notas
   (referências cruzadas "[1] Pro. 8.23." e alternativas "[A] ...") são separados do texto bíblico e NÃO entram no app;
 - marcas de nota dentro do versículo ([1], [A]) são removidas; sublinhados de itálico (_palavra_) são removidos
   (em edições históricas, itálico = palavra suprida); o texto das palavras permanece;
 - na fonte, o 1º versículo de cada capítulo traz o número do capítulo; o conversor reconstrói capítulo/versículo.
Registra tudo em docs/importacao-a1911.txt (hash da fonte, contagens, anomalias e comparação com a BLIVRE)."""
import sys, re, json, shutil, hashlib
from pathlib import Path

NOMES = ["Gênesis","Êxodo","Levítico","Números","Deuteronômio","Josué","Juízes","Rute","1 Samuel","2 Samuel","1 Reis","2 Reis","1 Crônicas","2 Crônicas","Esdras","Neemias","Ester","Jó","Salmos","Provérbios","Eclesiastes","Cantares","Isaías","Jeremias","Lamentações","Ezequiel","Daniel","Oseias","Joel","Amós","Obadias","Jonas","Miqueias","Naum","Habacuque","Sofonias","Ageu","Zacarias","Malaquias",
         "Mateus","Marcos","Lucas","João","Atos","Romanos","1 Coríntios","2 Coríntios","Gálatas","Efésios","Filipenses","Colossenses","1 Tessalonicenses","2 Tessalonicenses","1 Timóteo","2 Timóteo","Tito","Filemom","Hebreus","Tiago","1 Pedro","2 Pedro","1 João","2 João","3 João","Judas","Apocalipse"]
CHAPS = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,
         28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22]
# linha de título de cada livro, como impressa na fonte (ordem do cânon)
TITULOS = [r"O PRIMEIRO LIVRO DE MOYSÉS CHAMADO GENESIS\.", r"O SEGUNDO LIVRO DE MOYSÉS CHAMADO EXODO\.", r"O TERCEIRO LIVRO DE MOYSÉS CHAMADO LEVITICO\.",
 r"O QUARTO LIVRO DE MOYSÉS CHAMADO NUMEROS\.", r"O QUINTO LIVRO DE MOYSÉS CHAMADO DEUTERONOMIO\.", r"O LIVRO DE JOSUÉ\.", r"O LIVRO DOS JUIZES\.", r"O LIVRO DE RUTH\.",
 r"O PRIMEIRO LIVRO DE SAMUEL\.", r"O SEGUNDO LIVRO DE SAMUEL\.", r"O PRIMEIRO LIVRO DOS REIS\.", r"O SEGUNDO LIVRO DOS REIS\.", r"O PRIMEIRO LIVRO DAS CHRONICAS\.",
 r"O SEGUNDO LIVRO DAS CHRONICAS\.", r"O LIVRO DE ESDRAS\.", r"O LIVRO DE NEHEMIAS\.", r"O LIVRO DE ESTHER\.", r"(\[MT\] )?O LIVRO DE JOB\.", r"O LIVRO DOS PSALMOS\.",
 r"PROVERBIOS DE SALOMÃO\.", r"LIVRO DO ECCLESIASTES, OU PRÉGADOR\.", r"CANTARES DE SALOMÃO\.", r"ISAIAS\.", r"JEREMIAS\.", r"LAMENTAÇÕES DE JEREMIAS\.", r"EZEQUIEL\.",
 r"DANIEL\.", r"OSEAS\.", r"JOEL\.", r"AMÓS\.", r"OBADIAS\.", r"JONAS\.", r"MIQUEAS\.", r"NAHUM\.", r"HABACUC\.", r"SOFONIAS\.", r"AGGEO\.", r"ZACHARIAS\.", r"MALACHIAS\.",
 r"O SANCTO EVANGELHO SEGUNDO S\. MATTHEUS\.", r"O SANCTO EVANGELHO SEGUNDO S\. MARCOS\.", r"O SANCTO EVANGELHO SEGUNDO S\. LUCAS\.", r"O SANCTO EVANGELHO SEGUNDO S\. JOÃO\.",
 r"ACTOS DOS APOSTOLOS\.", r"EPISTOLA DE S\. PAULO AOS ROMANOS\.", r"PRIMEIRA EPISTOLA DE S\. PAULO APOSTOLO AOS CORINTHIOS\.", r"SEGUNDA EPISTOLA DE S\. PAULO APOSTOLO AOS CORINTHIOS\.",
 r"EPISTOLA DE S\. PAULO APOSTOLO AOS GALATAS\.", r"EPISTOLA DE S\. PAULO APOSTOLO AOS EPHESIOS\.", r"EPISTOLA DE S\. PAULO APOSTOLO AOS PHILIPPENSES\.", r"EPISTOLA DE S\. PAULO APOSTOLO AOS COLOSSENSES\.",
 r"PRIMEIRA EPISTOLA DE S\. PAULO APOSTOLO AOS THESSALONICENSES\.", r"SEGUNDA EPISTOLA DE S\. PAULO APOSTOLO AOS THESSALONICENSES\.", r"PRIMEIRA EPISTOLA DE S\. PAULO APOSTOLO A TIMOTHEO\.",
 r"SEGUNDA EPISTOLA DE S\. PAULO APOSTOLO A TIMOTHEO\.", r"EPISTOLA DE S\. PAULO APOSTOLO A TITO\.", r"EPISTOLA DE S\. PAULO APOSTOLO A PHILEMON\.", r"EPISTOLA DE S\. PAULO APOSTOLO AOS HEBREOS\.",
 r"EPISTOLA UNIVERSAL DO APOSTOLO S\. THIAGO\.", r"PRIMEIRA EPISTOLA UNIVERSAL DO APOSTOLO S\. PEDRO\.", r"SEGUNDA EPISTOLA UNIVERSAL DO APOSTOLO S\. PEDRO\.", r"PRIMEIRA EPISTOLA UNIVERSAL DO APOSTOLO S\. JOÃO\.",
 r"SEGUNDA EPISTOLA DO APOSTOLO S\. JOÃO\.", r"TERCEIRA EPISTOLA DO APOSTOLO S\. JOÃO\.", r"EPISTOLA UNIVERSAL DO APOSTOLO S\. JUDAS\.", r"APOCALYPSE DO APOSTOLO S\. JOÃO\."]
assert len(NOMES) == len(CHAPS) == len(TITULOS) == 66

MARCA = re.compile(r'\s?\[(?:\d{1,3}|[A-Z]{1,3})\]')            # [1] [A] [AA] dentro do versículo
NOTA_BLOCO = re.compile(r'^\[(?:\d{1,3}|[A-Z]{1,3})\]')           # parágrafo de nota: começa por [n] ou [A]
REF1 = r'(?:(?:[IV]{1,3} )?[A-ZÀ-Ú][a-zçãõ]{1,5}\.?\s+(?:caps?\.\s*)?\d[\d.,;:\s–-]*(?:etc\.?|&c\.)?\s*(?:e refs\.)?\s*)'
_ABREV = re.compile(r'(?:[IV]{1,3} )?[A-ZÀ-Ú][a-zçãõ]{1,5}(?:\.|(?=\s+\d))')
_RESTO = re.compile(r'^[\d.,;:\s–&-]*(?:etc\.|e refs\.|caps?\.|c\.|\be\b|[\d.,;:\s–&-])*$')
class _RefPar:
    def match(self, t):
        t = t.strip()
        if re.match(r'^\[\d+ Annos[^\]]*\]$', t): return True
        if not _ABREV.match(t): return False
        return bool(_RESTO.match(_ABREV.sub('', t)))
REF_PARALELA = _RefPar()   # "Mat. 8.23-27, etc."  "Mar. 1.1-8. Luc. 3.1-18."  "[6 Annos antes do Anno Domini]"
DATA = re.compile(r'^\[(?:Antes|Depois|Annos?)[^\]]*\]\s*$')       # [Antes de Christo 4004]
ITALICO_LINHA = re.compile(r'^_.+_\.?$', re.S)                          # subtítulo de seção
ROTULO = re.compile(r'^[A-Z]{2,8}\.\s+(?:\[(?:\d{1,3}|[A-Z]{1,3})\]\s+)?(?=\d{1,3}\s)')
INLINE = r'(?<=[.:;?!”’)_,])\s+({n})\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ_\[“‘(])'

NOTAS_EXCLUIDAS = {}   # material editorial recortado do fim de um livro (não entra no app)

def ler(path):
    raw = Path(path).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    txt = raw.decode('utf-8-sig').replace('\r\n', '\n').replace('\r', '\n')
    a = txt.index('*** START OF'); a = txt.index('\n', a) + 1
    b = txt.index('*** END OF')
    return sha, txt[a:b]

def blocos_do_livro(txt):
    """quebra o miolo em livros: devolve [(indice_livro, texto_do_livro)]"""
    linhas = txt.split('\n'); pos, ini = 0, []
    for i, pat in enumerate(TITULOS):
        r = re.compile(r'^\s*' + pat + r'\s*$')
        achou = None
        for j in range(pos, len(linhas)):
            if r.match(linhas[j]): achou = j; break
        if achou is None: raise SystemExit('título não encontrado: ' + NOMES[i])
        ini.append(achou); pos = achou + 1
    fim = len(linhas)
    saida = []
    for i in range(66):
        bloco = linhas[ini[i] + 1:(ini[i + 1] if i < 65 else fim)]
        corte = {38: r'^FIM DO VELHO TESTAMENTO', 65: r'^NOTAS\s*$'}.get(i)   # 38 = Malaquias, 65 = Apocalipse
        if corte:
            k = next((j for j, l in enumerate(bloco) if re.match(corte, l.strip())), None)
            if k is None: raise SystemExit('marca de fim não encontrada em ' + NOMES[i])
            NOTAS_EXCLUIDAS[i] = [l for l in bloco[k:] if l.strip()]
            bloco = bloco[:k]
        saida.append((i, '\n'.join(bloco)))
    return saida

def paragrafos(texto):
    return [p.strip('\n') for p in re.split(r'\n\s*\n', texto) if p.strip()]

def limpar(t):
    t = MARCA.sub('', t)
    t = re.sub(r'(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])', '', t)  # sublinhado de itálico
    t = t.replace('_', '')
    return re.sub(r'\s+', ' ', t).strip()

ESTAT = {'editorial_pulado': 0}

def extrair_livro(i, texto, avisos):
    """devolve {cap: [(v, texto)]} reconstruindo capítulos a partir do número impresso"""
    itens, titulos, pend, ref_pular = [], {}, None, 0   # itens: (numero, texto, titulo_pendente_do_capitulo)
    for p in paragrafos(texto):
        s = p.strip()
        if NOTA_BLOCO.match(s) or DATA.match(s) or s.startswith('FIM DO'): continue
        if ITALICO_LINHA.match(s.replace('\n', ' ')) or REF_PARALELA.match(s.replace('\n', ' ')): ref_pular += 1; continue
        s = ROTULO.sub('', s)   # "ALEPH. 1 Como..." / "GIMEL. [3] 3 Judah..." (rótulos do acróstico hebraico, não fazem parte do versículo)
        m = re.match(r'^(\d{1,3})\s+(.*)$', s, re.S)
        if m: itens.append((int(m.group(1)), m.group(2), pend)); pend = None
        elif i == 18: pend = (pend + ' ' if pend else '') + limpar(s)       # Salmos: título sem número, pertence ao salmo seguinte
        elif itens: itens[-1] = (itens[-1][0], itens[-1][1] + ' ' + s, itens[-1][2]); avisos.append(f'{NOMES[i]}: parágrafo sem número unido ao versículo anterior: "{s[:50]}"')
        else: avisos.append(f'{NOMES[i]}: parágrafo antes do 1º versículo ignorado: "{s[:40]}"')
    ESTAT['editorial_pulado'] += ref_pular
    caps, cap, v, k = {}, 0, 0, 0
    while k < len(itens):
        n, t, tit = itens[k]
        if i == 40 and cap == 4 and n == 31 and v == 33 and t.startswith('E sem parabolas'):   # erro tipográfico da fonte: 3.º número impresso "31" onde a sequência pede 34
            n = 34; avisos.append('CORREÇÃO DE NUMERAÇÃO: Marcos 4:34 está impresso como "31" na fonte (sequência 33, 31, 35); numerado 34.')
        if cap == 0:
            if n != 1: avisos.append(f'{NOMES[i]}: 1º versículo impresso é {n}, não 1');
            cap = 1; v = 1; caps[1] = [(1, t)]
            if tit: titulos[1] = tit
        else:
            prox = itens[k + 1][0] if k + 1 < len(itens) else None
            novo_cap = False
            if n == cap + 1 and n != v + 1: novo_cap = True
            elif n == cap + 1 and n == v + 1: novo_cap = (prox == 2)   # ambíguo: se a linha seguinte é "2", é o 1º versículo de um novo capítulo
            if novo_cap:
                cap += 1; v = 1; caps[cap] = [(1, t)]
                if tit: titulos[cap] = tit
            elif n == v + 1: v = n; caps[cap].append((v, t))
            else:
                avisos.append(f'{NOMES[i]} {cap}:{v}: número impresso {n} fora de sequência (tratado como versículo {n})')
                v = n; caps[cap].append((v, t))
        k += 1
    # versículos impressos no meio de um parágrafo ("... mantimento. 5 Não voltará..."): só se o número for exatamente o próximo versículo
    for c in caps:
        vs, novo = caps[c], []
        for n, t in vs:
            novo.append((n, t)); cur = n
            while True:
                m = re.search(INLINE.format(n=cur + 1), novo[-1][1])
                if not m: break
                antes, depois = novo[-1][1][:m.start()], novo[-1][1][m.end():]
                novo[-1] = (novo[-1][0], antes); cur += 1; novo.append((cur, depois))
                avisos.append(f'{NOMES[i]} {c}:{cur}: versículo impresso no meio do parágrafo, separado do anterior')
        caps[c] = novo
    extrair_livro.titulos = titulos
    return caps

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    root = Path(sys.argv[sys.argv.index('--raiz') + 1]) if '--raiz' in sys.argv else Path('.')
    ref = Path(sys.argv[sys.argv.index('--ref') + 1]) if '--ref' in sys.argv else root / 'content-src' / 'biblia'
    sha, miolo = ler(args[0])
    avisos, erros, total_v, total_c, ntit = [], [], 0, 0, 0
    out = root / 'content-src' / 'versoes' / 'a1911'
    if out.exists(): shutil.rmtree(out)
    comp = []
    for i, texto in blocos_do_livro(miolo):
        bid = str(i + 1)
        caps = extrair_livro(i, texto, avisos); tits = extrair_livro.titulos
        ntit += len(tits)
        if sorted(caps) != list(range(1, CHAPS[i] + 1)): erros.append(f'{NOMES[i]}: capítulos encontrados {len(caps)} ≠ esperados {CHAPS[i]}')
        for c, vs in sorted(caps.items()):
            verses, vistos = [], set()
            for n, t in vs:
                tt = limpar(t)
                if re.search(r'\[[A-Z0-9]{1,3}\]|_|\\\\|<|>|\*\*\*', tt): erros.append(f'{NOMES[i]} {c}:{n}: marca editorial/Gutenberg restante no texto: "{tt[:60]}"')
                if not tt: erros.append(f'{NOMES[i]} {c}:{n}: versículo vazio'); continue
                if n in vistos: erros.append(f'{NOMES[i]} {c}:{n}: versículo repetido'); continue
                vistos.add(n); verses.append({'n': n, 't': tt})
            nums = [x['n'] for x in verses]
            if nums != sorted(nums): erros.append(f'{NOMES[i]} {c}: versículos fora de ordem')
            falt = [k for k in range(1, max(nums) + 1) if k not in vistos]
            if falt: avisos.append(f'{NOMES[i]} {c}: faltam versículos {falt}')
            d = out / bid; d.mkdir(parents=True, exist_ok=True)
            dados = {'version': 'a1911', 'book': bid, 'chapter': c, 'verses': verses}
            if c in tits: dados['titulo'] = tits[c]   # título do salmo (sem número na edição): guardado à parte, não é versículo
            (d / f'{bid}-{c}.json').write_text(json.dumps(dados, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            total_c += 1; total_v += len(verses)
            rf = ref / bid / f'{bid}-{c}.json'
            if rf.exists():
                nb = len(json.loads(rf.read_text(encoding='utf-8'))['verses'])
                if nb != len(verses): comp.append(f'{NOMES[i]} {c}: a1911={len(verses)} versículos, BLIVRE={nb}')
    docs = root / 'docs'; docs.mkdir(exist_ok=True)
    rel = ['Versão: Almeida Revista e Corrigida — edição histórica (reimpressão de 1911) (a1911)',
           'Fonte: Project Gutenberg eBook 62383, arquivo pg62383.txt (UTF-8)', 'SHA-256 da fonte: ' + sha,
           'Capítulos gravados: %d de 1189 · versículos: %d' % (total_c, total_v),
           'Títulos de Salmos guardados no campo titulo (fora dos versículos): %d' % ntit,
           'Parágrafos editoriais separados do texto (referências paralelas, legendas em itálico): %d' % ESTAT['editorial_pulado'],
           'Material editorial recortado do fim de livros (não entra no app): ' + '; '.join('%s: %d linhas (%s...)' % (NOMES[k], len(v), v[0][:30]) for k, v in sorted(NOTAS_EXCLUIDAS.items())),
           'ERROS (%d):' % len(erros)] + erros + ['AVISOS DE ESTRUTURA (%d):' % len(avisos)] + avisos + \
          ['DIFERENÇAS DE CONTAGEM DE VERSÍCULOS EM RELAÇÃO À BLIVRE (%d capítulos; esperadas em parte, pois as edições dividem versículos de modo diferente):' % len(comp)] + comp
    (docs / 'importacao-a1911.txt').write_text('\n'.join(rel) + '\n', encoding='utf-8')
    print('capítulos', total_c, 'de 1189 · versículos', total_v, '· erros', len(erros), '· avisos', len(avisos), '· dif. BLIVRE', len(comp))
    if erros: print('\n'.join(erros[:25])); sys.exit(1)

main()
