/* Chamadas às APIs gratuitas (Groq, Gemini, Cloudflare Workers AI). Sem dependências: usa fetch do Node 22.
   Regras: nunca imprime chave; 429 de limite por minuto espera e tenta de novo; 429 de limite diário bloqueia o provedor até o fim da execução. */
export class QuotaError extends Error { constructor(prov, msg) { super(prov + ': limite diário atingido (' + msg + ')'); this.quota = true; this.prov = prov; } }
export class ProvError extends Error { constructor(prov, msg, status) { super(prov + ': ' + msg); this.prov = prov; this.status = status; } }

const dormir = ms => new Promise(r => setTimeout(r, ms));
export function extrairJson(texto) {
  let t = String(texto == null ? '' : texto).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* tenta recortar */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* falhou */ } }
  throw new Error('resposta sem JSON válido');
}
const DIARIO = /per day|daily|rpd|tpd|neurons|free allocation|quota exceeded|exceeded your current quota|resource_exhausted.*(day|quota)/i;
function esperaDe(resp, corpo) {
  const h = Number(resp.headers.get('retry-after'));
  if (h > 0) return h;
  const m = /try again in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(corpo) || /retryDelay"?\s*[:=]\s*"?(\d+)s/i.exec(corpo);
  if (m && m.length === 4) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  if (m && m.length === 2) return +m[1];
  return 0;
}

export class Provedor {
  /* opts: { nome, familia, modelo, base, minIntervaloMs, log, semEspera } */
  constructor(o) { Object.assign(this, { chamadas: 0, tokensIn: 0, tokensOut: 0, bloqueado: null, ultimo: 0, janela: [] }, o); }
  /* limite de tokens por minuto (TPM): espera a janela de 60 s ter espaço antes de chamar, em vez de bater no 429 */
  async reservar(est) {
    if (!this.limiteTpm || this.semEspera) return null;
    for (;;) {
      const agora = Date.now(); this.janela = this.janela.filter(x => agora - x.t < 60000);
      const soma = this.janela.reduce((a, x) => a + x.n, 0);
      if (soma + est <= this.limiteTpm || !this.janela.length) { const r = { t: agora, n: est }; this.janela.push(r); return r; }
      await dormir(Math.max(500, 60000 - (agora - this.janela[0].t) + 200));
    }
  }
  async ritmo() { // serializa o espaçamento entre chamadas, mesmo com vários trabalhos em paralelo
    const anterior = this.vez || Promise.resolve(); let solta; this.vez = new Promise(r => { solta = r; });
    await anterior;
    const falta = this.ultimo + (this.minIntervaloMs || 0) - Date.now();
    if (falta > 0 && !this.semEspera) await dormir(falta);
    this.ultimo = Date.now(); solta();
  }
  async http(url, init) {
    if (this.bloqueado) throw new QuotaError(this.nome, this.bloqueado);
    let ultimoErro;
    for (let t = 1; t <= 8; t++) {
      await this.ritmo();
      let r, corpo;
      try { r = await fetch(url, init); corpo = await r.text(); }
      catch (e) { ultimoErro = new ProvError(this.nome, 'rede: ' + e.message); if (!this.semEspera) await dormir(Math.min(5000 * t, 30000)); continue; }
      if (r.ok) { this.chamadas++; return corpo; }
      const trecho = corpo.slice(0, 400).replace(/\s+/g, ' ');
      if (r.status === 429 || (r.status === 403 && DIARIO.test(corpo))) {
        const espera = esperaDe(r, corpo);
        if (DIARIO.test(corpo) && !/per minute|rpm|tpm/i.test(corpo) || espera > 180) { this.bloqueado = trecho; throw new QuotaError(this.nome, trecho); }
        ultimoErro = new ProvError(this.nome, '429 ' + trecho, 429);
        if (!this.semEspera) await dormir(Math.min(Math.max(espera * 1000 + 1000, 3000), 120000));
        continue;
      }
      if (r.status >= 500) { ultimoErro = new ProvError(this.nome, r.status + ' ' + trecho, r.status); if (!this.semEspera) await dormir(Math.min(8000 * t, 40000)); continue; }
      throw new ProvError(this.nome, r.status + ' ' + trecho, r.status);
    }
    throw ultimoErro || new ProvError(this.nome, 'falhou');
  }
  conta(i, o) { this.tokensIn += i || 0; this.tokensOut += o || 0; }
  resumo() { return this.nome + ' (' + this.modelo + '): ' + this.chamadas + ' chamadas, ' + this.tokensIn + ' tokens entrada, ' + this.tokensOut + ' saída' + (this.bloqueado ? ' [LIMITE DIÁRIO ATINGIDO]' : ''); }
}

export class Groq extends Provedor {
  constructor(o) { super({ nome: 'groq', base: 'https://api.groq.com', minIntervaloMs: 2600, ...o }); }
  async json({ system, user, max = 4000, temp = 0.6 }) {
    const corpo = { model: this.modelo, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: temp, max_completion_tokens: max, response_format: { type: 'json_object' } };
    if (this.esforco) corpo.reasoning_effort = this.esforco;
    else if (this.familia !== 'openai') corpo.reasoning_format = 'hidden'; // modelos que "pensam" (Qwen): não devolver o raciocínio no texto
    const chamar = c => this.http(this.base + '/openai/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + this.chave }, body: JSON.stringify(c) });
    const reserva = await this.reservar(Math.round((system.length + user.length) / 3.2 + 2300));
    let txt;
    for (const campo of ['', 'reasoning_format', 'reasoning_effort', 'response_format']) { // se a API recusar (400) um parâmetro opcional, tenta sem ele
      if (campo) delete corpo[campo];
      try { txt = await chamar(corpo); break; }
      catch (e) { if (!(e.status === 400 && campo !== 'response_format')) throw e; }
    }
    if (txt === undefined) throw new ProvError(this.nome, 'a API recusou o pedido (400) mesmo sem parâmetros opcionais', 400);
    const j = JSON.parse(txt), ch = j.choices && j.choices[0];
    this.conta(j.usage && j.usage.prompt_tokens, j.usage && j.usage.completion_tokens);
    if (reserva && j.usage) reserva.n = (j.usage.prompt_tokens || 0) + (j.usage.completion_tokens || 0);
    if (!ch || !ch.message || !ch.message.content) throw new ProvError(this.nome, 'resposta vazia (' + (ch && ch.finish_reason) + ')');
    if (ch.finish_reason === 'length') throw new ProvError(this.nome, 'resposta cortada (max tokens)');
    return extrairJson(ch.message.content);
  }
}

export class Gemini extends Provedor {
  /* modelos: lista em ordem de preferência; se o servidor disser que o modelo não existe ou não está mais disponível (404), passa ao próximo. */
  constructor(o) { super({ nome: 'gemini', base: 'https://generativelanguage.googleapis.com', minIntervaloMs: 7000, ...o }); this.modelos = o.modelos || [o.modelo]; this.modelo = this.modelos[0]; }
  async json({ system, user, max = 8192, temp = 0.1 }) {
    let ultimo;
    for (let i = this.modelos.indexOf(this.modelo); i < this.modelos.length; i++) {
      this.modelo = this.modelos[i];
      const corpo = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: temp, responseMimeType: 'application/json', maxOutputTokens: max } };
      try {
        const txt = await this.http(this.base + '/v1beta/models/' + this.modelo + ':generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': this.chave }, body: JSON.stringify(corpo) });
        const j = JSON.parse(txt);
        const c0 = j.candidates && j.candidates[0], u = j.usageMetadata || {};
        this.conta(u.promptTokenCount, (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0));
        if (!c0 || !c0.content || !c0.content.parts) throw new ProvError(this.nome, 'resposta vazia (' + (c0 && c0.finishReason || (j.promptFeedback && j.promptFeedback.blockReason) || '?') + ')');
        if (c0.finishReason === 'MAX_TOKENS') throw new ProvError(this.nome, 'resposta cortada (max tokens)');
        return extrairJson(c0.content.parts.filter(p => !p.thought).map(p => p.text || '').join(''));
      } catch (e) {
        if (e.quota) throw e;
        ultimo = e;
        if (e.status === 404 && i < this.modelos.length - 1) continue; // modelo indisponível: próximo da lista
        throw e;
      }
    }
    throw ultimo || new ProvError(this.nome, 'nenhum modelo disponível');
  }
}

export class Cloudflare extends Provedor {
  /* modelos: lista em ordem de preferência; só modelos fortes (evita auditor fraco). */
  constructor(o) { super({ nome: 'cloudflare', base: 'https://api.cloudflare.com', minIntervaloMs: 1500, ...o }); this.modelos = o.modelos || [o.modelo]; this.modelo = this.modelos[0]; }
  async json({ system, user, max = 3000, temp = 0.1 }) {
    let ultimo;
    for (let i = this.modelos.indexOf(this.modelo); i < this.modelos.length; i++) {
      this.modelo = this.modelos[i];
      const corpo = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: max, temperature: temp, response_format: { type: 'json_object' } };
      try {
        const chamar = c => this.http(this.base + '/client/v4/accounts/' + this.conta_id + '/ai/run/' + this.modelo, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + this.chave }, body: JSON.stringify(c) });
        let txt;
        try { txt = await chamar(corpo); }
        catch (e1) { if (e1.status === 400 && corpo.response_format && !/no route|not found/i.test(e1.message)) { delete corpo.response_format; txt = await chamar(corpo); } else throw e1; } // modelo sem "modo JSON": pede só no texto
        const j = JSON.parse(txt);
        if (j.success === false) { const msg = JSON.stringify(j.errors || j).slice(0, 300); if (DIARIO.test(msg)) { this.bloqueado = msg; throw new QuotaError(this.nome, msg); } throw new ProvError(this.nome, msg, 400); }
        const r = j.result || {}, u = r.usage || {};
        this.conta(u.prompt_tokens, u.completion_tokens);
        const resp = r.response != null ? r.response : (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content);
        if (resp && typeof resp === 'object') return resp;
        if (!resp) throw new ProvError(this.nome, 'resposta vazia');
        return extrairJson(resp);
      } catch (e) {
        if (e.quota) throw e;
        ultimo = e;
        if (e.status === 404 || (e.status === 400 && /model|no route|not found/i.test(e.message))) continue; // modelo indisponível: próximo da lista
        throw e;
      }
    }
    throw ultimo || new ProvError(this.nome, 'nenhum modelo disponível');
  }
}
