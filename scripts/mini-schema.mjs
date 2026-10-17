/* Mini-validador de JSON Schema (subconjunto usado em schemas/). Sem dependências. */
export function check(schema, value, path = '$') {
  const errs = [];
  const t = schema.type;
  const typeOk = { object: v => v && typeof v === 'object' && !Array.isArray(v), array: Array.isArray, string: v => typeof v === 'string', integer: Number.isInteger, boolean: v => typeof v === 'boolean' };
  if (t && !typeOk[t](value)) return [`${path}: tipo esperado ${t}`];
  if (t === 'string') {
    if (schema.minLength && value.length < schema.minLength) errs.push(`${path}: texto curto demais`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${path}: formato inválido`);
  }
  if (t === 'integer' && schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: menor que ${schema.minimum}`);
  if (t === 'array') {
    if (schema.minItems && value.length < schema.minItems) errs.push(`${path}: itens insuficientes`);
    if (schema.items) value.forEach((x, i) => errs.push(...check(schema.items, x, `${path}[${i}]`)));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${path}.${k}: obrigatório`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in value) errs.push(...check(s, value[k], `${path}.${k}`));
  }
  return errs;
}
