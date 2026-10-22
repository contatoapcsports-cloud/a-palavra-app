import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const sw = read('sw.js'), html = read('index.html'), app = read('app.js'), pages = read('.github/workflows/pages.yml');
const list = name => { const m = new RegExp('const ' + name + ' = \\[(.*?)\\];', 's').exec(sw); return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]); };

test('todo arquivo do cache do app existe no repositório', () => {
  for (const f of list('SHELL_FILES')) if (f !== './') assert.ok(existsSync(join(root, f)), 'falta: ' + f);
});
test('index.html só aponta para arquivos que existem (assets opcionais ficam de fora)', () => {
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const u = m[1]; if (/^(https?:|mailto:|data:)/.test(u)) continue;
    assert.ok(existsSync(join(root, u)), 'index.html aponta para arquivo inexistente: ' + u);
  }
});
test('ícones do manifest do PWA existem', () => {
  const m = JSON.parse(read('manifest.json'));
  for (const i of m.icons) assert.ok(existsSync(join(root, i.src)), 'ícone ausente: ' + i.src);
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'));
});
test('o deploy publica tudo o que o app usa', () => {
  for (const f of ['index.html', 'app.js', 'styles.css', 'sw.js', 'manifest.json', 'config.json', 'reset.html', 'content-manifest.json', 'icons', 'src', 'content', 'assets'])
    assert.ok(pages.includes(f), 'pages.yml não publica: ' + f);
});
test('versão do app é carimbada no deploy a partir do hash dos arquivos', () => {
  assert.ok(sw.includes("'__SHELL_HASH__'") && app.includes("'__SHELL_HASH__'"));
  assert.ok(pages.includes('__SHELL_HASH__') && pages.includes('sha256sum'));
});
test('service worker: sem skipWaiting automático e sem ler sw.js do cache', () => {
  assert.equal((sw.match(/skipWaiting\(\)/g) || []).length, 1);
  assert.ok(/message[\s\S]{0,200}SKIP_WAITING[\s\S]{0,80}skipWaiting\(\)/.test(sw));
  assert.ok(sw.includes("file === 'sw.js') return"));
});
test('o app não faz nenhuma chamada a sites externos', () => {
  for (const [n, t] of [['index.html', html], ['app.js', app], ['styles.css', read('styles.css')], ['sw.js', sw]])
    assert.ok(!/https?:\/\//.test(t.replace(/<meta (?:property="og:|name="twitter:)[^>]*>/g, '')), n + ' contém endereço externo'); // só as tags do cartão de compartilhamento podem ter endereço
});
test('aba vazia nunca vira "em breve" na interface', () => {
  assert.ok(!/em breve/i.test(app) && !/em breve/i.test(html));
});
test('proprietário, direitos reservados e chave Pix estão configurados', () => {
  const c = JSON.parse(read('config.json'));
  assert.equal(c.ownerName, 'Anderson Pereira Cabral');
  assert.ok(/^\d{4}$/.test(c.year));
  assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c.pixKey), 'chave Pix aleatória no formato esperado');
  assert.ok(html.includes('id="rightsHome"') && html.includes('id="rightsMenu"') && html.includes('name="author"'));
});
test('termos de uso e privacidade e licença existem e o app aponta para eles', () => {
  assert.ok(existsSync(join(root, 'assets/termos.html')) && existsSync(join(root, 'LICENSE')));
  assert.ok(app.includes("href: 'assets/termos.html'") && pages.includes('assets'));
  const t = read('assets/termos.html');
  assert.ok(/Pol[íi]tica de Privacidade/.test(t) && /CC BY 4\.0/.test(t) && /intelig[êe]ncia artificial/i.test(t));
});
test('página Créditos e colaboradores: seis participantes na ordem, nota de transparência, link no Sobre e CREDITS.md preservado', () => {
  const c = read('assets/creditos.html');
  assert.deepEqual([...c.matchAll(/data-colab="([^"]+)"/g)].map(m => m[1]), ['Anderson Pereira Cabral', 'Claude', 'ChatGPT', 'Manus', 'GitHub', 'Meta']);
  assert.ok(c.includes('não implica parceria oficial, patrocínio ou aprovação institucional'));
  assert.ok(c.includes('responsavel.jpg') && !/https?:\/\//.test(c));
  assert.ok(app.includes("href: 'assets/creditos.html'") && app.includes('Créditos e colaboradores'));
  assert.ok(sw.includes('assets/creditos.html'));
  const cr = read('CREDITS.md');
  assert.ok(cr.includes('Bíblia Livre') && cr.includes('CC BY 4.0') && cr.includes('ambiente-leitura.mp3'));
});
