# DIDIM IP Center — 통합 리뷰 엔진 (Unified Review Engine) 기능명세서 v0.3

> **버전** v0.3 (통합 엔진 고도화본)
> **상태** 구현 착수용 확정 명세
> **대상** `review-engine/` (신규 통합 위성 모듈)
> **적용 모듈** opinion.js → division.js → patent.js (스트랭글러, 비침습)
> **전제** 각 작성 모듈(opinion/division/patent)은 동결. 작성·수정·정합성·반영 책임 보유. 리뷰 엔진은 IP처(심사) 역할로 검증·지적·수렴만 수행.
> **관련 문서** 본 명세 = WHAT/WHY. 실행 절차 = `review-engine-claude-code-worksheet.md` (HOW).

---

## 목차
0. 시스템 개요 및 역할 모델
1. 통합 아키텍처 (Core + ReviewProfile)
2. ReviewProfile 인터페이스 (통합 계약)
3. 공통 상태 스키마 (Blackboard)
4. 에이전트 시스템 (6역할 + 모듈별 구성)
5. 차등 검증 (청구항 유형 프로파일)
6. 수렴 알고리즘 (단조성·예산·하드캡)
7. 보정 컴파일러 (Patch Plan)
8. 모듈별 프로파일 (opinion / division / patent)
9. Human Gate
10. 작성 모듈 연동 계약
11. 엣지·예외 케이스 (전수)
12. 비결정성·재현성·감사
13. 비용·성능 모델
14. 보안·권한
15. 관측성 (로깅·메트릭·트레이싱)
16. 테스트 전략
17. 구현 로드맵 (스트랭글러)
18. 파일 구조
19. 확정 필요 파라미터
20. 용어집

---

## 0. 시스템 개요 및 역할 모델

### 0.1 3-주체 핑퐁
```
┌──────────────┐  작성/수정     ┌────────────────────┐  지적      ┌──────────────┐
│ 작성 모듈        │ ────────────▶ │ unified-review-engine   │ ─────────▶│  Human Gate     │
│ opinion/division│ ◀──────────── │ (IP처 심사 에이전트)      │           │ (사람 확정)      │
│ /patent          │  Patch Plan   │ 검증·예비문제·수렴       │           │ 교착·trade-off   │
│ 작성·정합성·반영  │               │ (모듈 무지, Profile 의존) │           │                  │
└──────────────┘               └────────────────────┘           └──────────────┘
```

### 0.2 책임 경계 (불변)
| 주체 | 책임 | 금지 |
|---|---|---|
| 작성 모듈 | 최초 작성, 자기검토, 실제 텍스트 수정, 정합성·3경로 재검증 | — |
| 리뷰 엔진 | 적대적 검증, 예비 거절이유 발굴, 보정 Plan 생성, 수렴 제어 | 작성·직접수정·자동반영 |
| Human Gate | 교착·권리범위 trade-off·미해소 high 최종 결정 | — |

### 0.3 핵심 불변식 (Invariants) — 위반 시 시스템 결함
- **I-1** 리뷰 엔진은 작성 모듈의 원본 상태를 절대 변형하지 않는다(읽기 전용 스냅샷).
- **I-2** 어떤 보정도 사람 승인 없이 작성 모듈에 반영되지 않는다.
- **I-3** scorer 점수는 채택된 보정에 의해 단조 감소한다(진동 시 보정 거부).
- **I-4** 토론은 유한 라운드 내 반드시 종료한다(CONVERGED 또는 ESCALATE).
- **I-5** 모든 상태 전이는 영구 로그에 기록된다(감사성).
- **I-6** Core는 module 문자열 외에 모듈별 분기 로직을 갖지 않는다(개방-폐쇄).

---

## 1. 통합 아키텍처

### 1.1 레이어
```
┌─────────────── review-engine-core (모듈 무지) ───────────────┐
│  kernel/                                                       │
│    orchestrator   라운드·모드·다음발화자·종료                    │
│    scorer         단조성 스칼라 점수 (가중치는 Profile 주입)      │
│    convergence    종료조건·예산·하드캡                          │
│    fingerprint    issue 지문·진동 탐지                          │
│    amendmentCompiler  지적→PatchPlan (op·ripple, 규칙 Profile)  │
│    stateStore     Blackboard CRUD + 버전·낙관적 락             │
│    logger         라운드·전이 영구 기록                         │
│    humanGate      사람 확정 인터페이스                          │
│  contracts/                                                    │
│    ReviewProfile  (인터페이스)                                  │
│    WriterModule   (작성 모듈 연동 계약)                         │
└──────────────────────────────────────────────────────────────┘
        ▲ 주입                ▲                    ▲
  ┌────────────┐     ┌────────────┐      ┌────────────┐
  │OpinionProfile│     │DivisionProfile│      │PatentProfile │
  └────────────┘     └────────────┘      └────────────┘
        ▼                    ▼                    ▼
    opinion.js          division.js           patent.js
```

### 1.2 의존 방향
- Core → contracts 인터페이스만 의존.
- Profile → contracts 구현 + 자기 작성모듈 연동.
- Core는 Profile 구현체를 **런타임 주입**으로만 획득(`engine.run(profile, snapshot)`).
- **금지**: Core 내 `if (module === "division")` 류 분기. 모든 모듈 특수성은 Profile 주입.

### 1.3 실행 토폴로지
- 오케스트레이션: Supabase Edge Function(다중 LLM 지연·키 노출·비용 폭주 격리).
- LLM 호출: 기존 `common.js` 멀티프로바이더 래퍼 재사용.
- 클라이언트: 트리거·진행 구독(SSE/polling)·결과 렌더만.
- 상태: Supabase 테이블(블랙보드 직렬화 + 라운드 로그).

---

## 2. ReviewProfile 인터페이스 (통합 계약)

```typescript
interface ReviewProfile {
  module: "patent" | "opinion" | "division";

  // (1) 입력 어댑터: 작성모듈 산출물 → 공통 ReviewState
  adaptSnapshot(raw: WriterSnapshot, selfReview: SelfReviewLog): ReviewState;

  // (2) 에이전트 구성: 모듈별 적대 주체 + 트리거/IO/프롬프트참조/모델
  agents: AgentDef[];

  // (3) issue 분류: enum이 아닌 판정 predicate까지 주입 (Core 오염 방지)
  issueCatalog: IssueTypeDef[];          // {type, legalBasis, severityRule(ctx)→sev}

  // (4) 정합성 규칙: 무엇을 교차검증하나 (Core는 규칙을 모름)
  consistencyRules: ConsistencyRule[];   // {id, scope, check(state)→Violation[]}

  // (5) scorer 가중치 + kind별 분기 배수
  scoreWeights: ScoreWeights;            // {high, medium, scopeShrink, inconsistency, byKind}

  // (6) 보정 op 허용집합 + Ripple 규칙 (모듈별 상이)
  amendmentOps: OpDef[];                 // 허용 op + ripple 추적 규칙
  rippleRules: RippleRule[];

  // (7) 종료 정책
  terminationPolicy: { K: number; maxRounds: number; capUsd: number;
                       perIssueAttemptCap: number };

  // (8) 작성모듈 반영 계약
  writer: WriterModule;                  // exportSnapshot / applyAmendments
}
```

### 2.1 인터페이스 설계 원칙
- **데이터가 아니라 행위까지 주입**: issueCatalog는 `severityRule(ctx)` 함수를 포함. division의 "신규사항" 판정 같은 모듈 특수 로직이 Core로 새지 않도록.
- **Core는 predicate를 호출만**: 판정 결과(boolean/severity)만 받아 공통 수렴 로직에 투입.
- **확장 무비용**: 신규 모듈 = 신규 Profile 1개. Core 불변.

---

## 3. 공통 상태 스키마 (Blackboard)

```javascript
ReviewState = {
  reviewId, caseId, module, schemaVersion,
  source: { snapshot, selfReviewLog },          // 읽기전용 (I-1)

  invention: { title, field, problem, solution, keyComponents:[] },

  claims: [ {
    id, no, type:"independent"|"dependent",
    kind:"general"|"anchor"|"unknown",          // 차등검증 키 (§5)
    text, status, attempts:int,
    history:[ {round, actor, action, before, after} ]
  } ],

  spec:       { sections:[ {key, text} ] },
  citedPrior: [ {id, label, summary} ],
  figures:    [ {id, label, refSigns:[{sign, term}]} ],

  // 모듈별 확장 슬롯 (Profile이 채움, Core는 불투명 취급)
  moduleContext: { /* opinion: 의견제출통지서/거절이유  | division: 원출원/분할매트릭스 */ },

  issues: [ {
    id, type, severity:"high"|"medium"|"low",
    target:[ref], raisedBy, legalBasis, description,
    fingerprint, occurrences:int,
    status:"open"|"rebutted"|"amend_planned"|"resolved"|"accepted"|"deadlock"|"regression",
    resolution:{actor, action, note}|null
  } ],

  patchPlans: [ {
    id, addressesIssues:[issueId],
    ops:[ {op, target, content, reason:issueId} ],
    ripple:[ {affected, change} ],
    simulated:bool, scoreBefore, scoreAfter,    // 단조성 판정용
    accepted:null|true|false                    // 사람만 변경 (I-2)
  } ],

  consensus: { examiner:bool, attorney:bool, expert:bool },
  scoreHistory: [ {round, score, breakdown} ],

  rounds: [ {n, agent, mode:"discover"|"recheck", inputRef, output,
             provider, cost, latencyMs, ts} ],

  budget: { capUsd, spentUsd, maxRounds, roundsUsed, perIssueAttemptCap },
  version, lock,                                // 낙관적 동시성 (E-20)
  phase: "idle"|"running"|"converged"|"escalated"|"human_review"|"finalized"
}
```

---

## 4. 에이전트 시스템

### 4.1 6역할 (모듈 공통 역할군, 구성은 Profile이 결정)
| 역할 | 책임 | 기본 모델 | 비고 |
|---|---|---|---|
| examiner_A | 진보성·신규성 적대 | GPT | 작성자(Claude)와 다른 모델 |
| examiner_B | 기재불비·명확성·뒷받침 | Gemini | |
| examiner_C | 청구범위·단일성·신규사항 | GPT | division에서 §47 전담 강화 |
| attorney_author | 초안 방어·대응의견·보정 *방향* | Claude | 수정 금지(방향만) |
| attorney_reviewer | 독립 검토·과축소 견제·해소판정 | GPT | 독립관점 위해 비-Claude |
| domain_expert | 실시가능성·기술정확성·사업목적 | Gemini | 분야 컨텍스트 주입 |

### 4.2 에이전트 정의 (선언형)
```javascript
{ id, role, provider, temperature,
  mode: "discover"|"recheck"|"both",
  triggers:[event], reads:[field], writes:[field],
  systemPromptRef: ".claude/rules/agents/<module>/<id>.md",
  outputSchema, retryPolicy:{maxRetry:1, onFail:"escalate"} }
```

### 4.3 출력 스키마 강제
- 모든 에이전트 출력은 JSON 스키마 검증(IssueList / RebuttalSet / PatchDirection / Verdict).
- 위반 → 1회 재시도 → 실패 시 라운드 ESCALATE(E-04).

### 4.4 모드 분리 (골대이동 차단)
- **discover**(R1): 전수 발굴. 가능한 모든 지적.
- **recheck**(R2+): 신규 지적 금지. {통과|잔존|회귀}만. 신규는 "직전 보정이 유발한 regression"만 허용.

---

## 5. 차등 검증 (청구항 유형)

### 5.1 유형·검증 벡터
| kind | 정의 | 위험 | 진보성 | 뒷받침 | 과축소 |
|---|---|---|---|---|---|
| general | 발명충실 | 과광범→진보성부정 | **강** | 중 | **견제(강)** |
| anchor | 등록용 창작구성 | 뒷받침부족→기재불비 | 관대 | **엄격** | 약 |
| unknown | 태그누락 | 오판 | — 격리 → 사람 유형지정(E-12) |

### 5.2 앵커항 1차 관문
- 앵커항은 **상세설명 뒷받침 매핑 존재**를 최우선 검증. 부재 시 즉시 high/기재불비.
- division에서는 "원출원 뒷받침" 여부로 변형(신규사항 판정과 연동).

### 5.3 유형별 종료 차등
- 앵커 뒷받침 high → 자동 해소 끝까지.
- 일반항 진보성(권리범위 trade-off) → 자동종결 금지 → Human Gate.

---

## 6. 수렴 알고리즘

### 6.1 종료 목표 = 임계값 (0 아님)
```
CONVERGED ⇔ (high_open == 0) AND (medium_open ≤ K) AND (수렴신호)
low → 기록만, 루프 미발동
```

### 6.2 3층 방어
- **L1 Severity Gate**: 위 종료식.
- **L2 단조성(진동차단·수렴보장)**:
  ```
  score = w_high·high_open + w_med·med_open
        + w_shrink·scopeShrinkPenalty + w_incon·inconsistency
        (w는 claim.kind별 분기)
  규칙: scoreAfter ≥ scoreBefore → 보정 채택 거부 → issue=accepted
  ⇒ 단조 감소 보장, 진동은 점수 정체 시 정지
  ```
- **L3 하드캡**: roundsUsed≥maxRounds OR spentUsd≥capUsd → ESCALATE.

### 6.3 진동·골대이동 차단
- **지문**: fingerprint=hash(type, target, coreElement). occurrences≥2 → deadlock → Human Gate.
- **예산**: claim.attempts≥perIssueAttemptCap(2) → accepted.
- **모드분리**: §4.4.

### 6.4 수렴 루프 (의사코드)
```
R1: writer.export → review(discover, 전수) → 분류(severity × kind)
loop while roundsUsed≤maxRounds AND spentUsd≤capUsd:
    if high_open==0 AND med_open≤K: return CONVERGED

    for issue in prioritize(open, order=[anchor_support, high, med]):
        if issue.occurrences≥2:            issue=deadlock; continue   # 사람
        if claim.attempts≥cap:             issue=accepted; continue   # 예산
        if isTradeoff(issue, claim.kind):  issue=deadlock; continue   # 사람

        plan = amendmentCompiler(issue, profile.amendmentOps, profile.rippleRules)
        s0 = scorer(state)
        applied = writer.applyAmendments(plan, {simulate: SIMULATE_MODE})  # §19-7
        s1 = scorer(state_after)
        if s1 ≥ s0:                         rollback; issue=accepted; continue  # L2
        review(recheck) → {통과|잔존|회귀}
        if 회귀: spawn regression issue (예산 내 재루프)
        claim.attempts++; record(scoreHistory)

return ESCALATE
# 종료 후: deadlock·미해소·escalate → Human Gate (high 잔존은 강조, 자동통과 금지 E-17)
```

---

## 7. 보정 컴파일러

### 7.1 5단계
```
① Intent Extraction: 자연어 지적 → 제한 op 집합
     {add_limitation|narrow_scope|split_claim|add_antecedent|fix_term|add_spec_support|...}
     (profile.amendmentOps가 모듈별 허용 op 정의)
② Ripple Analysis: 영향 그래프 (claim↔종속항↔상세설명↔도면부호↔요약서)
     (profile.rippleRules가 모듈별 전파 규칙 정의)
③ Patch Plan 생성: 정렬된 op + ripple, 각 op ↔ issue 1:1 추적
④ Apply: writer.applyAmendments (사람 승인 후, 또는 simulate)
⑤ Consistency Recheck: writer가 정합성·3경로 재검증 → 결과 회신
```

### 7.2 책임 경계
- 컴파일러: "무엇/어디/어떻게"의 구조화 Plan까지.
- writer(작성모듈): 실제 텍스트 수술 + 정합성 + 3경로 렌더 재검증.

---

## 8. 모듈별 프로파일

### 8.1 OpinionProfile (의견서 — 1순위 구현)
| 항목 | 내용 |
|---|---|
| moduleContext | 의견제출통지서, 거절이유(인용발명·대상청구항), 보정안 |
| 적대 초점 | 우리 반박 논리 견고성 / 보정이 거절 실제 해소 / 신규사항 미추가 |
| issueCatalog | 거절미해소, 신규사항추가(§47), 논리결함, 보정범위이탈, 청구항-의견 정합 |
| consistencyRules | 보정 청구항 ↔ 의견서 주장 정합, 인용발명 대비 차별점 유지 |
| 차등검증 | 보정으로 추가된 구성=anchor 취급(뒷받침 엄격) |
| writer | opinion.js (image 33 쟁점·전략, image 14 통과/주의/실패 매핑) |
| 우선 이유 | 적대효용 최대, 상태 단순, 인용발명·통지서 입력 명확 |

### 8.2 DivisionProfile (분할 — 2순위)
| 항목 | 내용 |
|---|---|
| moduleContext | 원출원 명세서·청구항, 분할 매트릭스(image 18), 분할유형(병합/카테고리변경/전략적) |
| 적대 초점 | **신규사항 추가 금지(§47)**, 원출원 범위 이탈, 이중특허, 단일성 |
| issueCatalog | 신규사항추가, 원출원범위이탈, 이중특허, 단일성 (image 19의 basis보존/이중특허 pass 매핑) |
| consistencyRules | 분할항(신규/초록) ↔ 원출원 뒷받침, 추가분이 정당 구체화인지 금지 신규사항인지 |
| 차등검증 | "원출원범위내구체화 vs 전략적확장 vs 범위이탈"로 변형 (image 18 분할역할) |
| writer | division.js (image 17 원본vs신규 diff, image 20 구체화-한정-부가 포인트) |

### 8.3 PatentProfile (특허 작성 — 3순위, 최복잡)
| 항목 | 내용 |
|---|---|
| moduleContext | 발명내용, 인용발명(선택), patent.js 자기검토 로그(image 15/19) |
| 적대 초점 | 진보성·신규성·기재불비·단일성 |
| issueCatalog | 진보성, 신규성, 기재불비, 명확성, 단일성, 실시가능성 |
| consistencyRules | 청구항↔상세설명↔도면부호↔요약서, 3경로 렌더 정합 |
| 차등검증 | general/anchor (§5 전체) |
| writer | patent.js (10,000줄·도면 3경로, 가장 위험) |
| 특수 | 자기검토 2단방어(§아래) |

### 8.4 patent 자기검토 2단 방어
- patent.js 자기검토(self) = 1차 게이트(작성품질). 리뷰엔진 = 2차(적대).
- 리뷰엔진은 selfReviewLog를 컨텍스트로 받아 "통과 근거"를 알고 공격(효율↑).
- 자기검토 통과항목 재확인하되 **새 거절관점에서만** issue 생성(중복판정 금지).

---

## 9. Human Gate
- patchPlans 건별 승인/거부. 승인분만 writer 반영(미승인 로그보존).
- **필수 사람결정**: deadlock(진동), 일반항 trade-off, escalate 잔여 high, unknown kind.
- 권리 축소=출원인 사업판단 → 기계 합의 종결 금지.

### UI 매핑
| 산출물 | 화면 |
|---|---|
| 보정 diff | image 17 (초록/회색/빨강) |
| 통과/주의/실패 | image 14 |
| pass 카운트 | image 19 |
| 쟁점·전략 | image 33 |
| 최종확정 | image 14/19 |
| 비용 | image 13/15 |

---

## 10. 작성 모듈 연동 계약 (WriterModule)
```typescript
interface WriterModule {
  exportSnapshot(caseId): { snapshot, selfReviewLog, claimsWithKind };  // 읽기전용 (I-1)
  applyAmendments(caseId, plans, opts:{simulate:boolean}):
    { applied, rejected,
      consistency:{ claimSpecOk, refSignOk, abstractOk },
      renderCheck:{ svg, pptx, canvas } };     // 3경로 하드제약
  rollback(caseId, txnId): { ok };             // simulate/실패 복구
}
FEATURE_FLAGS.reviewEngine = true|false;        // OFF시 기존동작 (I-1 보강)
```

---

## 11. 엣지·예외 케이스 (전수, 카테고리별)

### 11.1 입력·데이터
| ID | 케이스 | 처리 |
|---|---|---|
| E-01 | 스냅샷 공백/손상 | 중단, "작성 미완료" 안내, 루프 미진입 |
| E-02 | 인용발명 없음 | 진보성 "참고용" 강등, high 진보성 생성금지 |
| E-03 | 자기검토 로그 없음 | 백지검증 폴백 + 효율저하 경고 |
| E-12 | claim kind 누락 | unknown 격리, 추정금지, 사람 유형지정 |
| E-13 | 도면부호 정보 없음 | 부호정합 skip, "도면 미검증" 플래그 |
| E-24 | moduleContext 필수항목 결손(opinion 통지서 없음) | 해당 모듈 검증 불가 → 사용자에 필수입력 요청 |

### 11.2 에이전트·LLM
| ID | 케이스 | 처리 |
|---|---|---|
| E-04 | 출력 스키마 위반 | 1회 재시도→ESCALATE |
| E-05 | 프로바이더 장애 | 폴백 프로바이더 1회, 모델변경 로그명시 |
| E-06 | 심사관 0건(과대관용) | 최소검토 강제+검토변리사 교차, 그래도 0이면 통과인정+경고 |
| E-07 | 에이전트 판정충돌 | 높은 severity 우선, 충돌기록, 미해소→Human Gate |
| E-14 | 외부전문가 분야오판 | 사용자확인 단계서 정정 |
| E-25 | LLM 비용/토큰 폭주(긴 명세서) | 청구항/섹션 청크 분할 검증, 라운드당 토큰 상한 |

### 11.3 수렴·루프
| ID | 케이스 | 처리 |
|---|---|---|
| E-08 | 진동 | 단조성 위반→보정거부→accepted |
| E-09 | 동일 issue 반복 | occurrences≥2→deadlock→사람 |
| E-10 | 예산소진 | attempts≥cap→accepted |
| E-15 | 보정이 단일성 신규유발 | examiner_C recheck 회귀→재루프 |
| E-16 | 보정이 앵커 뒷받침 파괴 | examiner_B 회귀 우선, 미해소→deadlock |
| E-17 | 캡도달 high잔존 | 강제종료, high 강조, 자동통과 금지→Human Gate |
| E-26 | 모든 issue가 trade-off(전부 사람결정) | 즉시 Human Gate 전환, "자동 해소분 없음" 표시 |

### 11.4 반영·정합성
| ID | 케이스 | 처리 |
|---|---|---|
| E-11 | 반영후 3경로 불일치 | 롤백, "렌더회귀" issue, writer측 수정통보 |
| E-18 | Ripple 누락 상세설명 미반영 | claimSpecOk=false→보정 재시도 |
| E-19 | 부분승인 부분반영 | 승인분 반영+재검수, 미승인 open 유지 |
| E-20 | 동시수정 충돌 | 낙관적 락+버전충돌 감지→재기준화 요청 |
| E-27 | simulate 반영 후 rollback 실패 | 트랜잭션 격리, 실패 시 전체 ESCALATE+상태 동결 |

### 11.5 운영·안전
| ID | 케이스 | 처리 |
|---|---|---|
| E-21 | 토글 OFF 호출 | 무동작, 기존 동작 |
| E-22 | 라운드당 비용 급증 | 모니터, 임계 초과 조기 ESCALATE |
| E-23 | deadlock 과다누적 | 비율초과시 전체 ESCALATE, 종합검토 요청 |
| E-28 | Profile 누락/오구현(신규모듈) | 인터페이스 계약검증 실패→로드거부, Core 보호 |
| E-29 | 프롬프트 인젝션(명세서 내 악성지시) | 입력 sanitize, 에이전트는 메타지시 무시(프롬프트 격리) |

---

## 12. 비결정성·재현성·감사
- 토론 경로는 비결정적. **재현 대신 추적 보장**: 모든 라운드 입출력·모델·시드(가능시)·비용 기록.
- "무엇이 왜 보정/수용/교착/회귀되었는가" 100% 추적.
- 사람 승인/거부 결정 기록(누가·언제·무엇).
- 동일 입력 재실행 시 결과 상이 가능 → UI에 "검증은 비결정적, 참고 후 사람 확정" 명시.

---

## 13. 비용·성능 모델
- 라운드1 심사관 3인 **병렬**(지연 단축).
- 청크 검증(E-25): 긴 명세서는 청구항·섹션 단위 분할.
- 비용 상한: 모듈별 차등(opinion $5 / division $8 / patent $15, 조정가능).
- 라운드별 비용·지연 기록·표시(image 13/15 비용추적 연동).
- 조기 종료: 비용곡선 급증 시 ESCALATE.

---

## 14. 보안·권한
- KIPRIS/LLM 키: 기존 per-user 키 체계 재사용, Edge Function 내 보관(클라이언트 비노출).
- 스냅샷·로그: 케이스 소유자 권한 스코프.
- 프롬프트 격리: 명세서 본문은 데이터로만 취급, 메타지시 차단(E-29).
- 감사 로그 변조방지(append-only).

---

## 15. 관측성
- **로그**: 라운드·상태전이·승인결정 (Supabase append-only).
- **메트릭**: 라운드수, 수렴율, 평균비용, deadlock율, high해소율, 모델별 지적분포.
- **트레이싱**: reviewId 단위 전체 토론 타임라인 재구성.
- **알림**: ESCALATE·비용임계·반복실패 시.

---

## 16. 테스트 전략
| 층위 | 대상 | 방법 |
|---|---|---|
| 단위 | scorer 단조성, fingerprint 충돌, convergence 종료 | 결정적 단위테스트 |
| 계약 | 각 Profile이 ReviewProfile 계약 충족 | 인터페이스 적합성 테스트 |
| 골든 | 수렴 루프(모킹 에이전트) | 고정 issue 시퀀스로 종료 보장 검증 |
| 회귀 | E-08~E-17 수렴 안정성 | 시나리오 재생 |
| 통합 | writer 연동·3경로 재검증 | opinion 실케이스 |
| 부하 | 긴 명세서 청크·비용상한 | patent 10,000줄 |

> 핵심: **에이전트를 모킹**해 수렴 알고리즘을 결정적으로 테스트(비결정성과 분리).

---

## 17. 구현 로드맵 (스트랭글러 + Core 추출)
| Phase | 범위 | 침습 | 산출 |
|---|---|---|---|
| P0 | contracts/ + stateStore + 토글 + adapter 골격 | 없음 | 스키마·인터페이스·매핑 |
| P1 | **opinion 단일모듈 완성**(읽고 지적만) | 없음 | 6인토론·차등·수렴·HumanGate 표시 |
| P2 | opinion 보정컴파일러+applyAmendments | 낮음 | Patch Plan 반영·재검증 |
| **P3** | division 추가 + **Core 추출** | 낮음 | kernel/ 분리, Opinion/DivisionProfile 확립 |
| P4 | patent 추가 | 중간 | 도면 3경로·자기검토 2단방어 |

> Core 추출은 **2번째 모듈(division) 붙일 때** 수행. 첫 모듈에서 추측 추상화 금지.

---

## 18. 파일 구조
```
/review-engine/
  index.js                       # engine.run(profile, snapshot) 진입점·토글
  kernel/
    orchestrator.js  scorer.js  convergence.js  fingerprint.js
    amendmentCompiler.js  stateStore.js  logger.js  humanGate.js
  contracts/
    ReviewProfile.js  WriterModule.js  schemas/ (IssueList, PatchPlan, Verdict ...)
  profiles/
    opinion/   OpinionProfile.js  agents/  adapter.js  consistency.js
    division/  DivisionProfile.js agents/  adapter.js  consistency.js
    patent/    PatentProfile.js   agents/  adapter.js  consistency.js
  edge/
    review-orchestrate.ts          # Supabase Edge Function
/.claude/rules/agents/
  opinion/ division/ patent/       # 모듈별 에이전트 시스템 프롬프트
  common-review-bugs.md
```

---

## 19. 확정 필요 파라미터
1. medium 종료 임계 `K` (모듈별).
2. scorer 가중치 `w_high/w_med/w_shrink/w_incon` + kind 분기 배수.
3. capUsd 모듈별 (opinion 5 / division 8 / patent 15?).
4. attorney_reviewer 모델 (GPT 독립 확정?).
5. 외부전문가 분야 결정 (자동+사용자확인 하이브리드?).
6. Edge Function 이전 시점 (P1 즉시?).
7. **SIMULATE_MODE**: 사람승인 전 simulate 반영으로 score 측정 허용? (단조성 판정에 필수 — writer simulate 지원 필요).
8. perIssueAttemptCap (기본 2).
9. Core 추출 시점 재확인 (P3 확정?).

---

## 20. 용어집
- **블랙보드**: 모든 에이전트가 공유·갱신하는 단일 상태.
- **단조성**: 채택 보정이 점수를 반드시 개선(진동·무한루프 방지).
- **지문(fingerprint)**: issue 동일성 해시(반복 탐지).
- **앵커 청구항**: 등록 위해 창작 추가한 구성(뒷받침 엄격 검증).
- **discover/recheck**: 발굴 모드 / 검수 모드(골대이동 차단).
- **deadlock**: 진동·교착으로 자동해소 불가, 사람 결정 대상.
- **Profile**: 모듈 특수성 주입체. Core는 이것만 의존.
- **Ripple**: 보정의 연쇄 영향 범위.
