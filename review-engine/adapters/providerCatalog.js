/**
 * review-engine/adapters/providerCatalog.js
 * ─────────────────────────────────────────────────────────────
 * 멀티프로바이더 카탈로그 — shared/common.js:15-43 (API_PROVIDERS) 의 미러.
 * 브라우저 전용 common.js(window/localStorage 의존)를 서버(Node/Deno)에서 import 할 수 없으므로,
 * 엔드포인트·모델·비용(원가)만 순수 데이터로 복제한다. **요청/응답 스키마는 common.js와 1:1 동일.**
 * 값이 바뀌면 common.js:15-43 과 동기화할 것(단일 진실원천은 common.js).
 *
 * @module review-engine/adapters/providerCatalog
 */

/** common.js:15-43 미러. inputCost/outputCost 단위 = USD per 1M tokens. */
export const PROVIDERS = Object.freeze({
  claude: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: {
      sonnet: { id: 'claude-sonnet-4-6', inputCost: 3, outputCost: 15 },
      opus: { id: 'claude-opus-4-8', inputCost: 5, outputCost: 25 },
    },
    defaultModel: 'sonnet',
  },
  gpt: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: {
      gpt4o_mini: { id: 'gpt-4o-mini', inputCost: 0.15, outputCost: 0.6 },
      gpt4o: { id: 'gpt-4o', inputCost: 2.5, outputCost: 10 },
    },
    defaultModel: 'gpt4o',
  },
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
    models: {
      gemini_flash: { id: 'gemini-2.0-flash', inputCost: 0.1, outputCost: 0.4 },
      gemini_pro: { id: 'gemini-2.5-pro-preview-06-05', inputCost: 1.25, outputCost: 10 },
    },
    defaultModel: 'gemini_pro',
  },
});

/** 프로바이더 환경변수 키 후보(데모/Edge에서 시크릿 해석용). */
export const ENV_KEYS = Object.freeze({
  claude: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  gpt: ['OPENAI_API_KEY', 'GPT_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
});

/** modelKey(또는 미지정 시 defaultModel)에 대한 모델 메타 반환. */
export function resolveModel(provider, modelKey) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`providerCatalog: unknown provider '${provider}'`);
  const key = modelKey && p.models[modelKey] ? modelKey : p.defaultModel;
  return { key, ...p.models[key], endpoint: p.endpoint };
}

/**
 * 토큰 사용량 → 비용(USD). common.js:295 식과 동일:
 *   cost = it*inputCost/1e6 + ot*outputCost/1e6
 */
export function costOf(provider, modelKey, it, ot) {
  const m = resolveModel(provider, modelKey);
  return (it * m.inputCost) / 1e6 + (ot * m.outputCost) / 1e6;
}

export default { PROVIDERS, ENV_KEYS, resolveModel, costOf };
