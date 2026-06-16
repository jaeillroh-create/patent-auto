/**
 * review-engine/adapters/runAgent.js
 * ─────────────────────────────────────────────────────────────
 * orchestrator.run 의 deps.runAgent 주입 구현 (T4) — spec §4, §13, §15, E-04/05/06.
 * kernel 미수정: orchestrator 는 runAgent 를 블랙박스로 호출(orchestrator.js:121,191)하고
 * 본 모듈이 그 자리에 실 LLM 토론을 끼운다.
 *
 * 책임:
 *  1. mode별 에이전트 선택 (discover=심사관 3인 병렬, recheck=Verdict 산출 에이전트).
 *  2. systemPrompt(.md) + state read-slice → transport 호출.
 *  3. 출력 JSON 파싱 → contracts/schemas 검증. 위반 시 1회 재시도 → 실패 시 SchemaEscalateError (E-04).
 *  4. transport 장애 시 fallbackProvider 1회 폴백 + 로그(E-05).
 *  5. 라운드 비용/지연 집계(§13) — agentOut.{cost,latencyMs,provider}.
 *  6. 심사관 0건이면 통과인정+경고(E-06) — 억지 issue 금지(T3 §7 정합).
 *
 * @module review-engine/adapters/runAgent
 */
import { SCHEMAS } from '../contracts/schemas/index.js';
import { validate } from './schemaValidate.js';
import { costOf } from './providerCatalog.js';
// T7 Core 추출: 모듈 불문 어댑터 — opinion 기본값 제거. agents 는 호출측(모듈)이 주입한다.

/** E-04: 스키마 위반(1회 재시도 후)으로 라운드를 ESCALATE 시키는 신호. */
export class SchemaEscalateError extends Error {
  constructor(agentId, errors) {
    super(`E-04 schema escalate: agent ${agentId} → ${errors.join('; ')}`);
    this.name = 'SchemaEscalateError';
    this.code = 'E-04';
    this.agentId = agentId;
    this.errors = errors;
  }
}

/** 코드펜스/잡텍스트에서 첫 균형 JSON 객체만 추출. */
export function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  // ```json ... ``` 펜스 제거
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

/** read 필드명 → state 슬라이스. spec text 는 컨텍스트 보호로 40000자 트림(LLM-eng 권고). */
function sliceForReads(state, reads, mode, issue) {
  const out = { mode };
  const has = (f) => reads.includes(f);
  if (has('claims')) out.claims = state.claims.map((c) => ({ id: c.id, no: c.no, type: c.type, kind: c.kind, anchorType: c.anchorType, status: c.status, text: c.text }));
  if (has('citedPrior')) out.citedPrior = state.citedPrior;
  if (has('spec')) out.spec = { sections: (state.spec?.sections || []).map((s) => ({ key: s.key, text: String(s.text || '').slice(0, 40000) })) };
  if (has('invention')) out.invention = state.invention;
  if (has('moduleContext')) out.moduleContext = state.moduleContext;
  if (has('issues')) out.issues = state.issues.filter((i) => i.status === 'open' || i.status === 'regression');
  if (has('patchPlans')) out.patchPlans = state.patchPlans;
  if (mode === 'recheck' && issue) out.targetIssue = { id: issue.id, type: issue.type, target: issue.target, description: issue.description };
  return out;
}

/** {기술분야} 슬롯 치환(domain_expert). */
function fillSlots(promptText, state) {
  const field = (state.invention && state.invention.field) || '(미지정 — claims/spec에서 추론)';
  return promptText.replace(/\{기술분야\}/g, field);
}

/** 단일 에이전트 1회 호출(파싱+검증까지). 실패 사유를 구조화 반환(throw 안 함). */
async function callOnce(agent, system, userPayload, transport, maxTokensOverride) {
  const r = await transport({ provider: agent.provider, model: agent.model, system, user: userPayload, maxTokens: maxTokensOverride || agent.maxTokens });
  const parsed = extractJson(r.text);
  const schemaId = agent.outputSchemaByMode[userPayloadMode(userPayload)];
  const schema = SCHEMAS[schemaId];
  if (!parsed) {
    // 잘림(stop_reason=max_tokens)과 빈/비정형 응답을 구분 — 잘림이면 재시도에서 maxTokens 상향(truncated 플래그).
    const truncated = r.stopReason === 'max_tokens';
    return { ok: false, truncated, errors: [truncated ? '출력 토큰 한도 초과(잘림) — maxTokens 부족' : 'JSON 파싱 실패(빈/비정형 응답)'], raw: r };
  }
  const v = validate(schema, parsed);
  return { ok: v.ok, errors: v.errors, data: parsed, raw: r, schemaId };
}
function userPayloadMode(userPayload) { try { return JSON.parse(userPayload).mode; } catch { return 'discover'; } }

/**
 * 한 에이전트 실행: 폴백(E-05) → 1회 재시도(E-04). 비용/지연 동반 반환.
 * @returns {Promise<{ id, role, data, cost, latencyMs, provider, model, warnings:string[] }>}
 * @throws {SchemaEscalateError} 재시도 후에도 스키마 위반(E-04)
 */
async function runOneAgent(agent, state, mode, issue, deps) {
  const promptRaw = await deps.loadPrompt(agent.systemPromptRef);
  const system = fillSlots(promptRaw, state);
  const payloadObj = sliceForReads(state, agent.reads, mode, issue);
  const userPayload = JSON.stringify(payloadObj);
  const warnings = [];

  // transport 폴백 래퍼(E-05): provider 장애 시 fallbackProvider 로 1회 교체.
  let activeProvider = agent.provider;
  const transport = async (call) => {
    try {
      return await deps.transport(call);
    } catch (e) {
      if (agent.fallbackProvider && call.provider === agent.provider) {
        warnings.push(`E-05 폴백: ${agent.provider}→${agent.fallbackProvider} (사유: ${e.code || e.message})`);
        deps.onEvent && deps.onEvent({ kind: 'provider_fallback', agent: agent.id, from: agent.provider, to: agent.fallbackProvider, reason: e.code || e.message });
        activeProvider = agent.fallbackProvider;
        return await deps.transport({ ...call, provider: agent.fallbackProvider, model: undefined });
      }
      throw e;
    }
  };

  // 1차 시도
  let res = await callOnce({ ...agent, provider: activeProvider }, system, userPayload, transport);
  // E-04: 위반 시 1회 재시도(스키마 위반 사유를 프롬프트에 덧대 강화)
  if (!res.ok) {
    warnings.push(`E-04 재시도: ${res.errors.slice(0, 3).join('; ')}`);
    // 진단 로깅: 잘림/빈응답 판별용(stopReason·출력토큰·응답길이). 다음 실패 시 즉시 원인 구분.
    deps.onEvent && deps.onEvent({ kind: 'schema_retry', agent: agent.id, errors: res.errors, truncated: !!res.truncated, stopReason: res.raw && res.raw.stopReason, ot: res.raw && res.raw.ot, textLen: ((res.raw && res.raw.text) || '').length });
    // 잘림이면 maxTokens 를 16000 으로 상향 재시도(같은 cap 무한 재실패 차단 → wall-clock 보호). gpt-4o(16384)·gemini(자기한도 clamp)·claude 모두 안전.
    const retryMax = res.truncated ? 16000 : (agent.maxTokens || 4096);
    const retryPayload = JSON.stringify({ ...payloadObj, _schemaViolation: res.errors, _instruction: '직전 출력이 스키마를 위반했다. 지정 JSON 스키마를 엄격히 준수하여 순수 JSON만 다시 출력하라. 핵심 issue 위주로 간결히 작성해 토큰 한도 내에 JSON 을 반드시 완결하라.' });
    res = await callOnce({ ...agent, provider: activeProvider }, system, retryPayload, transport, retryMax);
    if (!res.ok) throw new SchemaEscalateError(agent.id, res.errors);
  }

  const { it = 0, ot = 0, latencyMs = 0 } = res.raw || {};
  const cost = costOf(activeProvider, activeProvider === agent.provider ? agent.model : undefined, it, ot);
  return { id: agent.id, role: agent.role, data: res.data, cost, latencyMs, provider: activeProvider, model: res.raw?.model, it, ot, warnings, schemaId: res.schemaId };
}

/** mode별 발화 에이전트 선택. */
function selectAgents(agents, mode, opts) {
  if (mode === 'discover') {
    // R1: 심사관 3인(병렬). spec §13. expert 포함 옵션.
    return agents.filter((a) => a.role === 'examiner' && a.outputSchemaByMode.discover === 'IssueList')
      .concat(opts.includeExpertInDiscover ? agents.filter((a) => a.role === 'domain_expert') : []);
  }
  // recheck: Verdict 산출 에이전트(심사관 recheck + reviewer + expert).
  if (mode === 'rebut') {
    // ★ AC-T3a: 출원인측 변리사(RebuttalSet 산출자)만 — outputSchema 값으로 선택(agent.id 분기 0, I-6).
    return agents.filter((a) => a.outputSchemaByMode && a.outputSchemaByMode.discover === 'RebuttalSet');
  }
  return agents.filter((a) => a.outputSchemaByMode && a.outputSchemaByMode.recheck === 'Verdict' && a.mode !== 'discover');
}

/**
 * makeRunAgent — orchestrator 에 주입할 runAgent 생성.
 * @param {{
 *   transport: (call:{provider,model,system,user,maxTokens})=>Promise<{text,it,ot,stopReason,latencyMs,provider,model}>,
 *   loadPrompt: (ref:string)=>Promise<string>,
 *   agents?: Array, includeExpertInDiscover?: boolean,
 *   onEvent?: (ev:Object)=>void
 * }} deps
 * @returns {(args:{mode:string, state:Object, issue?:Object})=>Promise<Object>}  agentOut
 */
// ※ 후속(이번 범위 밖): truncation(maxTokens 상향)·1인 실패 격리(allSettled)는 examiner_B 케이스를 해결하나,
//   discover 3인 + recheck 다라운드의 실 LLM 호출 누적은 여전히 단일 Edge 동기 호출의 wall-clock 한계에 걸릴 수
//   있다. 장기적으로는 트리거·구독 기반 비동기/백그라운드 실행(spec §14)으로 전환 필요.
export function makeRunAgent(deps) {
  if (!deps || typeof deps.transport !== 'function') throw new Error('makeRunAgent: deps.transport (function) required');
  if (typeof deps.loadPrompt !== 'function') throw new Error('makeRunAgent: deps.loadPrompt (function) required');
  // I-6: 모듈 불문. agents 는 호출측(profile/module)이 주입한다(opinion 기본값 없음).
  const agents = deps.agents;
  if (!Array.isArray(agents) || agents.length === 0) throw new Error('makeRunAgent: deps.agents (비어있지 않은 배열) 필수 — 모듈 agents 주입');
  const opts = { includeExpertInDiscover: !!deps.includeExpertInDiscover };

  return async function runAgent({ mode, state, issue }) {
    const selected = selectAgents(agents, mode, opts);
    // 병렬 호출(§13: 라운드1 심사관 3인 병렬). ★ graceful: allSettled 로 1인 schema 실패가 라운드 전체를
    //   죽이지 않게 격리(살아남은 에이전트로 진행). 단조성·수렴 판단(kernel)은 불변 — 더 적은 issue 집합을 받을 뿐.
    const settled = await Promise.allSettled(selected.map((a) => runOneAgent(a, state, mode, issue, deps)));
    const results = [];
    const failed = [];
    settled.forEach((s, i) => {
      if (s.status === 'fulfilled') { results.push(s.value); return; }
      const a = selected[i];
      const errs = (s.reason && s.reason.errors) || [String((s.reason && s.reason.message) || s.reason)];
      failed.push({ id: a.id, errors: errs });
      deps.onEvent && deps.onEvent({ kind: 'agent_failed', agent: a.id, errors: errs }); // 격리: 실패 에이전트만 제외
    });
    // ★ AC-T3a: rebut(보정 방향 enrichment)는 빈 선택/전원 실패여도 무해 통과(throw 금지) — 검증 전체를 죽이지 않음.
    if (mode === 'rebut' && results.length === 0) {
      return { rebuttals: [], provider: '', cost: 0, latencyMs: 0, perAgent: [], warnings: failed.map((f) => `${f.id}: rebut 실패 격리`) };
    }
    // ★ 전원 실패(discover/recheck) → 빈 리뷰 묵인 방지: 원래 실패(SchemaEscalateError 등)를 재throw → 핸들러가 ESCALATED(200) 처리.
    if (results.length === 0) {
      const firstRej = settled.find((s) => s.status === 'rejected');
      throw (firstRej && firstRej.reason) || new Error('모든 에이전트 실패');
    }

    const cost = results.reduce((s, r) => s + (r.cost || 0), 0);
    const latencyMs = results.reduce((m, r) => Math.max(m, r.latencyMs || 0), 0);
    const providerLabel = results.map((r) => `${r.id}:${r.provider}`).join(',');
    const warnings = results.flatMap((r) => (r.warnings || []).map((w) => `${r.id}: ${w}`))
      .concat(failed.map((f) => `${f.id}: 실패 격리(${f.errors.slice(0, 2).join('; ')})`)); // 격리된 실패도 결과에 노출
    const perAgent = results.map((r) => ({ id: r.id, provider: r.provider, model: r.model, cost: r.cost, latencyMs: r.latencyMs, it: r.it, ot: r.ot }));

    if (mode === 'discover') {
      // issue 집계 + raisedBy/id 보정.
      const issues = [];
      for (const r of results) {
        const list = (r.data && Array.isArray(r.data.issues)) ? r.data.issues : [];
        list.forEach((raw, i) => issues.push({ raisedBy: r.id, id: raw.id || `${r.id}-${i + 1}`, ...raw }));
      }
      const consensus = {};
      // E-06: 심사관 전수 검토했으나 0건 → 통과인정 + 경고(억지 issue 금지, T3 §7).
      const examinerResults = results.filter((r) => r.role === 'examiner');
      if (examinerResults.length && issues.filter((it) => examinerResults.some((er) => er.id === it.raisedBy)).length === 0) {
        consensus.examiner = true;
        warnings.push('E-06: 심사관 전원 0건 — 통과인정 + 경고(억지 issue 금지)');
        deps.onEvent && deps.onEvent({ kind: 'zero_issue_pass', agents: examinerResults.map((r) => r.id) });
      }
      return { issues, consensus, provider: providerLabel, cost, latencyMs, perAgent, warnings };
    }

    if (mode === 'rebut') {
      // ★ AC-T3a: 보정 방향 집계(RebuttalSet). issue별 amendmentDirection 을 orchestrator 가 issueId 로 병합.
      const rebuttals = [];
      for (const r of results) {
        const list = (r.data && Array.isArray(r.data.rebuttals)) ? r.data.rebuttals : [];
        list.forEach((rb) => rebuttals.push({ raisedBy: r.id, ...rb }));
      }
      return { rebuttals, provider: providerLabel, cost, latencyMs, perAgent, warnings };
    }

    // recheck: verdict 집계.
    const verdicts = [];
    for (const r of results) {
      const list = (r.data && Array.isArray(r.data.verdicts)) ? r.data.verdicts : [];
      list.forEach((v) => verdicts.push({ raisedBy: r.id, ...v }));
    }
    return { verdicts, provider: providerLabel, cost, latencyMs, perAgent, warnings };
  };
}

export default { makeRunAgent, SchemaEscalateError, extractJson };
