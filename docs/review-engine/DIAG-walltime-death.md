# 진단 — 검증 함수 wall-clock 사망 + review_runs 'running' 고착

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-walltime-death` · **코드 수정 0(진단 문서만)**
> DB 확정: running 2건 고착(created=updated → persist 미실행=함수 사망) + done 1건(2분25초=145s, 경계)

---

## 0. 결론 (3줄)

1. **함수 사망 = Edge worker wall-clock(~150s) 초과.** 백그라운드(`EdgeRuntime.waitUntil`)가 완주 전 강제 종료 → `persistRun` 미실행 → 행이 `running`으로 영구 박제.
2. **attorney가 시간을 늘리는 경로는 2곳**: ① rebut(attorney_author/claude)는 discover **직후 순차 1회**(누적 아님 — 확정), ② attorney_reviewer는 recheck를 **5인 fan-out**으로 넓힘. 둘 다 **1키 claude**에서 동시호출 경합을 키운다.
3. **즉효 = 멀티프로바이더(코드 0)**. 기본 에이전트 정의는 이미 gpt/gemini/claude 분산인데, 클라 `getReviewAuth`의 **"1키 전역" 규칙**이 6역할을 전부 claude로 묶고 있다(키 1개라서). **maxRounds 3→2**(작은 코드)와 조합하면 150s 아래로 안정.

---

## 1. 함수 사망 메커니즘 (file:line)

- `review-engine/edge/review-orchestrate.ts:150-161` — `reviewRunId` 있으면 **202 즉시 반환** + `EdgeRuntime.waitUntil(bg)`. `bg` = `computeReview()` → `persistRun(status:'done'|'failed')`.
- **worker가 wall-clock 초과로 죽으면 `bg`의 `await persistRun`(line 156)이 실행되지 않음** → 행은 INSERT 시의 `status:'running'`(opinion.js:647) 그대로. `updated_at`도 안 바뀜 → **created=updated 고착**(DB 확정과 일치).
- 배포 함수 `supabase/functions/review-orchestrate/index.ts`는 위 소스를 그대로 import하는 래퍼(로직 동일) → 분석이 배포본에 적용됨.
- `providerTransport.js:70` — 단일 LLM 호출 타임아웃 180s. 호출 1건이 길어도 위험하지만, 본 사망은 **호출 누적**이 wall-clock을 넘는 것.

> wall-clock은 worker 시간이라 **클라가 못 늘린다.** B-T3 클라 killer(opinion.js:673, 180s)는 **클라 Promise만 종료 + 토스트**, **DB는 안 고친다**(확정). 그래서 행이 running으로 남는다.

---

## 2. 호출/시간 구조 — 라운드별 LLM 호출 (orchestrator.js)

| 구간 | 위치 | fan-out | 동시성 | 주체 |
|---|---|---|---|---|
| R1 discover | `orchestrator.js:132` | **3인** (examiner_A·B·C) | `Promise.allSettled` 병렬(runAgent.js:181) | round=max(latency) |
| R1 rebut | `orchestrator.js:140` | **1인** (attorney_author/claude·sonnet) | **순차**(discover await 뒤) | ★ 시간 +1콜 |
| recheck (보정마다) | `orchestrator.js:208` | **5인** (A·B·C·attorney_reviewer·domain_expert) | 병렬 | round=max(latency) |

- **discover=3** : `runAgent.js:145` (role==='examiner' && discover==='IssueList'). domain_expert는 role≠examiner + `includeExpertInDiscover` 미설정(edge에서 false) → 제외.
- **rebut=1** : `runAgent.js:151` (discover==='RebuttalSet') = attorney_author만. **`orchestrator.js:140`은 for 루프 밖** → 정확히 **1회**. 누적 아님(확정).
- **recheck=5** : `runAgent.js:153` (recheck==='Verdict' && mode≠discover) = A·B·C·attorney_reviewer·domain_expert. attorney_author는 recheck='RebuttalSet'이라 제외.

### 2-1. maxRounds 3→2 효과 (`OpinionProfile.js:77`)

- `roundsUsed`: R1에서 1(`orchestrator.js:134`), 이후 외부 루프 1회마다 +1(`orchestrator.js:228`). `convergence`가 `roundsUsed ≥ maxRounds`면 ESCALATE(`convergence.js:35`).
- 외부 루프 1회 ≈ recheck 1회(보정 커밋 후 `break`, line 224).
- **maxRounds=3** → R1 + 외부 2회 = **최대 recheck 2라운드**. **maxRounds=2** → R1 + 외부 1회 = **recheck 1라운드**.
- **효과: recheck 라운드 1개 제거 = max(5인 latency) 1회분 단축.** all-claude(1키)에서 recheck 5인 경합이 라운드당 ~50~110s이므로 **~50~110s 단축**(추정), 최악 꼬리(2 recheck)를 잘라 150s 천장 아래로.
- ⚠️ maxRounds는 `OpinionProfile.terminationPolicy`(코드 1토큰) → 변경 시 **edge 재배포 필요**.

### 2-2. attorney가 늘리는 시간 (정밀)

- **rebut(attorney_author)**: `orchestrator.js:140` 순차 1회 → claude·sonnet·8192 한 콜(~25~50s 추정)을 **직렬로 추가**. ★ 이게 145s를 150s 위로 미는 주범.
- **attorney_reviewer**: recheck를 4→5인으로 확대. 병렬이지만 **1키 claude에선 5번째 동시 콜 = 경합 증가**.
- ⚠️ **attorney를 제거하면 안 됨**: attorney_author의 rebut 방향이 방금 머지한 **D1(보정 권고 렌더)의 입력원**. 제거 대신 **프로바이더 분산**으로 해결해야 한다.

---

## 3. 멀티프로바이더 — 코드 0 즉효 (왜 지금 6역할 claude인가)

- 에이전트 **기본 정의는 이미 분산**: examiner_A=gpt·gpt4o, examiner_B=gemini·gemini_pro, examiner_C=gpt·gpt4o, attorney_author=claude·sonnet, attorney_reviewer=gpt·gpt4o, domain_expert=gemini·gemini_pro.
- 그런데 클라가 `getReviewAuth()`(common.js:305) → `getRoleAssignments()`의 **"1키 전역" 규칙**(common.js:283: **키 1개 → 6역할 전부 그 provider**)으로 `assignments`를 만들어 보냄(opinion.js:652).
- edge가 그 `assignments[agent.id]`로 **provider override**(`review-orchestrate.ts:128-133`) → **키가 claude 하나면 6역할 전부 claude**. (env에 OPENAI/GEMINI 시크릿이 있어도 `body.keys`·`assignments`가 우선이라 무력 — `review-orchestrate.ts:117-121`.)

### 효과 (추정 — 측정 아님, 구조 기반)

| | 현재(all-claude·1키) | 멀티프로바이더(3키, 기본 분산) |
|---|---|---|
| discover 3인 | 1키 3동시 경합 ~60~90s | gpt·gemini·gpt 2키 분산 ~40s |
| rebut 1인(순차) | claude ~30~45s | claude(전용키) ~30~45s |
| recheck 5인 | 1키 5동시 경합 ~70~110s | gpt×3·gemini×2 분산 ~50s |
| **합(1 recheck)** | **~160~245s → 사망** | **~120~135s** |

- **즉효 액션(코드 0, 재배포 0)**: 사용자가 검증 LLM 설정 UI에 **GPT·Gemini 키 추가 입력**(2~3개) → `getRoleAssignments`(2+키)가 역할별 분산 적용 → 한 키 경합 해소 + gpt4o/gemini_pro가 큰 claude보다 빠름.
- **추가 단축(작은 코드)**: examiner들 model을 `gpt-4o-mini`/`gemini-flash`로 낮추면 콜당 ~10~20s로 더 단축(에이전트 `model` 필드 수정 = 코드 + 재배포).
- ⚠️ 부수효과: `runAgent.js:130` — 잘림(max_tokens) 시 16000으로 **2차 콜** → 그 에이전트만 2배 시간. maxTokens 8192가 잘리면 wall-clock 추가 위험. 분산 시 한 키 부담 줄어 완화.

---

## 4. ★ running 고착 정리 (DB 위생)

worker 사망분은 `persistRun` 미실행이라 영원히 `running`. 회수 경로:

**(A) pg_cron 주기 정리 (권장 — 앱 코드 0, 전역)**
```sql
-- 매분: 일정 시간 이상 running인 행을 failed로 회수(worker 사망 추정)
update review_runs
set status='failed',
    error='wall-clock timeout (worker 사망 추정 — 자동정리)',
    updated_at=now()
where status='running' and updated_at < now() - interval '5 minutes';
```
- 즉시 1회(고착 2건 정리)도 같은 UPDATE를 수동 실행.
- 기준은 worker wall-clock(~150s) + 여유 → 5분 권장(정상 done은 145s라 오회수 없음).

**(B) 클라 killer가 DB도 정리 (보조 — 작은 코드)**
- `opinion.js:673` killer 발화 시 현재는 토스트만. 여기서 `review_runs UPDATE status='failed'`(해당 reviewRunId)도 치면 즉시 회수. (RLS: 본인 행 update 허용 필요.)

**(C) 다음 검증 시 고착 무시 (현행 이미 안전)**
- 새 검증은 매번 **새 행 INSERT**(opinion.js:647)라 고착 행이 신규 검증을 막진 않음. 다만 "최신 run" 조회 UI가 있으면 stale running을 done/failed 아닌 것으로 무시하도록 가드.

> killer(180s)가 worker 사망(~150s)보다 길어 **30s 헛폴링** 후 종료 → killer를 ~150s로 당기고 (B)로 DB까지 정리하면 UX·위생 동시 개선(선택).

---

## 5. 근본 — wall-clock을 못 늘릴 때

1. **호출 감소(즉시)**: 멀티프로바이더 + maxRounds 3→2 + (선택)빠른 모델 → 150s 아래 유지. **권장.**
2. **유료 플랜**: Supabase Edge worker 시간 상향(플랜별 wall-clock 증가)으로 여유 확보.
3. **라운드 분할(아키텍처)**: R1/recheck를 별 invocation으로 쪼개 중간 state를 review_runs에 영속하고 재트리거 → wall-clock 회피. 가장 견고하나 큰 작업.

---

## 6. 권장 (조합)

| 우선 | 조치 | 종류 | 재배포 | 효과 |
|---|---|---|---|---|
| 1 | **GPT·Gemini 키 추가 입력**(멀티프로바이더) | 코드 0·설정 | 불필요 | 경합 해소, ~160s→~120s |
| 2 | **maxRounds 3→2** (`OpinionProfile.js:77`) | 코드 1토큰 | 필요 | recheck 1라운드 컷, 꼬리 제거 |
| 3 | **pg_cron stale→failed** | DB ops | 불필요 | 고착 회수(전역) |
| 4(선택) | examiner model→mini/flash | 작은 코드 | 필요 | 콜당 추가 단축 |

- **1+3은 코드 0**(즉시), **2는 작은 코드+재배포**. 1+2+3 조합이 150s 천장 아래 안정 + 고착 자동 회수.
- attorney(rebut)는 **유지**(D1 입력원). 분산으로 시간 흡수.
