# PR #107 Triage — claude/review-patent-js-ZEs0m

**작성일**: 2026-04-27
**대상 커밋**: 0dfc2e1, 282cb99, 42acef5
**브랜치 상태**: 3개 커밋 모두 `claude/review-patent-js-ZEs0m`에 적용됨

---

## 커밋 0dfc2e1: C2-9-fix monitor 수평 화살표 + shapeicon 12px

- **유효성**: REWRITE
- **근거**:
  - Issue 1 (monitor `bottom: h*0.93→h`): 실제 버그 수정. `_vCy=(top+bottom)/2`와 default `_shapeAnchor` `py=h/2`의 2.7px 불일치를 해소. `default` case를 사용하는 도형 중 monitor만 K≠1이었으므로 **monitor 단독 수정으로 완결됨** (database/server/document는 이미 K=1; cloud/sensor/antenna/camera/speaker는 자체 case가 있어 일관성 자동 보장).
  - Issue 2 (sensor/antenna/camera/speaker `top -= 12`): 화살표-파형 충돌 회피 목적은 정당하나 **`12`가 매직 넘버**. 이미 `_bboxExtLabelGap=12`(line 9637) 같은 시각 패딩 상수가 코드에 존재 → 명명 상수로 추출 필요.
- **보강 필요**:
  1. Issue 1은 그대로 유지하되, 변경 코멘트를 `[shape-anchor-fix]` 태그로 통일.
  2. Issue 2의 `12`를 모듈 레벨 상수 `_ICON_VISUAL_PAD`(또는 의미상 동등한 이름)로 추출하고, 4개 shapeicon에서 동일 상수를 참조하도록 수정.
  3. **3-path 검토 결과**: Fig 1 SVG는 `_shapeVisualBounds`로 bbox 계산(line 9625) → 12px 반영됨. Fig 2+ SVG와 PPTX는 `pptxLayoutObjects`(line 8979) 경유 → `_shapeVisualBounds`를 bbox에 사용하지 않음 → **이 경로에는 12px 미반영(pre-existing 한계, 본 PR의 책임 아님)**. Canvas 경로는 코드베이스에 없음(`_drawShapeBody`/`_drawShapeShadow` 두 호출 지점이 모두 SVG 빌드 — line 10062, 10283).

---

## 커밋 282cb99: stripMathBlocks Pattern 4 콜백 guard

- **유효성**: DROP
- **근거**: 후속 커밋 42acef5가 Pattern 4를 **함수 단위로 통째 삭제**하고 단일 패턴으로 재설계함. 282cb99의 콜백 guard는 42acef5에 의해 완전히 대체됨 — 코드상 잔존하지 않음. 기능적으로 무효 커밋.
- **보강 필요**: 없음. 코드에는 이미 반영되지 않은 상태이므로 별도 revert 불필요.

---

## 커밋 42acef5: stripMathBlocks 원천적 재설계

- **유효성**: KEEP (with hardening)
- **근거**:
  - 4개 독립 패턴(Pattern 1/3/3b/4)을 단일 패턴으로 통합 — 수학식 블록을 `【수학식 N】 + 수식 + 여기서 + 예를 들어`의 한 단위로 인식. 구조적으로 옳음.
  - terminator를 `\n + 서술키워드` OR `\n\n + 비수학시작`으로 한정 — anchor 텍스트 손실 회귀 차단.
  - 39/39 테스트 통과 (이전 세션 시뮬레이션).
- **약점 (보강 필요)**:
  1. **MC/DK 키워드 사전 하드코딩**: 누락된 키워드 등장 시 silent regression 위험. 현재 코드에 인라인 회귀 케이스 주석이 없음.
  2. **lookahead 1단계만 사용**: `(?!\s*MC)` 한 번만 검사 — 두 줄 이상 떨어진 후속 수학식 연속 패턴은 인식 못 할 수 있음(저위험이지만 가능).
  3. **공식 회귀 테스트 부재**: 시뮬레이션은 임시 파일에서만 수행 — 패치 후 다른 변경이 깨도 즉시 발견 안 됨.
- **보강 필요**:
  1. 함수 헤더에 4개 회귀 케이스를 인라인 주석으로 명시.
  2. Node `--check`로 검증 가능한 임시 테스트 1회 더 수행 (MC/DK 사전 누락 케이스 포함).
  3. 4 케이스 모두 PASS 후 patent.js 반영(이미 반영되어 있으므로 검증 후 추가 보강 commit).

---

## 통합 정책

| 커밋 | 조치 |
|------|------|
| 0dfc2e1 | Issue 1 유지 + Issue 2 함수화/상수화로 보강 (별도 commit) |
| 282cb99 | DROP (이미 42acef5에 의해 대체됨, 추가 조치 불요) |
| 42acef5 | 인라인 테스트 케이스 주석 추가 + 회귀 검증 1회 (별도 commit) |

## 브랜치 전략 (제약 사항)

- 시스템 git 규칙: `claude/<session-id>` 외 브랜치 push 시 403 차단.
- Phase 3에서 지시한 `fix/patent-js-integrated-2026-04-27` 신규 브랜치는 **push 불가**.
- **대안**: 현재 브랜치 `claude/review-patent-js-ZEs0m` 위에 보강 commit 3개를 추가 → 같은 PR(이번 세션의 PR)에서 강화 반영.
- PR #107이 별도로 존재할 경우 닫기 처리는 별도 단계에서 수행.
