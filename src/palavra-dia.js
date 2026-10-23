/* Palavra do Dia: seção leve na tela inicial. Texto sempre visível; áudio opcional com a voz do próprio aparelho.
   Sem rede, sem conta, sem coleta de dados. O versículo é da Bíblia Livre (BLIVRE, CC BY 4.0), sem alteração. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PVPalavraDia = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DADOS = [
  { b: '19', c: 23, v: 1, ate: 3, ref: 'Salmos 23:1-3',
    texto: 'O SENHOR é meu pastor, nada me faltará. Ele me faz deitar em pastos verdes, e me leva a águas quietas. Ele restaura minha alma, e me guia pelos caminhos da justiça por seu nome.',
    reflexao: 'Pastor não é quem manda de longe, é quem caminha junto. Hoje, se o dia parecer maior que as suas forças, lembre-se de quem conduz o seu passo: Ele conhece o caminho e sabe onde você precisa descansar.',
    oracao: 'Senhor, sê o meu Pastor hoje. Guia os meus passos, acalma o meu coração e ensina-me a confiar em Ti no caminho.' },
  { b: '23', c: 41, v: 10, ate: 10, ref: 'Isaías 41:10',
    texto: 'Não temas, porque eu estou contigo; não te assombres, porque eu sou teu Deus. Eu te fortaleço, te ajudo, e te sustento com a minha mão direita de justiça.',
    reflexao: 'O medo costuma falar mais alto do que a promessa. Este versículo não nega a dificuldade; ele muda o centro da cena: Deus está com você, e é essa presença que sustenta.',
    oracao: 'Pai, quando o medo chegar, lembra-me de que estás comigo. Fortalece-me e ampara-me com a Tua mão.' },
  { b: '50', c: 4, v: 6, ate: 7, ref: 'Filipenses 4:6-7',
    texto: 'Não estejais ansiosos por coisa alguma; mas em tudo, por meio de orações e súplicas com ações de gratidão, sejam os vossos pedidos conhecidos por Deus; e a paz de Deus, que excede todo entendimento, guardará os vossos corações e as vossas mentes em Cristo Jesus.',
    reflexao: 'Ansiedade pede resposta, e a resposta bíblica é levar tudo a Deus em oração, com gratidão. A paz prometida não depende de ter todas as respostas, mas de entregar o que pesa.',
    oracao: 'Senhor, entrego a Ti as minhas preocupações de hoje. Dá-me a Tua paz, que guarda o coração e os pensamentos.' },
  { b: '20', c: 3, v: 5, ate: 6, ref: 'Provérbios 3:5-6',
    texto: 'Confia no SENHOR com todo o teu coração; e não te apoies em teu próprio entendimento. Dá reconhecimento a ele em todas os teus caminhos; e ele endireitará tuas veredas.',
    reflexao: 'Confiar de todo o coração é decidir, a cada escolha, não se apoiar só no próprio entendimento. Reconhecer Deus nos caminhos é abrir espaço para que Ele os endireite.',
    oracao: 'Deus, quero Te reconhecer em tudo o que fizer hoje. Endireita os meus caminhos e livra-me de confiar só em mim.' },
  { b: '40', c: 11, v: 28, ate: 29, ref: 'Mateus 11:28-29',
    texto: 'Vinde a mim todos vós que estais cansados e sobrecarregados, e eu vos farei descansar. Tomai sobre vós o meu jugo e aprendei de mim, porque sou manso e humilde de coração; e encontrareis descanso para as vossas almas.',
    reflexao: 'Jesus não convida os cansados a se esforçarem mais, mas a virem a Ele. O descanso que Ele oferece começa com uma aproximação simples: vir, aprender, descansar.',
    oracao: 'Senhor Jesus, estou cansado e venho a Ti. Ensina-me a Tua mansidão e dá descanso à minha alma.' },
  { b: '6', c: 1, v: 9, ate: 9, ref: 'Josué 1:9',
    texto: 'Olha que te mando que te esforces e sejas valente: não temas nem desmaies, porque o SENHOR teu Deus será contigo onde quer que fores.',
    reflexao: 'A coragem bíblica não nasce de nos sentirmos fortes, mas da certeza de que Deus nos acompanha aonde formos. Hoje, dê o passo que precisa dar sem carregar o medo sozinho.',
    oracao: 'Senhor, torna-me forte e corajoso. Que eu caminhe hoje sabendo que o Senhor, meu Deus, está comigo.' },
  { b: '45', c: 8, v: 28, ate: 28, ref: 'Romanos 8:28',
    texto: 'E sabemos que todas as coisas juntamente contribuem para o bem daqueles que amam a Deus, dos que são chamados segundo o seu propósito.',
    reflexao: 'A promessa não diz que tudo é bom, mas que Deus age em todas as coisas para o bem dos que O amam. Confiar nisso não apaga a dor; dá a ela um sentido e uma esperança.',
    oracao: 'Pai, ajuda-me a confiar que o Senhor trabalha em tudo, mesmo no que não entendo. Que eu continue Te amando.' },
  { b: '19', c: 46, v: 1, ate: 1, ref: 'Salmos 46:1',
    texto: 'Deus é nosso refúgio e força; socorro oportuno nas angústias.',
    reflexao: 'Refúgio é o lugar para onde se corre quando a tempestade vem. Antes de buscar soluções, o salmista corre para Deus: Ele já está presente, e é suficiente.',
    oracao: 'Deus, és o meu refúgio e a minha força. Neste dia, ajuda-me a correr para Ti em primeiro lugar.' },
  { b: '43', c: 14, v: 27, ate: 27, ref: 'João 14:27',
    texto: 'A paz vos deixo, minha paz vos dou; vou dá- la a vós, não como o mundo a dá. Não se perturbe vosso coração, nem se atemorize.',
    reflexao: 'A paz que o mundo dá depende das circunstâncias; a paz de Jesus permanece mesmo quando elas mudam. Por isso Ele pede que o coração não se perturbe nem tenha medo.',
    oracao: 'Senhor Jesus, deixa-me a Tua paz. Acalma o meu coração e afasta o medo que me inquieta.' },
  { b: '25', c: 3, v: 22, ate: 23, ref: 'Lamentações 3:22-23',
    texto: 'É pelas bondades do SENHOR que não somos consumidos, porque suas misericórdias não têm fim. Elas são novas a cada manhã; grande é a tua fidelidade.',
    reflexao: 'Cada manhã traz uma misericórdia nova. Mesmo depois de um dia difícil, o recomeço é possível, porque a fidelidade de Deus não depende do nosso desempenho de ontem.',
    oracao: 'Senhor, obrigado porque as Tuas misericórdias se renovam a cada manhã. Dá-me um recomeço fiel hoje.' },
  { b: '40', c: 6, v: 33, ate: 34, ref: 'Mateus 6:33-34',
    texto: 'Mas buscai primeiramente o Reino de Deus e a sua justiça, e todas estas coisas vos serão acrescentadas. Não andeis, pois, ansiosos pelo dia de amanhã, porque o amanhã cuidará de si mesmo. Basta a cada dia o seu mal.',
    reflexao: 'Buscar primeiro o Reino é uma questão de prioridade, não de ignorar as necessidades. Jesus convida a viver um dia de cada vez, confiando que o Pai cuida do que precisamos.',
    oracao: 'Pai, quero buscar primeiro o Teu Reino. Livra-me da ansiedade com o amanhã e ensina-me a viver este dia.' },
  { b: '19', c: 121, v: 1, ate: 2, ref: 'Salmos 121:1-2',
    texto: 'Levanto meus olhos aos montes. De onde virá meu socorro? Meu socorro vem do SENHOR, que fez os céus e a terra.',
    reflexao: 'O salmista levanta os olhos para além dos montes, porque a ajuda não vem do que é grande aos nossos olhos, mas do Criador deles. Olhar para Deus reorganiza o tamanho dos problemas.',
    oracao: 'Senhor, levanto os meus olhos a Ti. Obrigado porque o meu socorro vem do Senhor, que fez os céus e a terra.' },
  { b: '60', c: 5, v: 7, ate: 7, ref: '1 Pedro 5:7',
    texto: 'lançando sobre ele toda a vossa ansiedade; porque ele tem cuidado de vós.',
    reflexao: 'Lançar a ansiedade sobre Deus é um ato de confiança: entregar o peso a Quem pode carregá-lo. A razão é simples e profunda: Ele cuida de você.',
    oracao: 'Pai, lanço sobre Ti a minha ansiedade, porque Tu cuidas de mim. Dá-me descanso na Tua providência.' },
  { b: '48', c: 6, v: 9, ate: 9, ref: 'Gálatas 6:9',
    texto: 'Porém não cansemos de fazer o bem, pois no tempo devido colheremos, se não desistirmos.',
    reflexao: 'Fazer o bem cansa quando o resultado demora. A Palavra não promete que será fácil, mas que haverá colheita no tempo certo, se não desanimarmos.',
    oracao: 'Senhor, dá-me perseverança para fazer o bem sem desanimar. Que eu confie na Tua colheita no tempo certo.' }
  ];
  var CREDITO = 'Texto bíblico: Bíblia Livre (BLIVRE), CC BY 4.0. Reflexão e oração escritas com apoio de inteligência artificial; não substituem a Bíblia.';

  /* um item por dia, na ordem, pela data local do aparelho */
  function indiceDoDia(data, total) {
    var d = data || new Date();
    var n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    return ((n % total) + total) % total;
  }
  function doDia(data) { return DADOS[indiceDoDia(data, DADOS.length)]; }
  /* roteiro de narração: o que a voz lê, na ordem em que aparece na tela */
  function roteiro(e) {
    return ['Palavra do dia.', e.ref + '.', e.texto, 'Reflexão.', e.reflexao, 'Oração.', e.oracao, 'Amém.'].join(' ');
  }

  var falando = false;
  function vozPt() {
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^pt/i.test(v.lang); });
    var salva = ''; try { salva = localStorage.getItem('pv_voz') || ''; } catch (x) { /* ok */ }
    var i; if (salva) for (i = 0; i < vs.length; i++) if (vs[i].voiceURI === salva) return vs[i];
    for (i = 0; i < vs.length; i++) if (/pt[-_]?br/i.test(vs[i].lang)) return vs[i];
    return vs[0] || null;
  }
  function parar(btn) { try { speechSynthesis.cancel(); } catch (x) { /* ok */ } falando = false; if (btn) btn.textContent = 'Ouvir'; }
  function ouvir(e, btn) {
    if (falando) return parar(btn);
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(roteiro(e)), v = vozPt();
      u.lang = v ? v.lang : 'pt-BR'; if (v) u.voice = v; u.rate = 0.92;
      u.onend = u.onerror = function () { falando = false; btn.textContent = 'Ouvir'; };
      falando = true; btn.textContent = 'Parar'; speechSynthesis.speak(u);
    } catch (x) { parar(btn); }
  }

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function montar() {
    if (typeof document === 'undefined' || document.getElementById('pdia')) return;
    var antes = document.getElementById('railSec'), pai = antes && antes.parentNode;
    if (!pai) return;
    var e = doDia();
    var st = el('style'); st.textContent =
      '#pdia{margin:18px 16px 4px;padding:18px 16px;border-radius:20px;background:var(--paper,#fbf7ee);color:inherit}' +
      '#pdia .eyebrow{display:block}#pdia h2{margin:4px 0 8px;font-size:20px}' +
      '#pdia blockquote{margin:0 0 12px;padding:0 0 0 12px;border-left:3px solid var(--accent,#2f5d50);font-size:17px;line-height:1.55}' +
      '#pdia h3{margin:12px 0 4px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--soft,#6b6b5f)}' +
      '#pdia p{margin:0;line-height:1.55}#pdia .cr{margin-top:12px;font-size:11px;color:var(--soft,#6b6b5f)}' +
      '#pdia .bt{margin-top:12px;padding:10px 16px;border:0;border-radius:14px;font:inherit;font-weight:600;background:var(--accent,#2f5d50);color:#fff}';
    document.head.appendChild(st);
    var s = el('section', 'sec'); s.id = 'pdia'; s.setAttribute('aria-label', 'Palavra do Dia');
    s.appendChild(el('span', 'eyebrow', 'Palavra do Dia'));
    s.appendChild(el('h2', null, e.ref));
    s.appendChild(el('blockquote', null, e.texto));
    s.appendChild(el('h3', null, 'Reflexão')); s.appendChild(el('p', null, e.reflexao));
    s.appendChild(el('h3', null, 'Oração')); s.appendChild(el('p', null, e.oracao));
    if (typeof speechSynthesis !== 'undefined' && 'SpeechSynthesisUtterance' in window) {
      var b = el('button', 'bt', 'Ouvir'); b.type = 'button'; b.setAttribute('aria-label', 'Ouvir a Palavra do Dia com a voz do aparelho');
      b.addEventListener('click', function () { ouvir(e, b); }); s.appendChild(b);
      window.addEventListener('pagehide', function () { parar(b); });
    }
    s.appendChild(el('p', 'cr', CREDITO));
    pai.insertBefore(s, antes);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  }
  return { dados: DADOS, indiceDoDia: indiceDoDia, doDia: doDia, roteiro: roteiro };
});
