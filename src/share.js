/* Compartilhar: cartão com foto, frase curta, nome e link; link direto para cada ensino; texto dividido em trechos curtos.
   Sem rastreio: nada é enviado a ninguém além do que a própria pessoa escolher enviar pelo menu do aparelho.
   Funções puras (testadas em tests/share.test.mjs) + o desenho do cartão, que só roda no navegador. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PVShare = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NAME = 'Palavra Viva — Aprendendo as Escrituras';
  var PHOTOS = ['assets/hero-dawn.jpg', 'assets/hero-reading.jpg', 'assets/hero-bible.jpg'];
  var SERIF = '"Noto Serif","Source Serif 4",Georgia,serif';
  var UI = 'Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

  /* mesma foto para o mesmo ensino, fotos variadas entre ensinos */
  function photoFor(id) {
    if (id == null || id === '') return PHOTOS[0];
    var s = String(id), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return PHOTOS[n % PHOTOS.length];
  }

  /* link do app: vem de config.json (siteUrl); sem isso, usa o endereço em que o app está aberto */
  function baseUrl(siteUrl, here) {
    return String(siteUrl || here || '').split('#')[0].split('?')[0];
  }
  function studyLink(base, id) {
    return String(base || '').split('#')[0] + '#estudo=' + encodeURIComponent(id);
  }
  function parseDeepLink(hash) {
    var m = /^#estudo=([A-Za-z0-9._-]{1,40})$/.exec(String(hash || ''));
    return m ? m[1] : null;
  }

  /* divide em frases sem quebrar abreviações como "cf." e "v." */
  var ABBR = /(?:^|[\s(“"])(?:cf|vv|vs|v|ex|pp|p|Dr|Dra|Sr|Sra|Sto|Sta)\.$/i;
  function splitSentences(text) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return [];
    var parts = raw.split(/(?<=[.!?…]["”)]?)\s+(?=["“(]?[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9])/), out = [];
    parts.forEach(function (p) {
      if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ' ' + p;
      else out.push(p);
    });
    return out;
  }
  /* trechos curtos (2 frases ou até ~280 caracteres) para leitura fácil no celular */
  function chunkText(text, max) {
    max = max || 280;
    var out = [];
    String(text || '').split(/\n\s*\n/).forEach(function (para) {
      var cur = '';
      splitSentences(para).forEach(function (s) {
        if (cur && cur.length + 1 + s.length > max) { out.push(cur); cur = s; }
        else cur = cur ? cur + ' ' + s : s;
      });
      if (cur) out.push(cur);
    });
    return out;
  }
  function wrapLines(measure, text, maxW) {
    var lines = [], cur = '';
    String(text || '').split(/\s+/).filter(Boolean).forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (cur && measure(t) > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function appMessage() { return NAME + ': Bíblia em português, grátis e funciona sem internet.'; }
  function studyMessage(m) {
    return 'Estou estudando “' + m.titulo + '” (' + m.ref + ') em ' + NAME + '.' + (m.pergunta ? ' ' + m.pergunta : '');
  }
  function questionMessage(m) { return m.pergunta + ' Veja em ' + NAME + '.'; }

  /* ---- cartão (só no navegador) ---- */
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = function () { rej(new Error('foto')); };
      i.src = src;
    });
  }
  function paint(c, img, o) {
    var W = 1080, H = 1350, X = 90, MAXW = 900;
    if (img) {
      var s = Math.max(W / img.width, H / img.height), dw = img.width * s, dh = img.height * s;
      c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      var g0 = c.createLinearGradient(0, 0, W, H);
      g0.addColorStop(0, '#0F3A31'); g0.addColorStop(1, '#1F4D43');
      c.fillStyle = g0; c.fillRect(0, 0, W, H);
    }
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(6,20,17,.25)'); g.addColorStop(0.38, 'rgba(6,20,17,.12)');
    g.addColorStop(0.62, 'rgba(6,20,17,.62)'); g.addColorStop(1, 'rgba(6,20,17,.92)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    var text = String(o.text || '').trim();
    var size = text.length <= 60 ? 84 : text.length <= 110 ? 72 : text.length <= 170 ? 62 : 54, lines;
    for (;;) {
      c.font = '700 ' + size + 'px ' + SERIF;
      lines = wrapLines(function (t) { return c.measureText(t).width; }, text, MAXW);
      if (lines.length <= 7 || size <= 40) break;
      size -= 4;
    }
    var lh = Math.round(size * 1.28), bottom = o.sub ? 1000 : 1060;
    c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 18; c.fillStyle = '#FFFFFF';
    lines.forEach(function (l, i) { c.fillText(l, X, bottom - (lines.length - 1 - i) * lh); });
    c.shadowBlur = 0;
    var y = bottom;
    if (o.sub) { y += 62; c.fillStyle = '#E3B96F'; c.font = '700 36px ' + UI; c.fillText(o.sub, X, y); }
    y += 44; c.fillStyle = '#E3B96F'; c.fillRect(X, y, 110, 5);
    y += 70; c.fillStyle = '#FCF8EE'; c.font = '700 46px ' + SERIF; c.fillText('Palavra Viva', X, y);
    y += 44; c.fillStyle = 'rgba(252,248,238,.88)'; c.font = '500 30px ' + UI; c.fillText('Aprendendo as Escrituras', X, y);
    if (o.link) { y += 48; c.fillStyle = 'rgba(252,248,238,.75)'; c.font = '500 28px ' + UI; c.fillText(o.link, X, y); }
  }
  /* o: { text, sub, link (texto curto opcional), photo } -> Promise<Blob JPEG> */
  function cardBlob(o) {
    var cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1350;
    var c = cv.getContext('2d');
    return loadImage(o.photo).catch(function () { return null; }).then(function (img) {
      paint(c, img, o);
      return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, 'image/jpeg', 0.9); });
    });
  }

  /* envia pelo menu do aparelho: imagem + texto + link; se não der, só texto + link; se não der, copia.
     Devolve 'shared' | 'cancelled' | 'copied'. */
  function send(o, copyFn) {
    function fallback() { copyFn(o.text + '\n' + o.url, 'Link copiado'); return 'copied'; }
    function aborted(e) { return e && e.name === 'AbortError'; }
    if (typeof navigator === 'undefined' || !navigator.share) return Promise.resolve(fallback());
    var files = [];
    if (o.blob && typeof File === 'function') {
      try { files = [new File([o.blob], o.filename || 'cartao.jpg', { type: o.blob.type || 'image/jpeg' })]; } catch (e) { files = []; }
    }
    var withFile = !!(files.length && navigator.canShare && navigator.canShare({ files: files }));
    var plain = { title: o.title, text: o.text, url: o.url };
    function go(p) { return navigator.share(p).then(function () { return 'shared'; }); }
    return Promise.resolve().then(function () {
      return withFile ? go({ files: files, title: o.title, text: o.text + '\n' + o.url }) : go(plain);
    }).catch(function (e) {
      if (aborted(e)) return 'cancelled';
      if (withFile) return go(plain).catch(function (e2) { return aborted(e2) ? 'cancelled' : fallback(); });
      return fallback();
    });
  }

  return {
    NAME: NAME, photoFor: photoFor, baseUrl: baseUrl, studyLink: studyLink, parseDeepLink: parseDeepLink,
    splitSentences: splitSentences, chunkText: chunkText, wrapLines: wrapLines,
    appMessage: appMessage, studyMessage: studyMessage, questionMessage: questionMessage,
    cardBlob: cardBlob, send: send
  };
});
