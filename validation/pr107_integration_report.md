# PR #107 통합 결과 보고서

**작성일**: 2026-04-27
**대상 브랜치**: `claude/review-patent-js-ZEs0m`
**원 PR**: PR #107 (3개 커밋 0dfc2e1 / 282cb99 / 42acef5)
**Triage 문서**: [pr107_triage.md](./pr107_triage.md)

---

## 통합 정책 요약

브랜치 제약(시스템 git 규칙: `claude/<session-id>` 외 push 차단)으로 인해 새 브랜치 분리 대신 동일 브랜치에 보강 커밋을 추가하는 방식으로 통합. PR #107의 본질적 변경은 유지하되, 약점을 강화 커밋으로 보완.

---

## 적용된 변경

### 1. [shape-anchor-fix] monitor visual bounds 정렬

- **파일/라인**: `patent/patent.js:7080-7084` (monitor case)
- **변경**: `bottom: y+h*0.93` → `bottom: y+h`. 시각 중앙 `_vCy=(top+bottom)/2`를 `h/2`로 정렬하여 default `_shapeAnchor` `py=h/2`와 일치시킴.
- **영향 범위**: `default` case를 사용하는 box-type 도형 중 monitor만 K≠1이었음. 시뮬레이션 검증 결과(`/tmp/test_shape_anchor.js`):
  ```
  cloud:    gap=0.77 ✓ (자체 case)
  database: gap=0.00 ✓
  monitor:  gap=0.00 ✓ ← 수정 효과
  server:   gap=0.00 ✓
  document: gap=0.00 ✓
  ```
  모든 box-type 도형이 2px 임계치 이내. **box-type anchor 일관성 완결**. shapeicon 4종은 visualBounds를 통째로 anchor 영역으로 사용(`nodeBoxes._shapeType='box'` + `_sx/_sy/_sw/_sh=vbAbs`)하므로 midpoint 기반 일관성 자동 보장.
- **호출처 (`_shapeVisualBounds` 사용 위치)**: 
  - `patent.js:5907` (Fig 2+ 폰트 크기 산출)
  - `patent.js:9625` (Fig 1 bbox 크기 산출)
  - `patent.js:9687, 9740, 9847, 9881` (Fig 1 anchor 영역 갱신)
  - `patent.js:12266, 12983` (Fig 2+ 행 높이 산출)

### 2. [shapeicon-gap] 화살표-파형 시각 간격 상수화

- **파일/라인**: 
  - 상수 정의: `patent/patent.js:7068` (`_ICON_VISUAL_PAD=12`)
  - sensor: `7094`
  - antenna: `7105`
  - camera: `7113`
  - speaker: `7119`
- **변경**: 매직넘버 `12` → 모듈 레벨 상수 `_ICON_VISUAL_PAD`. 4개 shapeicon 모두 동일 상수 참조. 시각적 근거(화살표 marker height 6px + stroke + 폰트 baseline ≈ 12px)를 상수 정의 코멘트에 명시.
- **3-path 일관성 확인 결과**:
  - **Fig 1 SVG** (`renderDiagramSvg` line 9304+): `_shapeVisualBounds`로 bbox 계산 → 12px 반영됨 ✓
  - **Fig 2+ SVG / PPTX** (`pptxLayoutObjects` line 8979+): 균일 boxBaseW×boxBaseH 사용, `_shapeVisualBounds`를 bbox에 사용하지 않음 → **이 경로에는 미반영(pre-existing 한계)**. 본 PR의 책임이 아니며 다음 세션 과제로 분리.
  - **Canvas 경로**: 코드베이스에 존재하지 않음 (`_drawShapeBody` 호출은 line 10063, 10108, 10283, 10284 모두 SVG 빌드 — `svg+=` 접미). 사용자 spec의 "3-path"는 SVG/PPTX 2-path가 정확.

### 3. [strip-math-redesign] stripMathBlocks 단일 단위 인식 + 회귀 케이스

- **파일/라인**: `patent/patent.js:6096-6125` (함수 본체) + 인라인 회귀 케이스 주석 4종
- **변경**:
  1. 4개 독립 패턴(Pattern 1/3/3b/4) → 단일 단위 패턴. `【수학식 N】 + 수식 + 여기서 + 예를 들어`를 한 단위로 인식.
  2. **MC 패턴 정밀화 (보강)**: "예를 들어"는 단독 키워드만으로는 부족 (일반 서술도 사용) → 같은 줄에 수식기호(`=,×,÷,∑,±`) 동반시만 수학 연속으로 인식. "일 예로", "예컨대", "다음은", "예:"도 동일 정책 적용.
  3. 함수 헤더에 **4개 회귀 방지 케이스**를 인라인 주석으로 명시.
- **회귀 테스트 결과**: **16/16 PASS** (사용자 명시 4 + 기존 회귀 12)
  - 사용자 4 케이스(U1~U4): 모두 통과
  - 기존 회귀 12 케이스(R1~R12): 모두 통과
- **호출처**:
  - `patent.js:5034` (cascade re-render 시 기존 수학식 제거)
  - `patent.js:6479` (`insertMathBlocks` 진입 시 기존 블록 제거)

---

## 폐기된 변경

### 커밋 282cb99 (Pattern 4 콜백 guard)

- **상태**: 후속 커밋 42acef5에 의해 완전 대체됨. 코드상 잔존 없음.
- **조치**: 추가 작업 불요.

---

## 회귀 테스트 케이스 (반드시 PASS)

함수 헤더 인라인 주석에 박혀있는 4종:

```
[IN]  "【수학식 1】\nF=ma\n여기서 F는 힘이다.\n\n예를 들어 자동차는 가속한다."
[OUT] "예를 들어 자동차는 가속한다."   ← 수학식+여기서절은 제거, 일반서술 보존

[IN]  "본 발명은, 예를 들어 다음과 같다."
[OUT] "본 발명은, 예를 들어 다음과 같다."   ← 수학식 없으면 무손실

[IN]  "【수학식 1】\nE=mc²\n\n【수학식 2】\nF=ma"
[OUT] ""   ← 연속 수학식 모두 제거 (빈 줄로 잘리지 않음)

[IN]  "【수학식 1】\nA=B\n여기서 A는 면적,\nB는 폭이다."
[OUT] ""   ← "여기서" 절이 줄바꿈 포함해도 끝까지 따라감
```

검증 스크립트: `/tmp/test_strip_combined.js` (16/16 PASS)

---

## 다음 세션 권장 작업

1. **Fig 2+/PPTX 경로 shapeicon gap 적용**: `pptxLayoutObjects`에서 boxBaseH 산출 시 `_shapeVisualBounds`를 참조하도록 변경 → Fig 1과 동일하게 `_ICON_VISUAL_PAD`가 반영되도록.
2. **matchIconShape 통합 검토**: 라벨 매칭 로직이 여러 위치에 분산되어 있을 가능성 확인 (사용자 spec에 언급).
3. **computeDeviceLayout2D / renderDiagramSvg 경로 통합**: 사용자 spec의 "도면 3중 경로" 통합은 본 세션 범위 외로 분리 — 다음 세션에서 진행.
4. **수학식 LLM 프롬프트 개선**: ANCHOR가 base 텍스트의 실제 문장에 일치하도록 LLM에 명확한 예시 제시 (현재 fuzzy match로 보정 중이지만 1차 매칭률 향상 여지).
