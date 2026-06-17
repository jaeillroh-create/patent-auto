# 진단 — 의견서 작성 중 멈춤 (본문 생성됐는데 "완료" 안 됨, status 컬럼 수정 후)

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-draft-stuck` · **READ-ONLY, 코드 수정 0**
> 증상: 의견서 본문 생성됨(서두·보정내용 보임). "작성 중" 안 꺼지고 7단계 못 감. opinion_opinion_drafts.status varchar(20)→text 고친 후 발생.

---

## 0. 결론 (한 줄)

직전 컬럼 수정으로 **의견서 INSERT(3524)가 처음으로 성공** → 흐름이 **그 다음 줄 `setStatus(p.id,'opinion_drafted')`(3532)에 처음 도달**한다. 그런데 **`setStatus`는 실패를 삼킨다**(opinion.js:4126 — throw 안 하고 `{ok:false}`+토스트만). **opinion_projects.status(프로젝트 테이블 — 방금 고친 opinion_opinion_drafts 와 다른 컬럼)** 가 `'opinion_drafted'`를 거부(CHECK/타입)하면 상태가 **'drafting_opinion'에 묶여** 7단계로 못 간다. → "본문은 보이는데 작성 중에서 멈춤". **F12의 `[Opinion.setStatus] DB 실패 (status=opinion_drafted)` 로그 1줄로 확정된다.**

---

## 1. 생성 후 ~ 종료 사슬 (startOpinionDraft, file:line)

```
3294  state.drafting = true                         // 스피너 ON 조건
3299  await setStatus(p.id,'drafting_opinion')      // (1) 프로젝트 status = 작성 중
3438  var r = await App.callClaude(prompt)          // LLM (단일 호출, 본문 생성)
3458  contamination 검사 → high면 throw ce          // → catch → 에러 카드(스피너 OFF)
3524  await sb…opinion_opinion_drafts.insert(...)   // status='draft'(text 로 고침 → 이제 성공)
        error 면 throw de(db)                       // → catch → 에러 카드(스피너 OFF)
3531  state.opinionDraft = od                       // 본문 확보
3532  await setStatus(p.id,'opinion_drafted')        // ★ (2) 처음 도달 — 프로젝트 status = 초안
3549  catch → draftError + setStatus('claims_confirmed') 롤백
3552  finally → state.drafting = false; renderDetail()   // 어떤 경로든 스피너 OFF + 재렌더
```

## 2. 스피너/멈춤 판정 (renderOpinion 3620-3661)

- `loading = (status==='drafting_opinion' || 'claims_confirmed') && state.drafting===true` (3624).
- `draftError && !ready` → **에러 카드**(3630, return). `loading && !ready` → **스피너만**(3660, return; 본문 미표시).
- 그 외 → **본문 표시**(3663~). `ready = status==='opinion_drafted'`.

→ **모든 throw 경로(contamination 3506 / INSERT 3529 / 기타)는 catch→finally(3552)** 를 거쳐 `drafting=false` + 재렌더 → **스피너는 꺼지고 "에러 카드"가 뜬다.** 즉 **에러 카드도 없고 7단계도 안 되며 본문만 보이는 상태**는 throw 가 아니라 **상태 미전환**이다.

## 3. ★ 멈춘 지점 — setStatus 의 "조용한 실패"

`setStatus`(opinion.js:4119):
```
var res = await sb.from('opinion_projects').update({status:s, updated_at}).eq('id',id);
if (res.error) throw res.error;     // ← 내부 throw
… catch(e){ console.error('[Opinion.setStatus] DB 실패 (status='+s+'):', e);
            showToast('상태 저장 실패 — 새로고침 후 재시도'); return {ok:false}; }  // ★ 삼킴(재-throw 안 함)
```
- **setStatus 는 실패해도 예외를 밖으로 안 던진다**(메모리 status 도 안 바꿈). → startOpinionDraft 의 `await setStatus('opinion_drafted')`(3532)는 **항상 정상 resolve** → catch 안 탐 → `draftError` 없음 → finally → `drafting=false` + renderDetail.
- 그 결과 renderOpinion: `drafting=false`(loading 거짓), `draftError` 없음, **`status` 는 여전히 'drafting_opinion'**(setStatus 가 못 바꿈) → `ready=false`. → **본문(3663~)은 표시되지만 status 가 '의견서 작성 중'에 묶여 7단계(ready) 게이트가 안 열린다.** NAV 라벨도 "의견서 작성 중"(line 29) → 사용자에겐 "스피너/작성 중 안 꺼짐"으로 보인다.

### 왜 "status 고친 후" 새로 발생했나 (핵심)
- 고치기 전: opinion_opinion_drafts.status='draft' INSERT(3524)가 **varchar(20) 실패 → throw → 에러 카드**. **3532 setStatus('opinion_drafted')에 도달 못 했다.**
- 고친 후: INSERT(3524) **성공 → 3532 setStatus('opinion_drafted')에 처음 도달**. 여기서 **opinion_projects.status** 가 `'opinion_drafted'`를 거부하면(아래) 조용히 실패 → 멈춤. **앞선 수정이 다음 관문을 드러낸 것.**

### opinion_projects.status 가 거부하는 이유(후보)
- ⚠️ 방금 고친 건 `opinion_opinion_drafts.status`(의견서 테이블). setStatus(4121)가 쓰는 건 **`opinion_projects.status`(프로젝트 테이블) — 별개 컬럼.** 저장소 마이그레이션에 이 컬럼 정의/CHECK 없음(대시보드 생성 추정).
- (a) **CHECK 제약에 'opinion_drafted' 미포함**(옛 status 목록) → UPDATE 거부. ('drafting_opinion'은 3299에서 통과했으니 CHECK가 그건 허용.)
- (b) **varchar(N<15)** 가능성은 낮음('drafting_opinion'=16자가 3299에서 통과 → 컬럼 ≥16, 'opinion_drafted'=15 수용).
- → (a) CHECK 누락이 유력.

---

## 4. ★ F12 콘솔 — 사용자 확인 (결정적)

생성 직후 콘솔/네트워크를 보면 즉시 갈린다:

| 관찰 | 원인 | 해결 |
|---|---|---|
| **`[Opinion.setStatus] DB 실패 (status=opinion_drafted): …`** + "상태 저장 실패" 토스트 | ★ **(유력)** opinion_projects.status 가 'opinion_drafted' 거부(CHECK/타입) → 상태 미전환 | opinion_projects.status CHECK에 'opinion_drafted' 추가 / 타입 확장 |
| `[Opinion.DB] INSERT error … code:22001/23514` | opinion_opinion_drafts 가 또 다른 컬럼/CHECK로 거부 → 에러 카드 | 해당 컬럼/CHECK 수정 |
| `… contamination …` throw → 에러 카드 표시 | 오염 high 재검출 | #185 마스킹 배포/마커-문장 제거 |
| 콘솔 에러 없음 + Network 에 **pending(빨강 아님) 요청** | await 행(INSERT/LLM 미settle) — 진짜 스피너 지속 | 해당 호출 타임아웃/원인 |

- ★ **핵심 확인**: 콘솔에 **`[Opinion.setStatus] DB 실패 (status=opinion_drafted)`** 가 있는가? 있으면 §3 (a) 확정.
- 보조: `Opinion.state.current.status` 가 `'opinion_drafted'` 인지(콘솔에서) — 'drafting_opinion'이면 setStatus 실패 확정.

---

## 5. 해결책 (수정 안 함 — 권고)

1. **(유력) opinion_projects.status 제약 보강(DB)**: `'opinion_drafted'`(및 코드가 쓰는 전체 status: analyzing/parsed/type_determined/claims_confirmed/drafting_opinion/opinion_drafted/validating/completed/parse_failed …)를 CHECK에 포함하거나, status 를 text 로 확장. — 방금 opinion_opinion_drafts 고친 것과 **같은 계열의 2차 관문**.
2. **(코드 견고화, 별도) setStatus 실패가 조용히 묻히는 문제**: 최종 전환(opinion_drafted)에서 `setStatus`가 `{ok:false}` 면 startOpinionDraft 가 이를 **인지**(draftError/db 로 승격하여 에러 카드+재시도)하도록. 현재는 삼켜서 "본문은 있는데 7단계 막힘"이 무증상 멈춤으로 보인다. (kernel 0, client.)
3. **만약 F12가 'await 행'(pending)**: INSERT/LLM 호출에 타임아웃/재시도 점검(별도).

> **권장 진행**: 먼저 F12 로그로 setStatus 실패 여부 확정 → 맞으면 **opinion_projects.status CHECK/타입 보강(DB)** + **setStatus 실패 표면화(코드)** 를 한 PR(연관)로. ②(마스킹)와는 무관한 신규 이슈.

---

## 6. 한 줄 요약

컬럼 수정으로 INSERT(3524)가 성공해 흐름이 **setStatus('opinion_drafted')(3532)에 처음 도달**했는데, **setStatus 가 실패를 삼켜서(4126)** opinion_projects.status 가 'opinion_drafted' 거부 시 **상태가 '작성 중'에 묶이고 7단계가 안 열린다**(본문은 표시·literal 스피너는 finally 에서 꺼짐). **F12의 `[Opinion.setStatus] DB 실패 (status=opinion_drafted)` 한 줄로 확정** — 해결은 opinion_projects.status CHECK/타입 보강 + setStatus 실패 표면화.
