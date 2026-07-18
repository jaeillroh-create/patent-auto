# DIAG — 스플라이스/중복/모순 전수 진단 (patent 00~09)

> **작성:** 2026-07-18 · **기준:** main `dcde671` (+ PR #231 CHK-6 scope 반영분 인지) · **범위:** patent/modules/00~09
> **성격:** READ-ONLY 진단. 코드 수정 0. 후속 수정 필요분은 별도 PR 지시로 보고(아래 §후속).
> **배경:** 이번 세션 방어(FIX-A/B/C, validateSpecification CHK-1~9, 품질 게이트)가 커버 못 하는 잔여 오염원·모순·중복을 전수 조사.

## 판정 요약

| # | 항목 | 판정 | 심각도 | 후속 |
|---|------|------|--------|------|
| 1 | 텍스트 스플라이스 전수 | ✅ 문제없음 | — | 없음 |
| 2 | 정규식 블록 제거 과탐 | ⚠️ 문제있음 | MEDIUM | P3 |
| 3 | 검증기 3종 이중 보고 | ⚠️ 문제있음 | MEDIUM | P2 |
| 4 | 합본/조립 중복 | ✅ 문제없음 | — | 없음 |
| 5 | 캐스케이드 상태 오염 | ✅ 문제없음(설계) | LOW | 없음 |
| 6 | detailLevel maximal 잔여 정합 | 🔴 문제있음 | MEDIUM | **P1** |
| 7 | 앵커 임계 0.5 부작용 | ✅ 문제없음(by design) | LOW | 모니터 |

---

## 1. 텍스트 스플라이스 전수 — ✅ 문제없음

`slice(0,ip)+X+slice(ip)` 형태 삽입/치환 전수(모든 모듈):

| 위치 | 종류 | 위치 검증 | 앵커 | dedup 가드 |
|------|------|-----------|------|-----------|
| 05:481 (ADD_AFTER) | 삽입 | `findSentenceEndAfterAnchor` | fuzzyFindAnchor(4·5·6차 Dice 게이트) | FIX-A 전역 |
| 05:488 (ADD_BEFORE) | 삽입 | anchorStart(fuzzy) | 〃 | FIX-A 전역 |
| 05:698 (applyReview 수학식 재삽입) | 삽입 | `_validateInsertionPoint(findSentenceEndAfterAnchor)` | 〃 | inserted Set |
| 06:497 (insertMathBlocks) | 삽입 | `_validateInsertionPoint(findSentenceEndAfterAnchor)` | 〃 | inserted Set |
| 06:468 (_deduplicateSentences) | **제거** | — | — | (삽입 아님) |
| 09:449 (리뷰 컨텍스트) | 프롬프트 절삭 | — | — | (명세서 스플라이스 아님) |

- 모든 **삽입** 경로가 `findSentenceEndAfterAnchor`(단어 중간 삽입 방지) + 수학식은 `_validateInsertionPoint`를 경유. 앵커는 `fuzzyFindAnchor`(PR #226+#230으로 4·5·6차 전부 Dice≥0.5 게이트). 대화 세션이 본 지점 외 **누락된 미검증 삽입 경로 없음**.
- 09:449는 LLM 프롬프트용 basis 절삭(명세서 본문 스플라이스 아님) — 무해. 06:468은 중복 문장 **제거**(삽입 아님).

---

## 2. 정규식 기반 블록 제거/치환 과탐 — ⚠️ MEDIUM

FIX-C(#226)가 `sanitizeDescFigureRefs`의 수학식 제거를 `stripMathBlocks`로 통일했으나, **도면/중복 휴리스틱 제거기**에 과탐 엣지 잔존:

- **`sanitizeMethodFromDevice` (05:286)** — 장치 상세설명에서 방법 도면 단락 제거(line 기반).
  - 05:307: `text.replace(/^[^\n]*S\d{3}[^\n]*$/gm,'')` — **"S###"가 포함된 줄 전체 삭제**. 장치 설명 중 "S100" 같은 신호명/부품명이 있으면 그 줄 통째 소실 가능. (재현: 상세설명 문장에 "S200 신호를 …" 포함 → 문장 삭제)
  - 05:330: method-fig 소개문 감지 시 `skipParagraph=true`로 **빈 줄까지 단락 전체 skip**. deviceMax 초과 도 번호를 본문이 참조만 해도(conceptFigNums 제외분 외) 단락 소실 가능.
- **`sanitizeDescFigureRefs` Safety net B (03:1209~1220)** — "도 1을 참조하면"이 **2회 이상**이면 마지막 출현 앞을 **통째로 잘라냄**(`text.substring(cutIdx)`). 상세설명이 도 1을 정당하게 2회 참조(도입 + 후반 재참조)하면 **앞부분 전체 소실**. (재현: "도 1을 참조하면 …" 문단 2개 → 첫 문단 이후만 남음)

**판정:** 문제있음(MEDIUM). 안전(오염)이 아니라 **정상 본문 소실** 리스크. 모두 pre-existing 휴리스틱이며 특정 입력 패턴에서만 발생. validateSpecification CHK-9(예시)·CHK-6(중복)와 무관.
**재현 조건:** ① 상세설명에 "S###" 포함 문장 ② deviceMax 초과 도 번호를 장치 본문이 참조 ③ "도 1을 참조하면" 2회 이상.

---

## 3. 검증기 3종 이중 보고 — ⚠️ MEDIUM (사용성)

`validateClaims`(08:47)·`validateSpecification`(08:152)·`validateRefNumberConsistency`(08:290) message 레벨 대조:

- **이중 보고 1건 확인** — "본문 부호가 부호의 설명에 미정의":
  - `validateRefNumberConsistency` 3번(08:328~333): `부호의 설명 누락: 명칭(ref) — 본문 사용되나 미기재` · **MEDIUM** · 표시 surface = **검증 탭**(`runValidation`, page3).
  - `validateSpecification` CHK-4 usedNotDef(08:186): `본문 사용 부호 N개가 부호의 설명에 미정의` · **MEDIUM** · surface = **산출물 탭**(`renderSpecValidation`, page4).
  - → **동일 결함**(body refnum ∉ step_18)을 서로 다른 message로 이중 검출. severity는 MEDIUM으로 일치(불일치 아님). surface가 달라 동시 노출은 드무나, 두 탭 모두 보면 같은 결함이 문구만 다르게 2회.
- validateClaims는 청구항 내부 전담(중복 없음). CHK-5(다중인용 "및")·젭슨·앵커는 청구항 대상, refnum과 무관.

**판정:** 문제있음(MEDIUM/사용성, 안전 무해). severity 불일치·CRITICAL 이중은 없음.
**후속(P2):** CHK-4와 validateRefNumberConsistency의 "미정의 부호" 검출을 한쪽으로 일원화하거나, surface별 역할을 주석/문서로 명시.

---

## 4. 합본/조립 중복 — ✅ 문제없음

- **정형문 이중삽입**: `hasBoilerplate` 가드가 STEP8_PREFIX/SUFFIX 삽입 전부(03:1137/1142/1143/1153/1171)를 보호 → 이중 삽입 불가.
- **예시도 합본 중복**: `buildImplementationBody`(03)의 `_normForDedup`+`conceptIn`(03:1166~1169, #223) — 예시도(step_08c)가 device(step_08 합본)에 이미 있으면 제외. 방법(step_12)은 별도 콘텐츠.
- **잔여 엣지(LOW)**: `conceptIn`은 concept 정규화 첫 30자가 device에 있으면 skip. 첫 30자만 우연 일치하고 이후 상이하면 concept 오탈락 이론상 가능(실무 확률 낮음). 조치 불요.

---

## 5. 캐스케이드/재생성 상태 오염 — ✅ 문제없음(설계)

- `_cascadeRunMath`(03:1067)는 `getLatestDescription()`(timestamp 우선)로 base를 잡아 수학식을 **최신 step_08에 재-앵커링**. 캐스케이드가 step_08→step_09 위상순 재생성 시 step_09가 새 base 참조.
- step_08만 재생성(step_09 미선택) 시: `getLatestDescription`이 timestamp로 **새 step_08을 우선**(구 step_09 math 미사용) + `invalidateDownstream(step_08)`가 step_13_applied 삭제(03:543~547) 및 하위 무효 배지. → **구 앵커 오참조 없음**(구 step_09는 승계에서 탈락).
- 잔여(LOW): step_09 미재생성 시 최종 산출물에서 수학식이 일시적으로 빠질 수 있으나 **invalidate 배지로 신호**되는 사용자 주도 재생성 대상. silent 오염 아님.

**판정:** 문제없음(설계된 staleness 관리). Item 3 게이트·CHK와 무관.

---

## 6. detailLevel `maximal` 잔여 정합 — 🔴 MEDIUM (확정 후속 P1)

Item 4(PR #229)가 `maximal`을 **장치** 경로 4곳(04:1013 dlCfg·01 dlLevels·index.html 카드·05:122 임계맵)에 추가했으나, **방법 상세설명(step_12) 분량 가이드에 누락**:

- **04:1336** `methodDetailGuide` — `dl==='compact'?…:dl==='standard'?…:dl==='detailed'?…:dl==='custom'?…:'약 1,200자 …'` — **`maximal` 케이스 없음** → `detailLevel==='maximal'`이면 최종 else(**약 1,200자**, standard 수준)로 폴백.
- 결과: 사용자가 "최대(maximal)" 선택 시 **장치 상세설명은 25,000자급인데 방법 상세설명은 1,200자급**(불일치). 크래시는 아님(graceful 폴백)이나 기능 미완.

**판정:** 문제있음(MEDIUM, 명확한 기능 갭). **재현:** detailLevel=maximal 선택 → step_12 생성 → 방법 분량 지침이 "약 1,200자"로 나옴.
**후속(P1, 확정):** 04:1336 methodDetailGuide에 `maximal` 케이스 추가(예: '약 3,000자 이상 …'). 장치 dlCfg(04:1010 detailed='2,000자 이상' → maximal='3,000자 이상')와 정합.
※ 그 외 소비처(00:33 기본값·01:322/324 UI·04:1013·05:122)는 maximal 처리 확인됨(정상).

---

## 7. 앵커 매칭 임계(0.5) 부작용 — ✅ 문제없음(by design)

- fuzzyFindAnchor 4·5·6차 Dice≥0.5 게이트(06:190/198/213)가 임계 미달 앵커를 무효화 → 반복 문형에서 정상 앵커도 4~6차로만 잡히고 Dice<0.5면 **삽입 실패**.
- 이는 FIX-B 설계 원칙("오탐 시 삽입 실패가 오염보다 안전"). 1~3차(정확·정규화·키워드)가 대부분 처리하므로 4~6차 의존 앵커는 소수.
- **관측 가능**: insertMathBlocks가 failCount 집계 + `console.warn(수학식 삽입 실패 — ANCHOR 매칭 불가)`(06:502) + 사용자 토스트(06:562 "수학식 N/5개 삽입됨 … 매칭 실패"). silent 실패 아님.

**판정:** 문제없음(의도된 tradeoff, 관측 가능). 임계 하향 시 오매칭 오염 리스크 재증가하므로 유지 권장. 실사용 삽입 실패율이 토스트로 높게 관측되면 그때 임계·앵커 생성 프롬프트를 재검토.

---

## 후속 수정 우선순위 (별도 PR — 이 진단은 코드 무수정)

| 우선 | 항목 | 조치 | 브랜치 제안 |
|------|------|------|-------------|
| **P1** | §6 maximal 방법 분량 갭 | 04:1336 methodDetailGuide에 maximal 케이스 추가 | `review-engine/fix-maximal-method-length` |
| **P2** | §3 refnum 이중 보고 | CHK-4 ↔ validateRefNumberConsistency "미정의 부호" 일원화 또는 surface 역할 명시 | `review-engine/fix-refnum-dup-report` |
| **P3** | §2 휴리스틱 제거기 과탐 | sanitizeMethodFromDevice(S### 줄·method-fig 단락)·Safety net B(도1 2회 컷) 정밀화 | `review-engine/fix-sanitize-overremove` |

- P1은 명확한 기능 갭(확정). P2는 사용성. P3는 특정 입력 패턴 엣지(정상 본문 소실 가능이라 무시 불가하나 발생 빈도 낮음).
- §1·4·5·7은 "확인함, 문제없음". §5·7의 LOW 잔여는 설계된 신호(배지·토스트)로 커버되어 조치 불요.
