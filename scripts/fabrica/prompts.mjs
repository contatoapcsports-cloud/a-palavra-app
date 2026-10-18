import { CRITERIOS, GATES } from './criterios.mjs';

export const SISTEMA_GERADOR = doutrina => `Você escreve ensinos bíblicos curtos para um aplicativo gratuito de estudo da Bíblia, em português do Brasil, para leitores comuns (do jovem ao idoso), sem formação teológica.
O texto bíblico (Bíblia Livre, 2018) vem no pedido e é a única fonte que você pode citar. REGRA DE CITAÇÃO: só use aspas para copiar, letra por letra, palavras que estão no texto do pedido (no máximo 12 palavras seguidas). Se não tiver certeza de que a frase está idêntica, NÃO use aspas: explique com suas palavras e indique a referência (ex.: João 3.16). Não cite de memória, não invente versículos, não acrescente fatos que não estejam no texto ou que não sejam amplamente certos.
Cada ensino deve ensinar o evangelho, despertar curiosidade e ser concreto: nada de frases genéricas que serviriam a qualquer passagem. Varie a forma de começar cada seção. Não mencione IA, sistema, prompt ou auditoria.

LINHA DOUTRINÁRIA:
${doutrina}

Responda sempre e somente com um objeto JSON válido.`;

export function pedidoGerador(u, recentes, feedback) {
  const texto = u.verses.map(v => v.n + ' ' + v.t).join('\n');
  const antes = u.antes.length ? u.antes.map(v => v.n + ' ' + v.t).join('\n') : '(início do capítulo)';
  const depois = u.depois.length ? u.depois.map(v => v.n + ' ' + v.t).join('\n') : '(fim do capítulo)';
  let p = `TRECHO-ALVO: ${u.ref} (${u.bookName})

TEXTO DO TRECHO-ALVO:
${texto}

CONTEXTO ANTES (não é o alvo):
${antes}

CONTEXTO DEPOIS (não é o alvo):
${depois}
`;
  if (recentes.length) p += `\nENSINOS JÁ PRONTOS (não repita título, ideias nem a forma de começar): ${recentes.join(' | ')}\n`;
  p += `
Produza um objeto JSON com exatamente estas chaves:
- "titulo": 3 a 9 palavras, desperta curiosidade sem exagero.
- "temas": lista de 3 a 5 palavras-chave simples em minúsculas (ex.: "perdão", "fé").
- "pergunta": uma pergunta curta (até 150 caracteres) para a pessoa pensar ANTES de ler, terminando com "?".
- "entender": 2 ou 3 parágrafos separados por uma linha em branco, de 600 a 1100 caracteres no total: o que o texto diz, o contexto e o sentido, em linguagem simples. Pode citar trechos curtos (até 12 palavras, entre aspas, exatamente como no texto).
- "ligar": de 250 a 600 caracteres: como este trecho aponta para Jesus e o evangelho. Seja proporcional: firme onde o texto fala de Cristo, cuidadoso onde a ligação é por um tema mais amplo.
- "ligar_selo": true somente se o próprio texto fala de Cristo ou o anuncia de modo claro; senão false.
- "viver": 1 ou 2 parágrafos (250 a 700 caracteres) com uma aplicação concreta que decorre do texto, para a vida de hoje.
- "guarde": uma frase curta e marcante (até 24 palavras) para guardar no coração; pode ser uma ideia do texto em suas palavras.
- "ore": uma oração curta em primeira pessoa (100 a 380 caracteres), específica deste texto.
- "teste": objeto com "pergunta" (sobre o que o texto diz), "certa" (a resposta correta, curta), "erradas" (lista de 2 respostas erradas mas plausíveis, curtas) e "explicacao" (1 ou 2 frases dizendo por que a certa está certa, de 40 a 280 caracteres).
- "refs": lista de 2 a 4 referências cruzadas reais e pertinentes, no formato "Livro cap:vers" ou "Livro cap:vers-vers" (ex.: "Romanos 5:8"), de OUTROS trechos da Bíblia que ajudam a entender este.
`;
  if (feedback) p += `\nSUA VERSÃO ANTERIOR FOI RECUSADA. Versão anterior:\n${JSON.stringify(feedback.anterior)}\n\nProblemas apontados (corrija todos, sem criar outros e sem perder o que estava bom):\n${feedback.falhas.map(f => '- ' + f).join('\n')}\n`;
  return p;
}

export const SISTEMA_AUDITOR = doutrina => `Você é auditor rigoroso de ensinos bíblicos de um aplicativo cristão em português do Brasil. Confira o ENSINO contra o TEXTO BÍBLICO dado e contra os 36 critérios abaixo.
Para cada critério responda "P" (passou) ou "F" (falhou). Marque "F" somente quando houver um problema concreto que você consiga apontar em uma frase; se não houver, marque "P". Não invente problemas e não deixe passar erro de fato, de contexto, de doutrina ou de linguagem. Em dúvida real sobre um fato bíblico, marque "F".

LINHA DOUTRINÁRIA DO PROJETO:
${doutrina}

CRITÉRIOS:
${GATES.map((g, i) => (i + 1) + '. ' + g + ': ' + CRITERIOS[g]).join('\n')}

Responda SOMENTE com um objeto JSON no formato:
{"criterios": {${GATES.map(g => '"' + g + '":"P"').join(', ')}}, "problemas": [{"criterio": "NOME", "motivo": "uma frase"}]}
Use "P" ou "F" em cada um dos 36 critérios. A lista "problemas" deve ter uma entrada para cada "F" e ficar vazia se tudo passou.`;

export function pedidoAuditor(u, d) {
  const letra = ['A', 'B', 'C'];
  return `TRECHO-ALVO: ${u.ref} (${u.bookName})

TEXTO BÍBLICO DO TRECHO-ALVO:
${u.verses.map(v => v.n + ' ' + v.t).join('\n')}

CONTEXTO ANTES:
${u.antes.map(v => v.n + ' ' + v.t).join('\n') || '(início do capítulo)'}

CONTEXTO DEPOIS:
${u.depois.map(v => v.n + ' ' + v.t).join('\n') || '(fim do capítulo)'}

ENSINO A AUDITAR:
TÍTULO: ${d.titulo}
PERGUNTA PARA PENSAR ANTES DE LER: ${d.pergunta}
ENTENDER:
${d.entender}
LIGAR AO EVANGELHO (${d.ligar.selo ? 'com selo "Cristo neste texto"' : 'sem selo'}):
${d.ligar.texto}
VIVER:
${d.viver}
GUARDE: ${d.guarde}
ORE: ${d.ore}
TESTE: ${d.quiz.pergunta}
${d.quiz.opcoes.map((o, i) => letra[i] + ') ' + o).join('\n')}
RESPOSTA MARCADA COMO CERTA: ${letra[d.quiz.certa]}
EXPLICAÇÃO: ${d.quiz.explicacao}
REFERÊNCIAS CRUZADAS: ${d.refs.join('; ')}

Audite agora e responda somente com o JSON pedido.`;
}
