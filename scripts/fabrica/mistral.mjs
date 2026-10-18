import { Provedor, ProvError, extrairJson } from './provedores.mjs';

/* Mistral (La Plateforme, plano gratuito; API compatível com a da OpenAI). */
export class Mistral extends Provedor {
  constructor(o) { super({ nome: 'mistral', base: 'https://api.mistral.ai', minIntervaloMs: 1500, ...o }); }
  async json({ system, user, max = 4000, temp = 0.6 }) {
    const corpo = { model: this.modelo, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: temp, max_tokens: max, response_format: { type: 'json_object' } };
    const chamar = c => this.http(this.base + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + this.chave }, body: JSON.stringify(c) });
    let txt;
    try { txt = await chamar(corpo); }
    catch (e) { if (e.status === 400 || e.status === 422) { delete corpo.response_format; txt = await chamar(corpo); } else throw e; } // sem modo JSON: pede só no texto
    const j = JSON.parse(txt), ch = j.choices && j.choices[0];
    this.conta(j.usage && j.usage.prompt_tokens, j.usage && j.usage.completion_tokens);
    if (!ch || !ch.message || !ch.message.content) throw new ProvError(this.nome, 'resposta vazia (' + (ch && ch.finish_reason) + ')');
    if (ch.finish_reason === 'length') throw new ProvError(this.nome, 'resposta cortada (max tokens)');
    return extrairJson(ch.message.content);
  }
}
