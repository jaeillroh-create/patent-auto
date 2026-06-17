# 진단 — D2c "승인 방향 반영" 버튼 화면 미표시 (테스트 녹색인데 안 보임)

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-d2c-button-missing` · **READ-ONLY, 코드 수정 0**
> 증상: AI 검증 카드(renderOutput)에 [의견서 검증 시작][검증 결과 보기]만, "승인 방향 반영" 버튼 없음. 검증 7건 완주·승인 가능. 207 테스트 통과.

---

## 0. 결론 (한 줄)

**버튼 조건도 state도 정상이다. 끊긴 곳은 "승인 후 재렌더" 단 하나** — 승인(onChange)이 `review_amendments` 를 state에 **쓰지만 renderOutput 을 다시 그리지 않아**, 조건부 버튼(3780)이 채워진 state로 **재평가될 기회가 없다.** (배포 `?v=20260624` 로 버튼 코드는 이미 나가 있음 — 캐시 아님.)

---

## 1. 버튼 노출 조건 (opinion.js:3780)

renderOutput AI 검증 카드:
```js
3780  +(Opinion._collectApprovedDirections(Opinion.state.draftResult||{}).length
3781      ? '<button ... id="btnDirectionRewrite" onclick="Opinion.startDirectionRewrite()">승인 방향 반영 …</button>'
        : '')
```
- 즉 **`_collectApprovedDirections(state.draftResult).length > 0` 일 때만** 버튼 HTML이 생성된다.
- `_collectApprovedDirections`(503)는 `ac.review_amendments[].direction`(비어있지 않은 것)을 수집한다.
- 이 HTML은 **renderOutput 이 호출되는 순간에만** 평가된다(조건부 문자열 결합). 한 번 그린 뒤 state가 바뀌어도 **자동으로 다시 그려지지 않는다.**

---

## 2. 승인 상태 영속 — state는 정상(불일치 아님)

승인 핸들러 `onChange`(opinion.js:872):
```js
872  onChange: function(rs){
873    var acc = (rs.patchPlans||[]).filter(pp => pp.accepted === true);
874    if (acc.length) { Opinion.applyAmendments(acc); }   // ← review_amendments 를 state.draftResult 에 기록
877    Opinion._persistReviewDecision(rs);                 // ← review_runs.result UPDATE
878  }                                                      // ★ renderDetail/renderOutput 호출 없음
```
`applyAmendments`(444)가 승인 op를 구조적으로 기록·커밋:
```js
457  var amended = working.amended_claims || …;               // 같은 배열
468  ac.review_amendments.push({ op:op.op, direction: op.content||'', …});  // direction = op.content
495  working.amended_claims = amended;                        // 같은 배열을 커밋
498  Opinion.state.draftResult = working;                     // ★ state.draftResult 갱신(review_amendments 포함)
```
- **버튼이 읽는 곳**(3780 `Opinion.state.draftResult`) = **승인이 쓰는 곳**(498 `Opinion.state.draftResult`). **동일 객체 — 상태 불일치 없음.**
- 즉 승인 직후 `_collectApprovedDirections(state.draftResult)` 는 **이미 비어있지 않다**(버튼이 떠야 정상). 다만 **그 시점에 renderOutput 이 다시 그려지지 않을 뿐.**

---

## 3. ★ renderOutput 재렌더 — 이게 끊긴 지점

`runReviewEngine`(792)의 재렌더는 **검증 완료 시 1회**:
```js
817  Opinion.state.reviewState = result;      // "검증 결과 보기" 발화 조건
818  Opinion.renderDetail();                  // ← 여기서 renderOutput 재렌더 (승인 전!)
819  Opinion.openReviewModal();               // 모달 오픈
```
**시퀀스:**
1. "의견서 검증 시작" → runReviewEngine → 검증 완료.
2. **818 renderDetail()** → renderOutput 재렌더. **이때 review_amendments 비어있음**(승인 전) → 버튼 조건 false → **버튼 안 그림.** reviewState 존재 → "검증 결과 보기"는 그림.
3. 819 모달 오픈 → 변리사가 plan 승인 → **onChange(872)** → applyAmendments(state에 review_amendments 기록) + persist. **renderDetail 없음.**
4. 모달 닫음 → renderOutput 은 2단계 상태 그대로(버튼 없음). **승인 후 재렌더 0.**

`_reviewModalOpts`(869)는 `{ actor, onChange }` **뿐** — `onClose`·`onApprove` 등 **재렌더 훅이 없다**. 모달 닫힘도 renderDetail 을 부르지 않는다.

→ **review_amendments 가 채워진 뒤 renderOutput 이 다시 그려지는 경로가 아예 없다.** 그래서 조건은 true가 되었지만 DOM에 버튼이 나타날 기회가 없다.

---

## 4. 왜 테스트는 녹색인가

`d2c`/`d1` 테스트는 `_collectApprovedDirections`·`startDirectionRewrite`·`confirmRewrite` 를 **state를 미리 채운 뒤 직접 호출**한다(렌더 흐름 미경유). 그래서 함수 로직은 전부 통과한다. 화면은 **이벤트→렌더 트리거** 사슬이 끊겨 함수가 호출될 화면 진입점(버튼)이 안 생긴다. **"함수 OK, 흐름 끊김"의 전형.**

---

## 5. 보조 확인 — 방향(op.content) 존재 여부

`review_amendments.direction = op.content`(470). 만약 승인된 plan의 op에 `content`(보정 방향)가 비어 있으면, 재렌더를 고쳐도 `_collectApprovedDirections` 가 빈 배열 → 버튼 여전히 숨김. (rebut→compiler→op.content 경로로 방향이 채워져야 함.) → **재렌더 수정 후에도 안 뜨면, 승인 op의 content 유무를 2차로 확인**(현재 증상의 1차 원인은 §3 재렌더).

---

## 6. 해결책 (수정 안 함 — 권고)

| 우선 | 조치 | 효과 | 비고 |
|---|---|---|---|
| ★1 | **승인 후 renderOutput 재렌더** — `onChange`(878)에서 applyAmendments 뒤 `Opinion.renderDetail()` 호출 | 승인 즉시 버튼 조건 재평가 → 모달 닫으면 버튼 노출 | AC-T1 안전(클라 렌더, edge 재검증 아님). 단 onChange 가 토글마다 발화 → 매 토글 재렌더(모달은 위에 떠 있어 무해, 다소 낭비) |
| ★1' | **모달 닫힘 1회 재렌더** — ReviewUI 모달에 `onClose` 훅 추가 → `_reviewModalOpts` 가 renderDetail 1회 | 승인 완료(모달 닫기) 시 1회만 재렌더(깔끔) | ReviewUI(opinion-review-panel) 측 onClose 지원 필요 |
| 2 | **버튼 항상 렌더(조건 제거)** + 클릭 시 빈 방향 가드 | 렌더 타이밍 의존 제거(버튼 상시 노출). applyDirectionRewrite 가 이미 "반영할 승인 방향 없음" 토스트(544) | 검증 전에도 버튼 보임(경미한 UX). 가장 견고하게 "보이게" 만듦 |
| 2' | **버튼 항상 렌더 + length===0 시 disabled** | 존재는 보이되 비활성 | 활성화엔 여전히 §1 재렌더 필요 |
| 3 | op.content(방향) 유입 확인 | 재렌더 고쳐도 빈 방향이면 무의미 차단 | §5 — 2차 검증 |

- **권장 조합: ★1'(모달 닫힘 1회 재렌더) 또는 ★1(onChange 재렌더) + (선택)2(상시 렌더로 발견성↑).** 최소 한 줄 수정은 **★1**(onChange 에 renderDetail 추가).
- 근본은 "**승인이 state를 바꾸면 그 state를 읽는 화면을 다시 그린다**"는 트리거를 잇는 것. state·조건은 이미 옳다.

---

## 7. 한 줄 요약

버튼 조건(3780)·state(498)·`_collectApprovedDirections`(503) 전부 정상이고 **동일 state.draftResult** 를 읽고 쓴다. **유일한 결함은 승인(onChange:872) 후 renderOutput 을 다시 그리지 않는 것** — 채워진 state로 조건부 버튼이 재평가될 기회가 없다. runReviewEngine 의 renderDetail(818)은 **승인 전**이라 그때는 조건 false. 고치려면 **승인 후(또는 모달 닫힘 시) renderDetail 1회**를 이으면 된다.
