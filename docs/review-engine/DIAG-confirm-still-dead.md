# 진단 — [확정] A-1 수정 후에도 무반응

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-confirm-still-dead` · **READ-ONLY, 코드 수정 0**
> 증상: A-1(인라인 onclick) 적용 후에도 [확정] 무반응(모달도 안 닫힘).

---

## 0. 결론 (한 줄)

**A-1 코드는 정확하고 main(?v=20260626)에 배포됐다 — 인라인 onclick 스코프는 정상.** 그래서 "여전히 안 됨"의 원인은 코드가 아니라 **(가) 브라우저가 구버전 opinion.js 를 캐싱**하거나 **(나) 게이트 차단(canConfirm=false)로 버튼이 disabled** 둘 중 하나다. **F12 콘솔 + 모달 배너 색**이 즉시 가른다.

---

## 1. ?v= / 배포 — A-1 은 이미 main 에 있다

- `origin/main:index.html` → `opinion.js?v=20260626` (A-1 #183 머지됨).
- `origin/main:opinion.js` → `_confirmRewriteClick` 정의 + 버튼 `onclick="Opinion._confirmRewriteClick()"` 존재(744).
- ⚠️ **함정: `?v=` 갱신은 브라우저가 새 index.html 을 받을 때만 효과.** index.html 자체가 캐시되면 브라우저는 **옛 `?v=`(또는 더 옛 버전)** 를 계속 요청 → **옛 opinion.js 로드**. GitHub Pages 는 index.html 에 캐시 TTL 이 있어 배포 직후 수 분간 옛 버전이 갈 수 있다. → **하드 리프레시(Ctrl+Shift+R) 필요.**

## 2. 인라인 onclick 스코프 — 정상 (가설 2/3 배제)

- `opinion.js:7` **`window.Opinion = window.Opinion || {}`** → Opinion 은 **전역(window.Opinion)**.
- `opinion.js:784` **`Opinion._confirmRewriteClick = function(){…}`** → 전역 Opinion 에 붙음 → 인라인 `onclick="Opinion._confirmRewriteClick()"` 가 전역에서 찾을 수 있음.
- **동일 패턴이 20+개 작동 중**: `onclick="Opinion.downloadAmendmentDocx()"`, `Opinion.openReviewModal()`, `Opinion.cancelRewrite()`, `Opinion.runReviewEngine()` … (사용자가 실제로 누르는 버튼들). → **인라인 `onclick="Opinion.xxx()"` 패턴은 작동한다.** [확정]도 같은 형태이므로 스코프 문제 아님.
- 즉 **[취소]가 되면 [확정]도 된다**(둘 다 `onclick="Opinion.xxx()"`, 같은 전역). 스코프 차이 없음.

## 3. ★ 그럼 왜 여전히 안 되나 — 두 후보 (둘 다 pre/post A-1 공통)

A-1 코드가 옳으므로 "여전히 안 됨"은 다음 둘 중 하나. **둘 다 pre-A-1(addEventListener)·post-A-1(inline) 모두에서 동일하게 [확정]을 죽인다** → "수정 전후 둘 다 안 됨"과 정합:

### (가) 구버전 캐싱 · ★유력
- 브라우저가 **옛 opinion.js**(A-1 이전, addEventListener 버전 또는 D2c 버전)를 로드 중. index.html 캐시로 `?v=20260626` 을 아직 안 받음.
- 이 경우 버튼은 옛 배선(addEventListener) 또는 더 옛것 → 클릭 무반응.

### (나) 게이트 차단(canConfirm=false) → 버튼 disabled
- 버튼은 `blocked = (gates.canConfirm===false)` 일 때 **`disabled`**(744). disabled 버튼은 **인라인 onclick 도, addEventListener 도 발화 안 함** → pre/post A-1 모두 무반응.
- 이 경우 모달에 **빨강 "⛔ 무결성 위반" 배너**가 뜨고 [확정]이 회색이다(_buildRewriteDiffHtml). → 게이트가 비대상 drift 를 (잘못?) 잡은 것.

---

## ★ F12 콘솔 + 배너 — 사용자가 [확정] 클릭 시 확인 (결정적)

| 관찰 | 원인 | 해결 |
|---|---|---|
| 콘솔 **`Opinion._confirmRewriteClick is not a function`** | 옛 opinion.js 캐싱(그 함수 없음) + 새 onclick | **(가)** 하드 리프레시 |
| 콘솔 **에러 없음** + 모달 **빨강 ⛔ 배너** + [확정] **회색(disabled)** | **(나)** canConfirm=false 게이트 차단 | 게이트 오판 별도 조사(아래 §5) |
| 콘솔 **에러 없음** + 모달 **초록 ✅ 배너** + 버튼 정상인데 무반응 | 옛 JS(addEventListener 미발화) 로드 | **(가)** 하드 리프레시 |
| 콘솔 **다른 에러**(confirmRewrite 내부) | 런타임 예외 | 에러 스택으로 특정 |

- **추가 확인(가 캐싱)**: F12 → Network → opinion.js 의 요청 URL 이 **`?v=20260626`** 인지. 아니면(옛 v) index.html 캐시 → 하드 리프레시 / 캐시 비우기.
- **추가 확인(나 게이트)**: 모달 상단 배너가 빨강(⛔)인지 초록(✅)인지. 빨강이면 canConfirm=false.

---

## 4. 가장 가능성 (왜 pre·post 둘 다 죽었나)

- **post-A-1 도 안 된다면**, 코드가 옳으므로 **(가) 캐싱**이 가장 유력(브라우저가 A-1 을 아직 로드 안 함). "비교 모달은 정상"이었다면 최소 D2c 버전은 로드됐다는 뜻이라, **opinion.js 가 D2c(또는 그 이전)에서 캐시 고정**됐을 수 있다.
- 동시에 **(나) 게이트 차단**도 배제 불가 — 이 경우 D2c·A-1 무관하게 버튼이 늘 disabled. **배너 색 한 번으로 (가)/(나) 가 갈린다.**

## 5. 해결책 (수정 안 함 — 권고)

1. **먼저 (가) 캐싱 제거**: 하드 리프레시(Ctrl+Shift+R) + F12 Network 로 `opinion.js?v=20260626` 로드 확인. (index.html 캐시가 근본이면, 향후 배포 시 사용자에게 하드 리프레시 안내가 필요.)
2. **(나) 게이트면**(빨강 ⛔ 배너): `_gatePendingRewrite` 의 비대상 불변 검사가 **정상 케이스를 drift 로 오판**하는지 조사 — canConfirm=false 면 버튼이 영구 disabled 라 D2 가 작동 못 함. (별도 진단/수정 대상.)
3. **항구적 보강(선택)**: disabled 버튼은 클릭 피드백이 없어 "무반응"으로 보임 → 차단 시 **버튼을 disabled 대신 활성+클릭 시 사유 토스트**로 바꾸면 사용자가 "왜 안 되는지" 인지. (별도.)

---

## 6. 한 줄 요약

A-1(인라인 onclick) 코드는 정확하고 배포됐다(?v=20260626, window.Opinion 전역, 동일 패턴 20+개 작동). 스코프 문제 아님. "여전히 안 됨"은 **(가) 구버전 캐싱**(하드 리프레시) 또는 **(나) canConfirm=false 게이트 차단(버튼 disabled)** — **F12 콘솔 메시지 + 모달 배너 색(초록/빨강)** 한 번으로 즉시 갈린다. "_confirmRewriteClick is not a function" 이면 캐싱, "빨강 ⛔ 배너+회색 버튼"이면 게이트.
