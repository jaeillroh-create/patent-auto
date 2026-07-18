# DIAG — 세션 누적 상호작용 감사 (PR #224~#233)

> **작성:** 2026-07-18 · **기준:** main `59bf67d` (#233 머지 후, baseline 701 그린) · **범위:** patent/modules 00~09 + index.html
> **성격:** READ-ONLY 진단. 코드 수정 0, PR 없음(§5 규약). 발견 이슈는 §후속으로 재일 보고.
> **목적:** 개별 PR은 각각 검증·머지 완료. 이 감사는 그 위 층위 — 7개(실제 10개) PR이 서로/기존 코드와 **연계 문제·모순·중복·오류**를 만드는지 전수 조사.

## 결론 (선요약)

**이번 세션 10개 PR의 누적 상호작용에서 연계 문제·모순·중복·오류 없음 — 확인함.**
예비조사(대화 세션) CROSS-1~4 판정 전부 **CC 독립 재현으로 일치**. 신규 결함 0. 부수 발견 2건(모두 긍정/정보성): ① #233 P3가 편집→sanitize 파이프라인의 잠재 본문소실을 부수적으로 해소(긍정), ② Item5 CHK-5(HIGH)가 Item3 게이트에 의도대로 계층 참여(일관). 화면 검증 미완(§말미).

## 판정표

| 항목 | 판정 | 심각도 | 근거 |
|------|------|--------|------|
| A 검증기 CHK 이중계상/모순 | ✅ 문제없음 | — | 6a/6b hasParaDup 가드·check 분리·severity 비충돌 |
| B 청구범위/요약서 경계 일관성 | ✅ 문제없음 | — | _bodyBeforeClaims min-cut·실제 완성본 0이슈 |
| C 3검증기 판정 일관성 | ✅ 문제없음 | — | P2 부호 단일화·잔여 검사 비상충 |
| D 스플라이스 파이프라인 순서 | ✅ 문제없음 | — | edits→sanitize→math 정합·P3가 오히려 개선 |
| E detailLevel maximal 정합 | ✅ 문제없음 | — | 소비 5곳 전부 maximal 처리 |
| F #224 S3 도면정규화 격리 | ✅ 문제없음 | — | 07 전용, 텍스트 파이프라인 무참조 |
| G 캐시버스트/하니스 위생 | ✅ 문제없음 | — | 단일 토큰·랜드마인 0·10 테스트 그린 |
| H 26P1036 회귀 종합 | ✅ 문제없음 | — | 오염 전 결함 검출 유지·701 그린 |

---

## A. 검증기 CHK 간 이중계상/모순 (08, #225·#229·#231·#228 누적) — ✅

- **A1 문단중복 6a↔6b 이중발화 없음**: `P\n\n중간\n\nP` → `paragraph_duplicate`(CRITICAL)=1, `sentence_duplicate`=0. `hasParaDup` 가드(08:198→203 `if(!hasParaDup)`)가 6b를 정확히 억제. **CROSS-1(6a 단독) 재현 일치 + 6b 억제까지 확인.**
- **A2 젭슨/앵커(#228) ↔ CHK-5(다중인용 및) 대상 분리**: `제1항 및 제2항에 있어서` + 젭슨 불완전 독립항 → `CHK-5(및)`=1, `jepson_form`=1. 서로 다른 check·다른 대상(다중인용 vs 전환/종결부)으로 비중복.
- **A3 severity 모순 없음**: 복합 결함 spec의 severity 집합 {HIGH, CRITICAL, MEDIUM}은 **서로 다른 check(heading_missing/paragraph_duplicate/example_missing)의 각 결함**이며, *동일 대상에 상충 severity*가 아님. 정상.
- (정보) CHK-1(heading_missing)은 불완전 조각 입력에 다수 발화 — 설계상 완성본(buildSpecification, 전 표제 보유) 대상이므로 실사용 renderSpecValidation 경로에선 미발화(B3 참조).

## B. 청구범위·요약서 경계 인식 일관성 (#231 CHK-6·#229 CHK-9·#233 P2) — ✅

- **B1 비정규 순서(요약서 선행)**: `실시내용 … 【요약서】P … 【청구범위】P` → 6a=0, 6b=0. `_bodyBeforeClaims`가 청구범위·요약서 중 **먼저 나오는 위치부터 컷**(08:196 `slice(0,Math.min(..._cuts))`)이라 순서 무관하게 정당반복 오탐 차단. **CROSS-2(독립) 재현 일치 + 순서변형 케이스 확장 확인.**
- **B2 청구범위 누락**: `_bodyBeforeClaims`=전체 → 본문 내부 중복 6a=1(CRITICAL) 유지(검출 안 죽음).
- **B3 실제 buildSpecification 정합**: 정상 완성본(전 표제+부호+예시 포함) → validateSpecification 총 이슈 **0**. CHK-1~9·CHK-6 scope·CHK-9 섹션 슬라이스·P2 경계가 실제 방출 순서와 정합.

## C. 두/세 검증기 판정 일관성 (validateSpecification ↔ validateClaims ↔ validateRefNumberConsistency) — ✅

- **C1 P2 단일화 확인**: 동일 입력(통신부/송신부 동일번호 110, step_18 통신부만)에서 `validateRefNumberConsistency`는 **명칭 불일치만** 방출, `부호의 설명 누락`=0(#233 P2 제거). CHK-4(완성본)가 부호 미정의 단일 소스. → 두 검증기가 같은 결함을 이중 방출하지 않음.
- 잔여 검사(명칭 불일치·도면 미정의)는 CHK-4(부호 병기)와 **대상이 달라 상충 없음**(명칭 vs 번호정의).
- ★ **Item5 CHK-5 → Item3 게이트 계층 상호작용(의도·일관)**: `_claimGateStatus`(Item3)는 `validateClaims`를 소비 → CHK-5(다중인용 및, HIGH)는 게이트 high에 반영(`{critical:0,high:1}` 확인), 젭슨/앵커(MEDIUM)는 미반영(`{0,0}` 확인). 청구항 결함(HIGH)이 하류 생성을 게이트하고 자문성(MEDIUM)은 통과 — 설계 의도대로 일관.

## D. 스플라이스 파이프라인 순서 (05·06, #226·#230·#233) — ✅

- **파이프라인 순서(applyReview)**: `applyEditInstructions`(FIX-A dedup+FIX-B fuzzy, 05:671) → `sanitizeMethodFromDevice`(P3, 05:675) → `sanitizeDescFigureRefs`(FIX-C, 05:676) → math 재삽입(FIX-B/#230 6차 게이트+_validateInsertionPoint+insertMathBlocks, 05:693~712). 각 단계 순서 정합.
- **D-a (부수 발견, 긍정)**: 편집이 삽입한 device 문장 `S123 파라미터를 기준값으로 설정한다`가 이후 sanitize 순차 통과에서 **보존**됨. #233 P3(S### 단계문맥 정밀화) 이전에는 느슨한 `/S\d{3}/+수행/실행`이 이 편집 내용을 삭제할 수 있었음 → **P3가 편집→sanitize 잠재 본문소실을 부수적으로 해소**. CROSS-4(두 삽입경로 동일순서)를 applyEditInstructions 경로까지 확장 확인.
- **D-b FIX-A 전역 dedup**: base에 이미 있는 문단을 편집 content로 재서술 → 이중삽입 방지(1회만). math 재삽입은 별도 `inserted` Set dedup(06)이라 FIX-A와 기전 분리·비충돌.
- **D-c FIX-B 게이트 균일 적용**: 4·5·6차 Dice 게이트가 `applyEditInstructions`(05:424)·math 재삽입(05:693)·`insertMathBlocks`(06:472) 모두에 동일 적용 → 경로 간 비대칭 없음. 게이트 강화(#230)로 인한 삽입 실패는 failCount 토스트로 관측(설계된 tradeoff, 별도 경로 부작용 없음).

## E. detailLevel maximal 5곳 정합 (#229·#232) — ✅

- 소비처 전수(00~09): ① 04:1013 장치 dlCfg(maximal 有) ② 04:1336 방법 methodDetailGuide(maximal 有, #232) ③ 01:322 dlLevels 배열(카드 DOM순서 정합) ④ 05:144 글자수 임계맵(maximal:3000 有) ⑤ index.html 카드(5열). **누락/오정렬 없음.** **CROSS-3 재현 일치.** detailLevel을 소비하는 다른 지점(00:33 기본값·01:324 custom 표시)도 maximal에서 비깨짐.

## F. #224 S3 도면정규화 격리 (07) — ✅

- `_facingOverlapBand`·`_snapRouteToShapeAnchors`(S3 신규)는 **07 모듈 외 참조 0**. 이번 세션 텍스트 계열 PR(05/06/08)과 무관. 도면↔상세설명 참조번호 연동(`sanitizeDescFigureRefs` 등)은 텍스트의 "도 N" 문자열만 다루고 S3 기하 라우팅과 접점 없음.

## G. 캐시버스트/하니스 위생 — ✅

- **단일 토큰** `20260712-refnum-sanitize`(로더 1 + index 5 + 어서션 4 = 일치). 구 토큰(20260703~20260711) 잔재 **0**.
- **랜드마인**(`segmentsIntersect`/`선분 교차 검사`) 모듈 소스 **0**.
- 신규 테스트 **10파일 전부 존재·그린**(spec-machine-validate/citation-jepson/length-example/claim-quality-gate/chk6b-claims-scope/maximal-method-length/refnum-dedup/sanitize-precision/anchor-fallback6-gate/edit-dedup-global).

## H. 26P1036 회귀 종합 — ✅

- 오염 원본형(본문 5문단 중복 + `무차원량이다.2` 절단 + `min(λ,N)` λ미정의) → `paragraph_duplicate` CRITICAL=1 · `sentence_truncation`=1 · `math_var_undefined`=1 **전부 검출 유지**. 누적 방어(validateSpecification+validateClaims+게이트+앵커게이트)가 모순 없이 일관.
- **전체 스위트 701건 그린 재확인**(baseline 유지).

---

## 예비조사(CROSS-1~4) ↔ CC 독립 판정 대조

| 예비 | 내용 | 예비 판정 | CC 판정 | 대조 |
|------|------|-----------|---------|------|
| CROSS-1 | 6a 단독(6b 이중발화 여부) | 6a만 확인 | 6a=1·6b=0(가드 확인) | **일치**(+6b 억제 확장) |
| CROSS-2 | CHK 경계 독립성 | 독립 | 순서변형·누락까지 독립 | **일치**(확장) |
| CROSS-3 | maximal 5곳 정합 | 정합 | 소비 5곳+기타 정합 | **일치** |
| CROSS-4 | 두 삽입경로 동일순서 | 확인 | applyEditInstructions까지 동일 | **일치**(확장) |

- 불일치 없음. 예비조사가 놓친 부수 발견 2건(D-a P3 긍정효과, C1 CHK-5→게이트 계층)은 **모두 정상/긍정** — 수정 불요.

## 후속 수정 필요 이슈

**없음.** 연계 문제·모순·중복·오류 미발견. §직전 진단(DIAG-splice-dup-audit) P1·P2·P3는 #232·#233으로 처리 완료. 추가 후속 PR 불요.

## 한계 — 화면 검증 미완

본 감사는 **로직·테스트 레벨**(vm 하니스 + node:test)이다. 실제 앱 UI 작동 — ① 산출물 탭 "완성본 기계검증" 패널 표출/색상 ② Item3 게이트 모달(CRITICAL 차단/HIGH 확인) ③ maximal 카드 선택→분량 반영 ④ 검증 결과 이중표시 여부(탭 간) — 는 **재일 화면 확인 필요**. 로직상 정합은 위와 같이 확인함.
