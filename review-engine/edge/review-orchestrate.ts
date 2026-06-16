/**
 * review-engine/edge/review-orchestrate.ts
 * ─────────────────────────────────────────────────────────────
 * Supabase Edge Function (Deno) — 리뷰 엔진 오케스트레이션 진입점 (T4, spec §4/§13/§14).
 * 클라이언트는 "트리거·구독"만 한다(긴 토론은 서버에서 — 브라우저 탭 종료/타임아웃 회피).
 *
 * 흐름:
 *   1) 요청 검증(인증 헤더·caseId) — 입력은 데이터일 뿐(E-29는 에이전트 프롬프트가 방어).
 *   2) WriterSnapshot 로드 → OpinionProfile.adaptSnapshot → ReviewState.
 *   3) Deno.env 시크릿으로 멀티프로바이더 transport 구성.
 *   4) makeRunAgent 주입 → orchestrator.run(profile, state, { runAgent }).
 *   5) SchemaEscalateError(E-04) catch → phase=ESCALATED + 전이로그(§15 알림).
 *   6) rounds/issues/transitions 영속(T6 writer 연동 시 활성화) + 요약 반환.
 *
 * ⚠️ T4 범위: 핸들러 골격 + 배선. 실제 DB 영속/배포 호출은 T6(writer.exportSnapshot/applyAmendments)와
 *   함께 마무리되므로 아래 persist()는 의도적으로 스텁(주석)으로 둔다. kernel/ 미수정.
 *
 * @module review-engine/edge/review-orchestrate
 */
// Deno/Edge 런타임 import (배포 시 import map 또는 상대경로 번들).
import { run as orchestrate } from '../kernel/orchestrator.js';
import { PROFILES } from '../profiles/registry.js';
import { makeRunAgent, SchemaEscalateError } from '../adapters/runAgent.js';
import { makeHttpTransport } from '../adapters/providerTransport.js';
import { ENV_KEYS } from '../adapters/providerCatalog.js';
import { PHASE } from '../contracts/stateSchema.js';

// deno-lint-ignore no-explicit-any
declare const Deno: any;

/** env/secret 에서 provider별 키 해석(첫 매칭). */
function resolveKey(provider: string): string {
  const candidates = (ENV_KEYS as Record<string, string[]>)[provider] || [];
  for (const name of candidates) {
    const v = Deno?.env?.get?.(name);
    if (v) return v;
  }
  return '';
}

/** systemPromptRef(.md) 로드 — Edge 번들에서는 정적 자산/KV. 여기서는 fetch 기반 로더. */
async function loadPrompt(ref: string): Promise<string> {
  // 배포 시: Supabase Storage 또는 번들 자산에서 ref(.claude/rules/agents/...) 로드.
  const base = Deno?.env?.get?.('PROMPT_BASE_URL') || '';
  const res = await fetch(`${base}/${ref}`);
  if (!res.ok) throw new Error(`loadPrompt: ${ref} (${res.status})`);
  return await res.text();
}

/** 오케스트레이션 1회 → 영속·응답용 결과. E-04 escalate 는 정상 종료(done/escalated). ⚠️ payload 에 키 미포함(보안). */
async function computeReview(profile: any, state: any, runAgent: any): Promise<{ status: string; phase?: string; payload: any; httpStatus: number; error?: string }> {
  try {
    const result: any = await orchestrate(profile, state, { runAgent });
    const payload = { reviewId: result.reviewId, phase: result.phase, issues: result.issues, patchPlans: result.patchPlans, consensus: result.consensus, rounds: result.rounds, transitions: result.transitions, budget: result.budget };
    return { status: 'done', phase: result.phase, payload, httpStatus: 200 };
  } catch (e: any) {
    if (e instanceof SchemaEscalateError) {
      state.phase = PHASE.ESCALATED;
      state.transitions = state.transitions || [];
      state.transitions.push({ ts: Date.now(), round: state.budget?.roundsUsed ?? 0, kind: 'engine', to: PHASE.ESCALATED, actor: 'engine', note: `E-04 schema escalate: ${e.agentId} → ${(e.errors || []).join('; ')}` });
      console.error('[review-engine] E-04 ESCALATE', e.agentId, e.errors); // §15 알림(키 미포함)
      const payload = { reviewId: state.reviewId, phase: state.phase, escalated: true, reason: 'E-04', agent: e.agentId, errors: e.errors, transitions: state.transitions };
      return { status: 'done', phase: 'escalated', payload, httpStatus: 200 };
    }
    console.error('[review-engine] fatal', e);
    return { status: 'failed', error: String(e?.message || e), payload: { error: 'internal', detail: String(e?.message || e) }, httpStatus: 500 };
  }
}

/** review_runs 행 영속(service_role, RLS 우회) — PostgREST PATCH. createClient import 없이 fetch 재사용(Node 안전).
 *  SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 는 Supabase Edge 자동주입(신규 시크릿 0). ⚠️ patch 에 키 미포함. */
async function persistRun(reviewRunId: string, patch: Record<string, unknown>): Promise<void> {
  const url = Deno?.env?.get?.('SUPABASE_URL');
  const key = Deno?.env?.get?.('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) { console.error('[review-engine] persist skip — SUPABASE_URL/SERVICE_ROLE_KEY 미주입'); return; }
  try {
    const res = await fetch(`${url}/rest/v1/review_runs?id=eq.${encodeURIComponent(reviewRunId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) console.error('[review-engine] persist PATCH 실패', res.status); // 본문(키 가능성) 미로깅
  } catch (e: any) { console.error('[review-engine] persist 오류', String(e?.message || e)); }
}

/** Edge 엔트리. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // 1) 인증·입력 검증 (Supabase JWT 검증은 게이트웨이/RLS와 병행).
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const snapshot = body?.snapshot;
  const selfReview = body?.selfReviewLog || null;
  if (!snapshot) return json({ error: 'snapshot required' }, 400);

  // 1b) 모듈 → 프로필 선택 (G9). ★ I-6: PROFILES[module] 데이터-키 조회(문자열 분기 금지).
  //     module 미지정 시 opinion 기본(후방호환 — opinion 클라가 module 을 보내지 않던 시절 지원).
  const moduleName = body?.module || 'opinion';
  const entry = PROFILES[moduleName as keyof typeof PROFILES];
  if (!entry) return json({ error: 'unknown module', module: moduleName }, 400);
  const baseProfile = entry.profile;

  // 2) adaptSnapshot → ReviewState
  const state = baseProfile.adaptSnapshot(snapshot, selfReview, {
    terminationPolicy: baseProfile.terminationPolicy,
    reviewId: body?.reviewId,
    caseId: body?.caseId,
  });

  // 3) transport (멀티프로바이더). ★ L-T4: 사용자 키(body.keys) 우선, 없으면 env(ENV_KEYS) 폴백(후방호환).
  //    ⚠️ 보안: body.keys/반환 키는 절대 로깅하지 않는다(키 노출 0). 핸들러 인증(Bearer)·CORS 는 불변.
  const bodyKeys: Record<string, string> = (body?.keys && typeof body.keys === 'object') ? body.keys : {};
  const resolveKeyReq = (provider: string): string => {
    const k = bodyKeys[provider];
    if (k && typeof k === 'string') return k;   // body.keys 우선(사용자 키)
    return resolveKey(provider);                 // env 폴백
  };
  const transport = makeHttpTransport({ resolveKey: resolveKeyReq, fetchImpl: fetch });

  // 3b) ★ L-T4: 역할배정 override — body.assignments[agent.id] 데이터-키 조회(I-6, 문자열 분기 금지).
  //     assignments 없으면 원본 agents 그대로(후방호환). frozen 원본 불변(얕은 복사로 provider 만 교체).
  const assignments: Record<string, string> | null =
    (body?.assignments && typeof body.assignments === 'object') ? body.assignments : null;
  const agents = assignments
    ? entry.agents.map((a: any) => {
        const p = assignments[a.id];
        return (p && typeof p === 'string') ? { ...a, provider: p } : a;
      })
    : entry.agents;

  // 4) runAgent 주입
  const runAgent = makeRunAgent({
    transport,
    loadPrompt,
    agents, // I-6: 선택된 모듈 agents(역할배정 override 반영) 명시 주입
    onEvent: (ev: any) => console.log('[review-engine event]', JSON.stringify(ev)), // §15 관측(키 미포함)
  });

  // 4b) 엔진-side writer 주입(요청별 state 클로저) — 단조성 simulate 의 구조적 정합성 산출.
  //     실(實)반영은 브라우저 측 applyAmendments 가 담당(클라, 사람 승인분만).
  const profile = { ...baseProfile, writer: entry.makeEngineWriter(() => state) };

  // 5) ★ dual-mode(B-T2): reviewRunId 있으면 비동기(202 + EdgeRuntime.waitUntil → service_role persist),
  //    없으면 기존 동기 200(후방호환 — reviewRunId 안 보내던 클라 안 깨짐). kernel 불변 — 경계에서 분기.
  const reviewRunId = body?.reviewRunId;
  if (reviewRunId && typeof reviewRunId === 'string') {
    const bg = (async () => {
      const r = await computeReview(profile, state, runAgent);
      const patch = r.status === 'failed'
        ? { status: 'failed', error: r.error }
        : { status: 'done', phase: r.phase, result: r.payload }; // result 는 키 미포함(computeReview)
      await persistRun(reviewRunId, patch);
    })();
    const ER: any = (globalThis as any).EdgeRuntime;
    if (ER && typeof ER.waitUntil === 'function') ER.waitUntil(bg); // 응답 후 worker 유지(백그라운드 완주)
    else bg.catch((e: any) => console.error('[review-engine] bg(no waitUntil)', String(e?.message || e))); // 비-Deno 폴백: fire-and-forget
    return json({ reviewRunId, status: 'running' }, 202); // 즉시 반환(504 해소) — 클라는 review_runs 폴링(B-T3)
  }
  // 동기(후방호환): reviewRunId 미전송 클라 → 기존대로 결과 반환(200, escalate 200, 내부오류 500).
  const r = await computeReview(profile, state, runAgent);
  return json(r.payload, r.httpStatus);
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
