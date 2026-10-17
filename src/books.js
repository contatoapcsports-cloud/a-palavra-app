/* Cânon bíblico fixo (66 livros): nomes, siglas, testamento e número de capítulos.
   O conteúdo (texto) vem dos pacotes; aqui só a estrutura, que não muda. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PVBooks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* [nome, sigla, capítulos] — AT = 39 primeiros, NT = 27 últimos */
  var RAW = [
    ['Gênesis', 'Gn', 50], ['Êxodo', 'Êx', 40], ['Levítico', 'Lv', 27], ['Números', 'Nm', 36], ['Deuteronômio', 'Dt', 34],
    ['Josué', 'Js', 24], ['Juízes', 'Jz', 21], ['Rute', 'Rt', 4], ['1 Samuel', '1Sm', 31], ['2 Samuel', '2Sm', 24],
    ['1 Reis', '1Rs', 22], ['2 Reis', '2Rs', 25], ['1 Crônicas', '1Cr', 29], ['2 Crônicas', '2Cr', 36], ['Esdras', 'Ed', 10],
    ['Neemias', 'Ne', 13], ['Ester', 'Et', 10], ['Jó', 'Jó', 42], ['Salmos', 'Sl', 150], ['Provérbios', 'Pv', 31],
    ['Eclesiastes', 'Ec', 12], ['Cantares', 'Ct', 8], ['Isaías', 'Is', 66], ['Jeremias', 'Jr', 52], ['Lamentações', 'Lm', 5],
    ['Ezequiel', 'Ez', 48], ['Daniel', 'Dn', 12], ['Oseias', 'Os', 14], ['Joel', 'Jl', 3], ['Amós', 'Am', 9],
    ['Obadias', 'Ob', 1], ['Jonas', 'Jn', 4], ['Miqueias', 'Mq', 7], ['Naum', 'Na', 3], ['Habacuque', 'Hc', 3],
    ['Sofonias', 'Sf', 3], ['Ageu', 'Ag', 2], ['Zacarias', 'Zc', 14], ['Malaquias', 'Ml', 4],
    ['Mateus', 'Mt', 28], ['Marcos', 'Mc', 16], ['Lucas', 'Lc', 24], ['João', 'Jo', 21], ['Atos', 'At', 28],
    ['Romanos', 'Rm', 16], ['1 Coríntios', '1Co', 16], ['2 Coríntios', '2Co', 13], ['Gálatas', 'Gl', 6], ['Efésios', 'Ef', 6],
    ['Filipenses', 'Fp', 4], ['Colossenses', 'Cl', 4], ['1 Tessalonicenses', '1Ts', 5], ['2 Tessalonicenses', '2Ts', 3],
    ['1 Timóteo', '1Tm', 6], ['2 Timóteo', '2Tm', 4], ['Tito', 'Tt', 3], ['Filemom', 'Fm', 1], ['Hebreus', 'Hb', 13],
    ['Tiago', 'Tg', 5], ['1 Pedro', '1Pe', 5], ['2 Pedro', '2Pe', 3], ['1 João', '1Jo', 5], ['2 João', '2Jo', 1],
    ['3 João', '3Jo', 1], ['Judas', 'Jd', 1], ['Apocalipse', 'Ap', 22]
  ];
  var LIST = RAW.map(function (r, i) {
    return { id: String(i + 1), name: r[0], abbr: r[1], chapters: r[2], testament: i < 39 ? 'at' : 'nt' };
  });
  var BY_ID = {};
  LIST.forEach(function (b) { BY_ID[b.id] = b; });

  function all() { return LIST.slice(); }
  function byId(id) { return BY_ID[String(id)] || null; }

  return { all: all, byId: byId };
});
