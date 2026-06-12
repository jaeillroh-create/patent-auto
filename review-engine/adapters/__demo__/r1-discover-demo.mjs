/**
 * review-engine/adapters/__demo__/r1-discover-demo.mjs
 * ─────────────────────────────────────────────────────────────
 * T4 DoD 검증 하니스. 실행:
 *   ANTHROPIC_API_KEY=... node review-engine/adapters/__demo__/r1-discover-demo.mjs
 *
 * 증명 항목(DoD):
 *   [Part 1] 실 LLM R1 discover — 심사관 3인 병렬 전수 issue 발굴 (실 출력).
 *   [Part 2] orchestrator ↔ runAgent 통합 + 라운드 비용/지연 로그(§13/§15), 종료 보장.
 *   [Part 3] 결정적 stub 으로 E-04(스키마위반→재시도→ESCALATE), E-05(폴백+로그), E-06(0건→통과+경고).
 *
 * 주의: 키가 1개(Claude)만 제공되면 Part1/2 는 전 에이전트를 Claude 로 라우팅(편향상쇄 다모델은 키 부재로 우회).
 * @module review-engine/adapters/__demo__/r1-discover-demo
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as orchestrate } from '../../kernel/orchestrator.js';
import OpinionProfile from '../../profiles/opinion/OpinionProfile.js';
import { OPINION_AGENTS } from '../../profiles/opinion/agents/index.js';
import { makeRunAgent, SchemaEscalateError } from '../runAgent.js';
import { makeHttpTransport } from '../providerTransport.js';
import { sampleOpinionCase } from './sample-opinion-case.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const loadPrompt = (ref) => readFile(path.join(REPO_ROOT, ref), 'utf8');
const log = (...a) => console.log(...a);
const hr = (t) => log('\n' + '═'.repeat(70) + '\n' + t + '\n' + '═'.repeat(70));

/** 키가 1개만 있을 때: 전 에이전트를 해당 프로바이더로 라우팅한 정의 복제. */
function routeAllTo(agents, provider, model) {
  return agents.map((a) => ({ ...a, provider, model, fallbackProvider: provider }));
}

async function part1_liveDiscover(state) {
  hr('[Part 1] 실 LLM R1 discover — 심사관 3인 병렬 전수 발굴');
  const transport = makeHttpTransport({ resolveKey: () => process.env.ANTHROPIC_API_KEY, fetchImpl: fetch });
  const agents = routeAllTo(OPINION_AGENTS, 'claude', 'sonnet');
  const runAgent = makeRunAgent({ transport, loadPrompt, agents, onEvent: (e) => log('  · event:', JSON.stringify(e)) });

  const t0 = Date.now();
  const out = await runAgent({ mode: 'discover', state });
  log(`\n발굴 issue 총 ${out.issues.length}건 · 집계비용 $${out.cost.toFixed(5)} · 지연(max) ${out.latencyMs}ms · 벽시계 ${Date.now() - t0}ms`);
  log('per-agent:', JSON.stringify(out.perAgent, null, 0));
  if (out.warnings.length) log('warnings:', out.warnings);
  for (const it of out.issues) {
    log(`\n  ▸ [${it.raisedBy}] ${it.severity}/${it.legalBasis} ${it.type} → ${(it.target || []).join(',')}`);
    log(`    ${it.description}`);
  }
  return out;
}

async function part2_orchestratorWiring(state) {
  hr('[Part 2] orchestrator ↔ runAgent 통합 + 라운드 비용/지연 로그(§13/§15)');
  const transport = makeHttpTransport({ resolveKey: () => process.env.ANTHROPIC_API_KEY, fetchImpl: fetch });
  const agents = routeAllTo(OPINION_AGENTS, 'claude', 'sonnet');
  const runAgent = makeRunAgent({ transport, loadPrompt, agents });
  // maxRounds=1: R1 후 convergence L3 로 즉시 종료(writer 미호출 → applyAmendments 없음, T6 전까지 안전).
  const profile = { ...OpinionProfile, terminationPolicy: { ...OpinionProfile.terminationPolicy, maxRounds: 1 } };
  const result = await orchestrate(profile, state, { runAgent });
  log(`\nphase=${result.phase} · issues=${result.issues.length} · roundsUsed=${result.budget.roundsUsed} · spent=$${result.budget.spentUsd.toFixed(5)}`);
  log('rounds[] (비용·지연 기록):');
  for (const r of result.rounds) log(`  · R${r.n} ${r.mode} agent=${r.agent} provider=${r.provider} cost=$${(r.cost || 0).toFixed(5)} latency=${r.latencyMs}ms issues=${r.output?.issueCount ?? '-'}`);
  log('transitions[]:', result.transitions.map((t) => `${t.to}(${t.note || ''})`).join(' | '));
  return result;
}

// ── Part 3: 결정적 stub transport 로 오류 경로 증명 ──
function stubTransport(handler) {
  return async (call) => ({ text: handler(call), stopReason: 'end', it: 500, ot: 200, latencyMs: 5, provider: call.provider, model: call.model || 'stub' });
}

async function part3_errorPaths(state) {
  hr('[Part 3] 결정적 stub — E-04 / E-05 / E-06');

  // E-06: 모든 심사관 0건 → 통과인정 + 경고
  {
    const runAgent = makeRunAgent({ transport: stubTransport(() => '{"issues": []}'), loadPrompt, onEvent: (e) => log('  · event:', JSON.stringify(e)) });
    const out = await runAgent({ mode: 'discover', state });
    log(`\nE-06 → issues=${out.issues.length}, consensus.examiner=${out.consensus.examiner}, warnings=${JSON.stringify(out.warnings)}`);
    console.assert(out.issues.length === 0 && out.consensus.examiner === true, 'E-06 실패');
  }

  // E-04: 스키마 위반(잘못된 구조) → 1회 재시도(여전히 위반) → SchemaEscalateError
  {
    let calls = 0;
    const bad = stubTransport(() => { calls++; return '{"issues": [{"severity": "high"}]}'; }); // required(type,target,description,legalBasis) 누락
    const runAgent = makeRunAgent({ transport: bad, loadPrompt, onEvent: (e) => log('  · event:', JSON.stringify(e)) });
    try {
      await runAgent({ mode: 'discover', state });
      log('\nE-04 → ❌ escalate 안 됨(버그)');
    } catch (e) {
      log(`\nE-04 → ✅ ${e.name} (agent=${e.agentId}) after ${calls} transport calls(=재시도 포함)`);
      console.assert(e instanceof SchemaEscalateError, 'E-04 타입 불일치');
    }
  }

  // E-05: 1차 프로바이더 장애 → fallbackProvider 1회 폴백 + 로그
  {
    let attempt = 0;
    const flaky = async (call) => {
      attempt++;
      if (call.provider === 'gpt') { const e = new Error('upstream 500'); e.code = 'SERVER'; throw e; } // 원 프로바이더 장애
      return { text: '{"issues": []}', stopReason: 'end', it: 100, ot: 50, latencyMs: 5, provider: call.provider, model: 'fallback' };
    };
    const onlyExaminerA = OPINION_AGENTS.filter((a) => a.id === 'examiner_A'); // gpt→폴백 gemini
    const events = [];
    const runAgent = makeRunAgent({ transport: flaky, loadPrompt, agents: onlyExaminerA, onEvent: (e) => events.push(e) });
    const out = await runAgent({ mode: 'discover', state });
    log(`\nE-05 → provider 라벨=${out.provider}, warnings=${JSON.stringify(out.warnings)}`);
    log(`     events=${JSON.stringify(events)}`);
    console.assert(events.some((e) => e.kind === 'provider_fallback'), 'E-05 폴백 로그 없음');
  }
}

async function main() {
  const state = OpinionProfile.adaptSnapshot(sampleOpinionCase, null, { terminationPolicy: OpinionProfile.terminationPolicy, reviewId: sampleOpinionCase.reviewId, caseId: sampleOpinionCase.caseId });
  log(`케이스 로드: ${state.caseId} · claims=${state.claims.length} · cited=${state.citedPrior.length} · anchor=${state.claims.filter((c) => c.kind === 'anchor').map((c) => `${c.id}(${c.anchorType})`).join(',')}`);

  // Part 3 은 키 없이도 동작(결정적). Part 1/2 는 키 필요.
  await part3_errorPaths(structuredClone(state));

  if (!process.env.ANTHROPIC_API_KEY) {
    hr('⚠️ ANTHROPIC_API_KEY 미설정 — Part 1/2(실 LLM) 건너뜀. Part 3(오류경로)만 증명됨.');
    return;
  }
  await part1_liveDiscover(structuredClone(state));
  await part2_orchestratorWiring(structuredClone(state));
}

main().catch((e) => { console.error('DEMO FATAL:', e); process.exit(1); });
