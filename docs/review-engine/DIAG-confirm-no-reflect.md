# 진단 — confirmRewrite [확정] 후 보정서 "보정 후" 미반영

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-confirm-no-reflect` · **READ-ONLY, 코드 수정 0**
> 증상: D2c 버튼·비교 모달 정상(청구항5 재작성 보임). [확정] 눌렀는데 보정서 "보정 후"에 재작성 청구항 미반영.

---

## 0. 결론 (한 줄)

**커밋 위치 = 보정서 읽는 위치, 재렌더도 있음 — 구조는 전 구간 정확하다.** 그래서 confirmRewrite가 **실제로 commit 라인(773)까지 도달만 하면** 보정서는 반드시 반영된다. 끊긴 곳은 데이터/구조가 아니라 **런타임("[확정] 클릭이 confirmRewrite를 773까지 끌고 갔는가")** 이다. → console.log로 그 지점만 찍으면 즉시 갈린다.

---

## 1. confirmRewrite 커밋 경로 (opinion.js:756-779) — 정상

```js
756 Opinion.confirmRewrite = async function() {
757   var pend = Opinion.state._pendingRewrite;
758   if (!pend) { …; return false; }                              // (G1) 보류본 없음
759   if (pend.gates && pend.gates.canConfirm === false) { …; return false; } // (G2) CRITICAL 차단
762   var p = Opinion.state.current; if (!p) return false;         // (G3) 현재 프로젝트 없음
763   var committed = pend.draftResult;                            // 보류본(=재작성 splice 반영본)
765-772 … review_amendments[].applied=true 마킹 …
773   Opinion.state.draftResult = committed;   // ★ 커밋(in-memory) — 재작성 amended 포함
774   Opinion.state._pendingRewrite = null;
775   await sb…insert({ draft_data: committed });  // DB 영속(best-effort, 실패해도 catch)
777   Opinion.renderDetail();                  // 재렌더(best-effort)
778   return true;
```
- 773은 **동기·await 이전**이라, G1~G3를 통과하면 무조건 실행된다. `committed = pend.draftResult` 이고 그 `amended_claims[청구항5].amended` 에는 재작성문이 들어 있다(아래 §4). → **커밋되면 state.draftResult 가 재작성본이 된다.**

## 2. 보정서가 읽는 곳 (opinion.js:3846-3945) — 커밋 위치와 동일

```js
3855  var dr = Opinion.state.draftResult;           // ★ in-memory 우선(커밋된 것)
3856  if (!dr) { …DB reload만(state 있으면 reload 안 함)… }
3870  var html = Opinion._buildAmendmentDocxHtml(p, dr, …);
3898  var amendedArr = dr.amended_claims || dr.corrected_claims || (dr.merged_claim?[dr.merged_claim]:[]);
3944  amendedArr.forEach(ac => { var newText = ac.amended || ac.corrected || ac.text; … });  // 나.보정후
```
- 보정서 "나. 보정 후"는 **`state.draftResult.amended_claims[].amended`** 를 읽는다 — **confirmRewrite 가 커밋하는 바로 그 위치(773).** 구조 불일치 없음.
- download 는 `state.draftResult` 가 있으면 **DB reload 안 함**(3856) → 커밋된 in-memory 를 그대로 사용. (DB insert(775)가 실패해도 즉시 다운로드는 in-memory 라 반영됨.)

## 3. 재렌더 — D2c 버튼과 다름(보정서는 다운로드)

- confirmRewrite 는 renderDetail(777)을 부른다. 단 **보정서는 화면 렌더가 아니라 "보정서(Word)" 버튼 클릭 시 매번 새로 생성되는 다운로드**(downloadAmendmentDocx)다. 즉 재렌더 트리거 누락 문제(D2c 버튼 케이스)와 **무관** — 다운로드는 클릭할 때마다 `state.draftResult` 를 다시 읽는다.
- clobber 위험 점검: `state.draftResult` 를 DB로 덮어쓰는 유일한 reload 는 **loadData(4147-4173, 프로젝트 오픈 시)** 와 download 자체의 `!dr` 폴백(3856)뿐. **확정→다운로드 한 흐름 안에서는 둘 다 호출되지 않는다** → 커밋이 clobber 되지 않는다.

## 4. 게이트 차단 여부 — 버튼이 눌렸으면 차단 아님

- 모달 [확정] 버튼은 `blocked = !!(pend.gates && pend.gates.canConfirm===false)` 일 때만 **disabled + 리스너 미부착**(showRewriteConfirmModal:744,748-751). 사용자가 눌렀다면 `blocked=false` → `canConfirm !== false`.
- confirmRewrite 의 G2 검사도 **동일 식**(759). 따라서 버튼이 활성이었으면 G2도 통과한다(차단 불가). → §4 가설(청구항5가 비대상 불변 위반)은 **아님**(위반이면 canConfirm=false라 버튼이 애초에 비활성).

---

## ★ 그래서 어디가 끊겼나 — 런타임 2분기

구조가 옳으므로 남는 건 **"confirmRewrite 가 773까지 갔는가"** 뿐. 두 가지로 갈린다:

### 분기 A — confirmRewrite 가 773에 도달 못 함 (커밋 자체가 안 됨) · ★유력
- **A-1 [확정] 클릭이 confirmRewrite 를 호출 안 함.** [확정] 버튼은 [취소]와 달리 **인라인 onclick 이 없고 `addEventListener` 로만** 배선된다(showRewriteConfirmModal:748-751). 리스너가 안 붙거나 안 뛰면 클릭이 무반응 → 커밋 0.
  - **판별 텔(tell): [확정] 클릭 시 모달이 닫혔는가?** 모달은 `confirmRewrite().then(ok => if(ok) 모달제거)` 로만 닫힌다(750). **안 닫혔으면 confirmRewrite 가 안 돌았거나 false 반환** = 커밋 안 됨.
- **A-2 G1~G3 조기 반환.** `!pend`(보류본 소실) / `canConfirm===false`(버튼 활성이면 아님) / `!current`. 가장 가능성 있는 건 `_pendingRewrite` 가 어떤 이유로 null.

### 분기 B — 커밋은 됐는데 보정서가 옛 파일 (드묾)
- 773이 실행됐다면 in-memory state.draftResult 는 재작성본 → 그 직후 다운로드는 반영된다(§2). 그래도 안 보이면:
  - **B-1 다운로드 파일 혼동**: 파일명이 `보정서_{출원번호}_{날짜}.doc`(downloadAmendmentDocx) — 날짜만이라 같은 날 재다운로드 시 브라우저가 `(1)` 붙이거나, 사용자가 **이전(확정 전) 파일**을 열어봄.
  - **B-2 프로젝트 재오픈**: 확정 후 목록→재진입하면 loadData(4173)가 DB 최신 row 로 state.draftResult 재설정. DB insert(775)가 실패했으면 옛 draft 로 복귀(이 경우만 cross-reload 미반영). 한 세션 즉시 다운로드엔 무관.

---

## ★ console.log 권장 (사용자가 직접 [확정]→다운로드 후 콘솔 확인)

진단을 1분기/2분기로 가르는 최소 계측 — 아래를 임시로 넣고 [확정]→보정서 다운로드:

```js
// confirmRewrite 진입부(757 직후)
console.log('[D2 confirm] enter. pend?', !!Opinion.state._pendingRewrite,
  'canConfirm', Opinion.state._pendingRewrite && Opinion.state._pendingRewrite.gates && Opinion.state._pendingRewrite.gates.canConfirm,
  'targets', Opinion.state._pendingRewrite && Opinion.state._pendingRewrite.targetClaimNos);
// 각 guard 직후 return 전에: console.log('[D2 confirm] blocked at G1/G2/G3')
// 커밋 직후(773 다음)
console.log('[D2 confirm] COMMITTED. claim5.amended=',
  (Opinion.state.draftResult.amended_claims.find(c=>String(c.claim_no)==='5')||{}).amended);
// insert 결과(775)
.insert({…}).then(r=>console.log('[D2 confirm] db insert', r&&r.error||'ok'));
// downloadAmendmentDocx 진입(3855 다음)
console.log('[D2 dl] dr source=state? ', Opinion.state.draftResult===dr,
  'claim5.amended=', (dr.amended_claims.find(c=>String(c.claim_no)==='5')||{}).amended);
```
**판독:**
- "enter" 로그가 **안 찍히면** → A-1(클릭이 confirmRewrite 미호출). [확정] 버튼 배선 문제.
- "enter" 는 찍히는데 "COMMITTED" 안 찍히면 → A-2(어느 guard 에서 막힘 — blocked 로그로 G1/G2/G3 식별).
- "COMMITTED. claim5.amended=재작성문" 인데 "[D2 dl] claim5.amended=옛문언" → 커밋 후 clobber(B-2/reload) 또는 다운로드가 다른 dr.
- "[D2 dl] claim5.amended=재작성문" 인데도 파일에 옛 문언 → B-1(파일 혼동/캐시).

---

## 5. 해결책 (수정 안 함 — 권고)

- **A-1 이면(유력)**: [확정] 버튼을 [취소]처럼 **인라인 onclick 으로** 일원화하거나(예: `onclick="Opinion.confirmRewrite().then(...)"` 또는 `Opinion._confirmRewriteClick()` 래퍼), addEventListener 부착을 보강. 버튼 핸들링 단일화로 "클릭 무반응" 제거.
- **A-2 이면**: 막힌 guard 에 맞춰 — `_pendingRewrite` 소실 원인 추적(누가 null 로 만드는지) 또는 canConfirm 계산 점검.
- **B-1 이면**: 다운로드 파일명에 **시각(HHMMSS) 추가**로 구버전 혼동 제거 + 확정 후 토스트에 "보정서를 다시 다운로드하세요" 안내.
- **B-2 이면**: confirmRewrite 의 DB insert(775) 실패를 **조용히 삼키지 말고**(현재 `catch(_e){}`) 실패 시 경고 토스트 — cross-reload 미반영 방지.

> **권장 진행**: 먼저 위 console.log 로 A-1/A-2/B 를 가른 뒤, A-1(가장 유력 — [확정]이 addEventListener-only) 이면 버튼 배선 일원화로 수정. 구조는 옳으므로 **한 지점(클릭→confirmRewrite→773)만 이으면 반영된다.**

---

## 6. 한 줄 요약

커밋(773 state.draftResult)·보정서 read(3855→3944 ac.amended)·재렌더(777) 모두 정확하고 **같은 위치를 읽고 쓴다**(구조 불일치 없음). 보정서는 다운로드라 매번 state 를 다시 읽으므로 **커밋만 되면 반영된다.** 따라서 끊긴 곳은 **[확정] 클릭이 confirmRewrite 를 commit(773)까지 끌고 갔는지** 하나 — [확정]이 [취소]와 달리 addEventListener-only 라 **클릭 무반응(A-1)** 이 가장 유력하다. console.log "enter/COMMITTED/dl" 세 줄로 즉시 갈린다.
