/**
 * review-engine/adapters/providerTransport.js
 * ─────────────────────────────────────────────────────────────
 * 순수 멀티프로바이더 transport — shared/common.js:134-144 (buildAPIRequest/parseAPIResponse) 미러.
 * 브라우저/Node/Deno 공용(fetch만 의존). 에이전트별로 다른 provider/model 을 호출할 수 있다
 * (common.js callClaude 는 '선택된 1개' 프로바이더만 호출하므로 멀티에이전트엔 부적합).
 *
 * 반환은 runAgent 가 비용·지연을 집계할 수 있도록 토큰수·지연까지 통일한다.
 *   { text, stopReason, it, ot, latencyMs, provider, model }
 *
 * @module review-engine/adapters/providerTransport
 */
import { resolveModel } from './providerCatalog.js';

/** common.js:134-139 미러 — 프로바이더별 요청 객체. */
export function buildRequest(provider, model, system, user, maxTokens, apiKey) {
  const m = resolveModel(provider, model);
  if (provider === 'claude') {
    return {
      url: m.endpoint,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: m.id, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] },
    };
  }
  if (provider === 'gpt') {
    return {
      url: m.endpoint,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: { model: m.id, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] },
    };
  }
  if (provider === 'gemini') {
    return {
      url: `${m.endpoint}${m.id}:generateContent?key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      body: { systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: maxTokens } },
    };
  }
  throw new Error(`providerTransport: unknown provider '${provider}'`);
}

/** common.js:140-144 미러 — 프로바이더별 응답 → {text, stopReason, it, ot}. */
export function parseResponse(provider, d) {
  if (provider === 'claude') {
    if (d.error) throw new Error(d.error.message || 'claude error');
    return { text: d.content?.[0]?.text || '', stopReason: d.stop_reason, it: d.usage?.input_tokens || 0, ot: d.usage?.output_tokens || 0 };
  }
  if (provider === 'gpt') {
    if (d.error) throw new Error(d.error.message || 'gpt error');
    const c = d.choices?.[0];
    return { text: c?.message?.content || '', stopReason: c?.finish_reason === 'length' ? 'max_tokens' : c?.finish_reason, it: d.usage?.prompt_tokens || 0, ot: d.usage?.completion_tokens || 0 };
  }
  if (provider === 'gemini') {
    if (d.error) throw new Error(d.error.message || d.error.status || 'gemini error');
    const c = d.candidates?.[0];
    if (!c) throw new Error('gemini: 빈 응답');
    return { text: c.content?.parts?.[0]?.text || '', stopReason: c.finishReason === 'MAX_TOKENS' ? 'max_tokens' : c.finishReason, it: d.usageMetadata?.promptTokenCount || 0, ot: d.usageMetadata?.candidatesTokenCount || 0 };
  }
  throw new Error(`providerTransport: unknown provider '${provider}'`);
}

/**
 * makeHttpTransport — 실 LLM 호출 transport 생성.
 * @param {{ resolveKey:(provider:string)=>string, fetchImpl?:Function, timeoutMs?:number }} opts
 *   resolveKey: provider → apiKey (env/secret 해석은 호출측 책임)
 * @returns {(call:{provider,model,system,user,maxTokens})=>Promise<{text,stopReason,it,ot,latencyMs,provider,model}>}
 */
export function makeHttpTransport(opts) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 180000;
  if (typeof fetchImpl !== 'function') throw new Error('providerTransport: no fetch available');
  return async function call({ provider, model, system, user, maxTokens }) {
    const apiKey = opts.resolveKey(provider);
    if (!apiKey) {
      const err = new Error(`providerTransport: no API key for '${provider}'`);
      err.code = 'NO_KEY';
      throw err;
    }
    const req = buildRequest(provider, model, system, user, maxTokens || 4096, apiKey);
    const ctrl = new AbortController();
    const tout = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const res = await fetchImpl(req.url, { method: 'POST', signal: ctrl.signal, headers: req.headers, body: JSON.stringify(req.body) });
      clearTimeout(tout);
      if (res.status === 401 || res.status === 403) { const e = new Error(`${provider}: API Key 무효(${res.status})`); e.code = 'AUTH'; throw e; }
      if (res.status === 429) { const e = new Error(`${provider}: 요청 과다(429)`); e.code = 'RATE'; throw e; }
      if (res.status >= 500) { const e = new Error(`${provider}: 서버 오류(${res.status})`); e.code = 'SERVER'; throw e; }
      const d = await res.json();
      const parsed = parseResponse(provider, d);
      return { ...parsed, latencyMs: Date.now() - t0, provider, model: resolveModel(provider, model).id };
    } catch (e) {
      clearTimeout(tout);
      if (e.name === 'AbortError') { const er = new Error(`${provider}: 타임아웃`); er.code = 'TIMEOUT'; throw er; }
      throw e;
    }
  };
}

export default { buildRequest, parseResponse, makeHttpTransport };
