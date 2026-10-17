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

## Fábrica de conteúdo (APIs gratuitas)
Sem GPU e sem custo: um modelo gera e dois auditores de famílias diferentes avaliam os 36 critérios. Chaves só nos Secrets do repositório: `GROQ_API_KEY` (gerador), `GEMINI_API_KEY` e `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (auditores). A fábrica será adicionada depois de importar o texto bíblico (`importar-biblia`).
