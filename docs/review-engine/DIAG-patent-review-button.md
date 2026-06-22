# DIAG — patent "출원 전 검증 시작" 버튼 무반응 (배선 정상, 토글 게이트가 조용히 차단)

> 브랜치: `review-engine/diag-patent-review-button` · 코드 변경 0 (진단 문서만)
> 증상: F.산출물 탭의 "출원 전 검증 시작" 버튼이 떴고 클릭되는데 **아무 동작 없음**. supabase 재배포·T1(#192) 머지됨.
> 결론 한 줄: **버튼 배선은 정상(D2c식 바인딩 불일치 아님). `runReviewEngine` 의 첫 게이트가 `ReviewUI.isEnabled('patent')===false` 라 조용히 return null 한다. 원인은 단 하나 — `review-engine/index.js:28` 의 `FEATURE_FLAGS.modules.patent: false`. T1 은 러너를 고쳤지만 patent 모듈 토글은 여전히 OFF(미검증 모듈 차단 기본값)였다. 해결 = `patent: true` (1줄) + ESM 캐시버스트.**

---

## 0. 끊긴 곳 — 한눈에

| 사슬 단계 | 상태 | 근거 |
|---|---|---|
| 버튼 핸들러(onclick) | ✅ 정상 | `index.html:1266` `onclick="Patent.runReviewEngine()"` (정적 인라인) |
| 함수 정의/스코프 | ✅ 존재 | `patent.js:14005` `Patent.runReviewEngine = async function` (전역) |
| 러너 연결(T1) | ✅ 연결됨 | `runReviewEngine` → `Patent._defaultReviewRunner`(비동기, #192) |
| **토글 게이트** | ❌ **차단(조용히)** | `runReviewEngine` (1) `patent.js:14008` → `ReviewUI.isEnabled('patent')` = **false** |
| 원인 | ❌ **flag OFF** | `review-engine/index.js:28` `modules.patent: false` |

→ **버튼·함수·러너 전부 멀쩡. 끊긴 곳은 "patent 모듈 feature flag".**

---

## 1. 버튼 배선 (onclick → 함수 → 러너) — 정상

```html
<!-- index.html:1266 -->
<button class="btn btn-primary btn-full" id="btnPatentReview"
        onclick="Patent.runReviewEngine()">… 출원 전 검증 시작</button>
```
- **정적 인라인 onclick** → `Patent.runReviewEngine()` (전역, `patent.js:14005` 정의).
- ★ **opinion D2c 무반응(addEventListener vs inline 바인딩 불일치)과 다르다** — 여기는 인라인 onclick + 함수 존재라 **핸들러는 확실히 발화**한다. 바인딩 문제 아님.
- 버튼 활성/비활성은 `_updateReviewGate`(`patent.js:13993`)가 **4종 게이트(`gate.ok`)만으로** 결정(토글 무관, 주석 13992: "토글 OFF: 버튼은 두되 눌러도 무동작"). → **버튼이 떠서 클릭되지만, 클릭은 토글 게이트에서 막힌다.**

---

## 2. 조용히 끊기는 정확한 지점 (silent return null)

`Patent.runReviewEngine` (`patent.js:14005`)의 게이트 순서:
```js
14008  // (1) 토글 OFF → 무동작(E-21)
       if (!(window.ReviewUI && typeof window.ReviewUI.isEnabled === 'function'
             && window.ReviewUI.isEnabled('patent'))) {
         return null;                 // ★ 토스트·콘솔 0 — 완전 무증상
       }
14012  // (2) 필수 4종 게이트 → 미충족이면 토스트(가시) + return
14019  // (3) 비용 확인 confirm → 취소면 return
       ... 이후 러너 발화
```
- **게이트(1)이 가장 먼저, 그리고 유일하게 "조용한" return** 이다. (2)는 토스트, (3)은 confirm 창이라 사용자가 본다.
- 사용자 증상("눌러도 아무것도 안 뜸") = **게이트(1) silent return** 과 정확히 일치.

### `isEnabled('patent')` 추적
```
ReviewUI.isEnabled('patent')                       // ui/opinion-review-panel.js:227
  → isModuleEnabled('patent')                      // review-engine/index.js:38
  → FEATURE_FLAGS.reviewEngine(true) && FEATURE_FLAGS.modules['patent']===true   // index.js:39-41
```
```js
// review-engine/index.js:26-29
export const FEATURE_FLAGS = {
  reviewEngine: true,
  modules: { opinion: true, division: false, patent: false },   // ★ patent: false
};
```
→ **`modules.patent === false`** ⇒ `isModuleEnabled('patent')` = false ⇒ 게이트(1) return null.
- opinion 버튼이 되는 이유: `opinion: true`(하드코딩). patent 만 `false`.
- 이 값은 **의도된 기본값**(주석 21-22: "미검증 모듈(division/patent: 프롬프트 본문·라이브 검증 미완)이 마스터 ON 시 동시 활성화되는 것을 구조적으로 차단"). T1(#192)이 patent 러너를 비동기로 고쳐 **이제 켤 준비가 됐는데**, flag 를 안 켰을 뿐.

### 런타임 토글 UI 없음 (코드 상수)
- `FEATURE_FLAGS.modules.patent` 를 **런타임에 바꾸는 UI/핸들러가 저장소에 0건**(정의·읽기만 존재, 대입 없음). 즉 토글은 코드 상수다. opinion=true 도 하드코딩이라 켜진 것.
- ∴ patent 활성화는 **코드 1줄 변경**이 필요(설정 화면에서 못 켬).

---

## 3. 해결책

### (수정안, 별도 PR) `review-engine/index.js:28`
```js
-  modules: { opinion: true, division: false, patent: false },
+  modules: { opinion: true, division: false, patent: true },
```
- **Edge 무관**(클라 ESM 플래그). #187/.md/스키마/kernel 불변.
- ★ **ESM 캐시버스트 주의**: `opinion-review-panel.js` 가 `import { isModuleEnabled } from '../index.js'`(쿼리 없음)로 가져오므로, 패널 `?v=`(현재 `20260618`)만 올려선 브라우저가 캐시된 `index.js` 를 그대로 쓸 수 있다. 확실히 반영하려면 **import 에 `?v=` 부여**(예: `'../index.js?v=YYYYMMDD'`) 또는 패널 버전과 함께 index.js fetch URL 변경이 필요(수정 시 점검).
- 켠 직후 게이트(2)(4종)·(3)(비용 confirm)이 정상 작동 → 러너(T1 비동기) 발화 → 폴링 → 결과 모달.

### (선택) 게이트(1) 무증상 완화
지금은 토글 OFF 시 완전 무반응이라 "버튼이 고장난 것처럼" 보인다. 토글 OFF인데 버튼이 활성일 때 **info 토스트**("출원 전 검증은 현재 비활성화 상태입니다")를 띄우면 무증상 혼란이 준다(부가 개선, 필수 아님).

---

## 4. ★ 사용자 F12 콘솔로 확정 (코드 0)

```js
// (1) 가장 결정적 — patent 토글 상태
window.ReviewUI.isEnabled('patent')   // 예상: false  ← 이게 원인
window.ReviewUI.isEnabled('opinion')  // 예상: true   ← 대조(opinion 은 됨)

// (2) 버튼 핸들러·함수 존재 확인(배선 정상 입증)
typeof Patent.runReviewEngine          // 예상: 'function' (미정의 아님)
document.getElementById('btnPatentReview').getAttribute('onclick')  // "Patent.runReviewEngine()"

// (3) 버튼 클릭 직접 호출 → 반환값 관찰
await Patent.runReviewEngine()         // 예상: null (게이트(1)에서 조용히 종료)
```
**해석:**
- (1)에서 `patent=false, opinion=true` 면 → **flag OFF 확정**(본 진단). ★ 콘솔에 **빨간 에러 없음**(throw 아닌 silent return) — "is not a function" 류가 없다는 것 자체가 "함수 미정의/바인딩 문제 아님 + 토글 게이트" 를 확정한다.
- 임시 검증(런타임 강제 ON, 콘솔):
  ```js
  // ESM 내부 FEATURE_FLAGS 는 window 에 없으니, isEnabled 를 직접 패치해 가게이트만 통과시켜 동작 확인:
  const _orig = window.ReviewUI.isEnabled;
  window.ReviewUI.isEnabled = (m) => m === 'patent' ? true : _orig(m);
  await Patent.runReviewEngine();   // → 4종/비용 게이트 후 실제 검증(비동기) 발화하면 = flag 만 문제였음
  window.ReviewUI.isEnabled = _orig; // 복원
  ```
  이게 검증을 발화시키면 → **원인은 100% flag**, 수정은 index.js 1줄.

---

## 5. 핵심 질문 — 코드로 답
1. **버튼 클릭이 검증 함수를 호출하나** → ✅ 호출함. `index.html:1266` onclick → `Patent.runReviewEngine()`(14005). 인라인이라 발화 확실.
2. **호출 함수가 존재하나** → ✅ 존재(전역). "is not a function" 아님.
3. **T1 러너에 버튼이 연결됐나** → ✅ 연결됨(runReviewEngine→_defaultReviewRunner). **단 러너 도달 전 게이트(1)에서 차단.**
4. **F12 콘솔 에러** → ❌ 에러 없음(silent return null). 그래서 무증상. 결정타는 `ReviewUI.isEnabled('patent')===false`.

**요지: 끊긴 곳은 버튼도 함수도 러너도 아니다 — `FEATURE_FLAGS.modules.patent:false`(index.js:28) 라 `runReviewEngine` 게이트(1)이 조용히 막는다. T1 이 러너를 켤 준비를 끝냈으니, 이제 flag 를 `true` 로(+ESM 캐시버스트) 켜면 된다. F12 `ReviewUI.isEnabled('patent')` 한 줄로 확정.**
