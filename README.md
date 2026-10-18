# Palavra Viva

Bíblia em português, gratuita e sem internet, com ensino em camadas. PWA estático publicado no GitHub Pages.

## Como o app funciona
- **Estrutura fixa:** `src/books.js` tem os 66 livros. O texto vem de pacotes em `content/`, listados em `content-manifest.json` com hash SHA-256. Pacote que não confere com o hash é recusado.
- **Offline:** o service worker (`sw.js`) guarda o app e os capítulos na instalação. "Baixar para ler sem internet" guarda também as passagens de estudo.
- **Atualização:** nunca automática. O app mostra "Há uma versão nova" e só troca quando a pessoa toca em Atualizar. O número de versão do app é carimbado no deploy (hash dos arquivos do app), então só muda quando o app muda.
- **Conteúdo:** só aceita manifesto de geração maior que a guardada. O último conteúdo válido nunca é descartado.
- **Estudo:** abas Ler, Entender, Ligar ao evangelho e Aprofundar. Aba sem conteúdo não aparece.

## Configuração (`config.json`)
`ownerName`, `year`, `contactEmail`, `pixKey`, `siteUrl`, `audio`. Se `pixKey` estiver vazio, o item "Abençoe este Projeto" some. A chave Pix nunca aparece na tela, só é copiada.

## Arquivos que ficam fora do código (enviar para `assets/`)
`hero-bible.jpg`, `hero-dawn.jpg`, `hero-reading.jpg`, `abencoe.jpg`, `ambiente-leitura.mp3` (opcional: sem ele o app usa um pad sintetizado). Se faltar imagem, aparece um fundo verde no lugar.

## Testes
- `node --test tests/*.test.mjs` e `node scripts/validate-content.mjs` (rodam no CI a cada push).

## Adicionar conteúdo
1. Coloque o JSON em `content-src/biblia/...` (capítulo) ou `content-src/camada2/...` (passagem).
2. `node scripts/build-manifest.mjs` (gera arquivos com hash e sobe a geração).
3. `node scripts/validate-content.mjs`, depois commit e push.

Passagens reais exigem auditoria: 2 auditores de famílias diferentes entre si e do gerador, 36 critérios todos "P". Enquanto `production` for `false` em `content-src/meta.json`, o app avisa que o conteúdo é fictício.

## Numeração do conteúdo
`minGeneration` em `content-src/meta.json` garante que a geração nunca fique abaixo da que os aparelhos já guardaram (o app só aceita geração maior). Não diminua esse número.

## Voltar atrás (rollback)
Restaure em `content-src/` a versão boa e rode o build: a geração sobe de novo (nunca desce), então os aparelhos aceitam.

## Fábrica de ensinos (APIs gratuitas, sem custo)
Um modelo gera e dois de famílias diferentes auditam os 36 critérios (`scripts/fabrica/criterios.mjs`); os DOIS precisam aprovar tudo, senão o ensino volta ao gerador com os motivos (até 4 rodadas) e, se não passar, fica para outro dia. Nada é publicado sem os dois aprovarem e sem passar nas verificações automáticas (tamanho, idioma, citações que existem no texto, repetição, referências cruzadas que existem na Bíblia instalada).
- **Quem faz o quê** (`fabrica/config.json`): gera o Groq `openai/gpt-oss-120b` (OpenAI), ou o Groq Qwen (Alibaba) quando o primeiro atinge o limite do dia; audita 1 o Gemini `gemini-2.5-flash` (Google); audita 2 o Cloudflare Llama (Meta), ou o Groq gpt-oss/Qwen quando o limite do Cloudflare acaba. Em cada ensino, gerador e os dois auditores são de três famílias diferentes. Chaves só nos Secrets: `GROQ_API_KEY`, `GEMINI_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Três ensinos andam em paralelo.
- **Linha doutrinária** (`fabrica/doutrina.md`): lida pelo gerador e pelos auditores; o responsável pode editar.
- **Rodar**: workflow `fabrica` (de 3 em 3 horas, e manualmente em Actions → fabrica → Run workflow; o piloto gera 6). Quando o limite diário de qualquer provedor acaba, a execução para e continua no próximo horário. O relatório de cada execução fica em `docs/fabrica.txt` (inclui tokens e chamadas gastos) e o andamento em `fabrica/estado.json`.
- **Ordem**: João, Marcos, Lucas, Mateus, Atos, Romanos, Salmos, Provérbios e demais livros (`ordem_livros`). Cada ensino é um trecho de até 12 versículos, em `content-src/camada2/<livro>/<id>.json`.
- **Publicação**: ensinos aprovados entram no manifesto (`build-manifest`), passam em `validate-content` e nos testes, são gravados no repositório e o site é publicado de novo.

## Busca
`src/core.js`: busca por palavra inteira (acento e caixa não importam), com plural, feminino e conjugações regulares; verbo e substantivo da mesma ideia (orar/oração, perdoar/perdão) vêm depois da palavra exata. Várias palavras: todas precisam estar no versículo; aspas = frase exata. O índice de todos os versículos é o pacote `busca.*.json`.
