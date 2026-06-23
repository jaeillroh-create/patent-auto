# DIAG — patent [확정(명세서 반영)] 버튼 비활성 (E-11 게이트 과차단)

> 브랜치: `review-engine/diag-patent-confirm-disabled` · READ-ONLY 진단(코드 0)
> 결론 한 줄: **[확정] 비활성은 추가 단락의 부호(127·128·130) 때문이 아니다.** E-11 게이트(`_reviewRenderCheck`)는 **상세설명(step_08)을 아예 읽지 않고**, 오직 **도면(step_07/11_mermaid)의 부호 ⊆ 부호의 설명(step_18)** 만 본다. 즉 `canConfirm=false` 는 **이 보정과 무관한, 프로젝트에 원래 있던 "도면↔부호의 설명 불일치"** 때문이며, 게이트가 그 절대 상태로 차단해 **무해한 APPEND까지 막는 과차단**이다.

---

## 1. 증상 (사용자 보고)

- [반영하기] → 비교 모달 ✅ / 뒷받침 단락 생성(부호 127·128·130) ✅ / 기존 명세서 "변경 없음·접두 보존" ✅
- ★ **[확정 (명세서 반영)] 버튼 비활성(회색)**
- 승인 후 X로 닫는 흐름(안내 부재)

---

## 2. 핵심 질문 — 직답

| 질문 | 답 |
|------|----|
| `canConfirm=false` 정확한 조건 | `_reviewRenderCheck`의 `missing` 이 비어있지 않음 = **도면(step_07/11_mermaid) 부호 중 부호의 설명(step_18)에 없는 게 1개라도 있음** (patent.js:14161,14303) |
| E-11이 추가 단락 부호를 신규로 오판? | **아니오.** 게이트는 **step_08(상세설명)을 읽지 않는다.** 추가 단락 부호(127·128·130)는 게이트 입력이 아예 아님 (14159–14160) |
| 기존 도면 부호(127,128)인데 왜 막나 | 127·128은 **추가 단락(step_08)** 의 부호 — 게이트는 이걸 **안 봄**. 막는 주체는 **도면(mermaid)에는 있는데 부호의 설명에 없는 "다른" 부호**(배너의 `missing` 참조) |
| 게이트가 과한가 | **그렇다.** APPEND는 도면·부호 입력을 한 글자도 안 건드리므로 정합에 **구조적 무영향**. 그런데 **절대 상태**로 차단 → "정합인데 차단"이 아니라 **"무관한 기존 불일치로 차단"** (과차단) |

---

## 3. 코드 추적 (file:line)

### 3-1. canConfirm 계산 — 추가 단락은 입력이 아니다

```
patent.js:14295  var checkO = Object.assign({}, outputs, pending);   // pending = {step_08: APPEND본, step_12}
patent.js:14296  var rc = Patent._reviewRenderCheck(checkO);
patent.js:14303  canConfirm: !!(rc.svg && rc.pptx && rc.canvas),     // 셋 다 true 여야 [확정] 활성
```

`checkO` 에 APPEND된 step_08 이 들어가지만, 정작 `_reviewRenderCheck` 는 **step_08 을 읽지 않는다**:

```
patent.js:14159  var diagram = Object.assign({}, refsOf(o.step_07_mermaid), refsOf(o.step_11_mermaid)); // 도면만
patent.js:14160  var signs   = refsOf(o.step_18);                                                       // 부호의 설명
patent.js:14161  var missing = Object.keys(diagram).filter(r => !signs[r]);  // 도면 부호 − 부호의설명
patent.js:14162  var ok = missing.length === 0;
```

→ `refsOf` 가 보는 건 `step_07_mermaid`·`step_11_mermaid`·`step_18` **세 개뿐**. `checkO.step_08`(추가 단락)은 **스캔 대상이 아님**.
→ 따라서 `rc` 는 **APPEND 전/후가 동일**(`outputs` 의 도면·부호만으로 결정). 추가 단락의 127·128·130 은 `canConfirm` 에 **영향 0**.

### 3-2. 코드가 스스로 인정 — "무영향이나 방어적 실행"

```
patent.js:14294  // ★ E-11 도면 정합 게이트 — pending 섹션 덮어 검사
                 //   (상세설명 APPEND 는 부호 정합 무영향이나 방어적 실행).
```

주석이 직접 "상세설명 APPEND 는 부호 정합 **무영향**" 이라 적고도, **방어적으로 절대검사**를 돌려 그 절대 결과로 [확정]을 막는다 → **과차단의 출처**.

### 3-3. [확정] disabled 배선 + 배너

```
patent.js:14370  var blocked = pend.canConfirm === false;
patent.js:14379  ...id="btnPatentRewriteConfirm" ... + (blocked ? ' disabled title="도면 부호 정합 위반 — 확정 불가"' : '')
patent.js:14337  ⛔ 도면 부호 정합 위반(부호의 설명에 없는 도면 부호 {pend.renderCheck.missing.slice(0,5)}) — 확정 불가(E-11).
```

★ 배너의 `{missing}` 은 **도면에 있는데 부호의 설명에 없는 부호** — **127·128·130 이 아니다.** 사용자가 봐야 할 진짜 누락 부호가 거기 찍혀 있다(그게 곧 차단 원인).

### 3-4. 생성기는 새 부호 금지 지시를 이미 받음

```
patent.js:14226  2. 기존 상세설명의 문체·용어·도면부호와 정합되게 작성한다(★ 새 도면부호 도입 금지 — 부호의 설명 정합 유지).
```

→ 127·128·130 은 (지시상) **기존 부호**일 가능성이 높고, 설령 신규라도 게이트가 step_08 을 안 보므로 차단과 무관.

---

## 4. 왜 막히나 — 정확한 메커니즘

```
프로젝트 원래 상태:  도면(step_07/11_mermaid)에 부호 {…, X} 존재,  부호의 설명(step_18)엔 X 누락  ← 기존 불일치
                                   │
[반영하기] → applyDirectionRewrite → step_08 에만 단락 APPEND(도면·부호 불변)
                                   │
_reviewRenderCheck(checkO):  diagram(step_07/11) − signs(step_18) = {X}  → missing=[X] ≠ []
                                   │
canConfirm = false  →  [확정] disabled  ←  ★ APPEND와 무관한 기존 X 때문
```

- **차단 원인 = 기존 도면↔부호 불일치(X).** 추가 단락이 만든 것도, 고칠 수 있는 것도 아니다(상세설명 보강은 도면·부호를 안 건드림).
- 게이트가 **"이 변경이 새 불일치를 유발했나"(delta)** 가 아니라 **"현재 절대 정합이 완벽한가"** 를 물어서, 기존 결함이 **무관한 보정**을 볼모로 잡는다.

---

## 5. 사용자 콘솔 확인 (진짜 누락 부호 확인)

비교 모달이 떠 있는 상태(보류본 존재)에서:

```js
// (1) 차단의 진짜 원인 — 도면엔 있는데 부호의설명에 없는 부호(127/128/130 아님)
Patent._pendingPatentRewrite.renderCheck.missing;     // 예: ['45','210'] 같은 도면 부호

// (2) 보정과 무관함을 증명 — APPEND 전 현재 outputs 로도 같은 missing
Patent._reviewRenderCheck();                          // missing 동일(보정 전부터 불일치)

// (3) 어디서 비롯되나 — 도면 부호 vs 부호의 설명 차집합
[outputs.step_07_mermaid, outputs.step_11_mermaid].join('\n').match(/\((\d{2,4})\)/g);  // 도면 부호들
outputs.step_18;                                       // 부호의 설명(여기 빠진 게 missing)
```

- (1)의 값이 **127·128·130 이 아니라 다른 번호**면 → 추가 단락과 무관(본 진단 확정).
- (2)가 (1)과 같으면 → **보정 전부터 있던 기존 불일치**(게이트 과차단 확정).

---

## 6. 해결 방향 (제안만 — 코드 0)

핵심: **APPEND는 도면·부호 입력을 안 건드리므로 부호 정합을 후퇴시킬 수 없다.** 게이트를 절대→delta 로 바꾸거나 면제한다.

- **F1 (권장) — delta 게이트.** `canConfirm` 을 `_reviewRenderCheck(before)` 대비 **새 missing 이 늘었는지**로 판정.
  `var rcBefore = _reviewRenderCheck(outputs); canConfirm = rcAfter.missing.every(m => rcBefore.missing.includes(m))`(= 새 누락 0).
  APPEND는 입력 불변이라 `rcAfter.missing === rcBefore.missing` → **항상 통과**. 미래에 도면/청구항을 건드리는 op(narrow_scope·fix_ref_sign)엔 regression 차단을 그대로 유지(게이트 의미 보존).
- **F2 — add_spec_support 게이트 면제.** 상세설명 전용 op 는 도면·부호에 구조적 무영향 → `canConfirm=true` 고정. 가장 단순.
- **F3 — 경고로 강등(비차단).** 기존 도면↔부호 불일치는 **확정 차단이 아니라 경고 배너**로: "이 보정과 무관한 기존 도면↔부호 불일치 N건 — 별도로 부호의 설명을 보강하세요." 확정은 허용.
- **메시징 교정(공통).** 현 배너 "부호의 설명에 없는 도면 부호 {missing}" 가 사용자에겐 **추가 단락 부호로 오해**된다. "**이 보정과 무관한 기존** 도면↔부호 불일치"임을 명시하고, 보강 위치(F1·F2 탭의 부호의 설명)를 안내.

> 권장: **F1(delta)** — 게이트의 원래 의도(보정이 렌더를 깨면 차단)는 살리되, 무관한 기존 결함이 무해한 APPEND를 막는 과차단만 제거. add_spec_support 는 항상 통과하게 된다.

---

## 7. 승인 후 흐름 안내 (X로 닫는 문제)

### 현 흐름 (단절 지점)
```
검증 결과 모달(openReviewModal, patent.js:14064) — 여기서 plan [승인]/[거부]
        │  (모달엔 "다음/반영" 버튼 없음 — 승인 후 갈 곳 안내 부재)
        ▼  사용자가 X(또는 외부클릭)로 모달 닫음
산출물(page4) 탭 → patent-review-mount(renderPreview:13872) 에 [반영하기] 버튼  ← 여기로 와야 함
        ▼
[반영하기] → 비교 모달 → [확정]
```

- 승인은 **검증 결과 모달**에서, [반영하기]는 **page4 산출물 탭**에서. **둘이 다른 위치**인데 모달에 "승인 완료 → 닫고 [반영하기]" 안내가 없다 → 사용자가 X로 닫고 다음 단계를 못 찾음.

### 개선(제안)
- 검증 결과 모달 하단에 안내 문구/버튼: "승인 완료 — 모달을 닫고 [산출물] 탭의 **[승인 방향 반영]** 을 누르세요" (또는 모달 내에 [반영하기] 직접 노출).
- 승인 onChange 시 토스트: "N건 승인 — [산출물] 탭에서 [반영하기]로 명세서에 반영하세요."

---

## 8. 참조 (file:line)

- canConfirm 계산: `patent.js:14295–14303` · 게이트 본체 `_reviewRenderCheck`: `:14150–14164`(step_08 미스캔: 14159–14160)
- "무영향이나 방어적 실행" 주석: `:14294`
- [확정] disabled 배선: `:14370, :14379` · 배너(missing 표시): `:14337` · 확정 거부 토스트: `:14392`
- 생성기 새 부호 금지 지시: `:14226`
- 승인 모달 오픈: `:14064` · [반영하기] 마운트(page4): `:13872`
