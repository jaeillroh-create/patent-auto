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
import OpinionProfile from '../profiles/opinion/OpinionProfile.js';
import { makeEngineWriter } from '../profiles/opinion/writerAdapter.js';
import { OPINION_AGENTS } from '../profiles/opinion/agents/index.js';
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

  // 2) adaptSnapshot → ReviewState
  const state = OpinionProfile.adaptSnapshot(snapshot, selfReview, {
    terminationPolicy: OpinionProfile.terminationPolicy,
    reviewId: body?.reviewId,
    caseId: body?.caseId,
  });

  // 3) transport (멀티프로바이더, env 시크릿)
  const transport = makeHttpTransport({ resolveKey, fetchImpl: fetch });

  // 4) runAgent 주입
  const runAgent = makeRunAgent({
    transport,
    loadPrompt,
    agents: OPINION_AGENTS, // I-6: 모듈 agents 명시 주입(어댑터에 opinion 기본값 없음)
    onEvent: (ev: any) => console.log('[review-engine event]', JSON.stringify(ev)), // §15 관측
  });

  // 4b) 엔진-side writer 주입(요청별 state 클로저) — 단조성 simulate 의 구조적 정합성 산출.
  //     실(實)반영은 브라우저 Opinion.applyAmendments 가 담당(opinion.js, 사람 승인분만).
  const profile = { ...OpinionProfile, writer: makeEngineWriter(() => state) };

  // 5) 오케스트레이션 + E-04 escalate 처리(kernel 불변 → 경계에서 catch)
  try {
    const result = await orchestrate(profile, state, { runAgent });
    // 6) await persist(result);  // ← T6 writer 연동 시 활성화 (rounds/issues/transitions append-only)
    // patchPlans·consensus 포함(B1): Human Gate 가 승인할 보정안 + 합의 신호를 클라가 받는다.
    return json({ reviewId: result.reviewId, phase: result.phase, issues: result.issues, patchPlans: result.patchPlans, consensus: result.consensus, rounds: result.rounds, transitions: result.transitions, budget: result.budget }, 200);
  } catch (e) {
    if (e instanceof SchemaEscalateError) {
      state.phase = PHASE.ESCALATED;
      state.transitions = state.transitions || [];
      state.transitions.push({ ts: Date.now(), round: state.budget?.roundsUsed ?? 0, kind: 'engine', to: PHASE.ESCALATED, actor: 'engine', note: `E-04 schema escalate: ${e.agentId} → ${(e.errors || []).join('; ')}` });
      console.error('[review-engine] E-04 ESCALATE', e.agentId, e.errors); // §15 알림
      // await persist(state);
      return json({ reviewId: state.reviewId, phase: state.phase, escalated: true, reason: 'E-04', agent: e.agentId, errors: e.errors, transitions: state.transitions }, 200);
    }
    console.error('[review-engine] fatal', e);
    return json({ error: 'internal', detail: String(e?.message || e) }, 500);
  }
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
