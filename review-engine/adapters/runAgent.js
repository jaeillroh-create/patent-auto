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
import { OPINION_AGENTS } from '../profiles/opinion/agents/index.js';

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
async function callOnce(agent, system, userPayload, transport) {
  const r = await transport({ provider: agent.provider, model: agent.model, system, user: userPayload, maxTokens: agent.maxTokens });
  const parsed = extractJson(r.text);
  const schemaId = agent.outputSchemaByMode[userPayloadMode(userPayload)];
  const schema = SCHEMAS[schemaId];
  if (!parsed) return { ok: false, errors: ['JSON 파싱 실패(빈/비정형 응답)'], raw: r };
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
    deps.onEvent && deps.onEvent({ kind: 'schema_retry', agent: agent.id, errors: res.errors });
    const retryPayload = JSON.stringify({ ...payloadObj, _schemaViolation: res.errors, _instruction: '직전 출력이 스키마를 위반했다. 지정 JSON 스키마를 엄격히 준수하여 순수 JSON만 다시 출력하라.' });
    res = await callOnce({ ...agent, provider: activeProvider }, system, retryPayload, transport);
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
export function makeRunAgent(deps) {
  if (!deps || typeof deps.transport !== 'function') throw new Error('makeRunAgent: deps.transport (function) required');
  if (typeof deps.loadPrompt !== 'function') throw new Error('makeRunAgent: deps.loadPrompt (function) required');
  const agents = deps.agents || OPINION_AGENTS;
  const opts = { includeExpertInDiscover: !!deps.includeExpertInDiscover };

  return async function runAgent({ mode, state, issue }) {
    const selected = selectAgents(agents, mode, opts);
    // 병렬 호출(§13: 라운드1 심사관 3인 병렬). 지연 = max, 비용 = Σ.
    const results = await Promise.all(selected.map((a) => runOneAgent(a, state, mode, issue, deps)));

    const cost = results.reduce((s, r) => s + (r.cost || 0), 0);
    const latencyMs = results.reduce((m, r) => Math.max(m, r.latencyMs || 0), 0);
    const providerLabel = results.map((r) => `${r.id}:${r.provider}`).join(',');
    const warnings = results.flatMap((r) => (r.warnings || []).map((w) => `${r.id}: ${w}`));
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
