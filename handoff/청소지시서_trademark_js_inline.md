# 청소 지시서 — trademark.js 인라인 hex 토큰화 (트레이드마크 모듈 마무리)

> **목표**: `trademark.js`에 남은 인라인 스타일 하드코딩 hex 전부를 `--dt-*` 토큰으로 치환.
> **성격**: **순수 청소 — 디자인/레이아웃 변경 0.** 색만 토큰으로 교체.
> **전제**: STEP 2·3 완료. 신규 토큰·hex 도입 금지.
> **브랜치**: `fix/tokens-trademark-js-inline`

---

## 0. 범위

- **대상 파일: `trademark/trademark.js` 단독.** (대시보드 PR #130에서 이미 고친 `renderDashboard` 영역 제외 — 나머지 워크스페이스·우선심사·요약·에러 영역)
- index.html·trademark.css·로직 **건드리지 않음.**
- `onmouseover/onmouseout` 인라인 핸들러의 hex도 포함.

## 1. ⚠️ 최우선 — 시안 블루 잔재 (statusColors + hover)

가장 중요. 또 `#3b82f6`(시안색)가 박혀있음:

```js
// 현재 (line ~1462)
const statusColors = {
  draft: '#f59e0b', searching: '#3b82f6', documenting: '#8b5cf6', completed: '#10b981'
};
const statusColor = statusColors[project.status] || '#6b7280';
```
→ 토큰 CSS 변수로:
```js
const statusColors = {
  draft: 'var(--dt-warning)', searching: 'var(--dt-brand)',
  documenting: 'var(--dt-grade-s)', completed: 'var(--dt-success)'
};
const statusColor = statusColors[project.status] || 'var(--dt-g500)';
```
> `documenting`의 보라 `#8b5cf6` → `--dt-grade-s`(STEP 1 신규 보라 #6D28D9). 톤이 약간 진해지지만 단색 보라 유지.

열기 버튼 hover (line ~1512):
```
onmouseover="...background='#2563eb'"  → 'var(--dt-brand-hover)'
onmouseout="...background='#3b82f6'"    → 'var(--dt-brand)'   ← 시안색 제거
```

## 2. 일괄 치환 매핑표 (반복 hex)

| 현재 hex | → 토큰 | 의미 |
|---|---|---|
| `#3b82f6` / `#2563eb` | `var(--dt-brand)` / `var(--dt-brand-hover)` | **시안 블루 — 최우선 제거** |
| `#8b5cf6` | `var(--dt-grade-s)` | 보라(문서작성 상태) |
| `#f59e0b` | `var(--dt-warning)` | 주황 |
| `#10b981` | `var(--dt-success)` | 초록 |
| `#6b7280` / `#6b7684` | `var(--dt-g500)` | 회색 텍스트 |
| `#f9fafb` | `var(--dt-g50)` | hover 배경 |
| `#f3f4f6` | `var(--dt-g100)` | 버튼 배경 |
| `#e5e7eb` | `var(--dt-g150)` | hover 보더 |
| `#F7FBFF` | `var(--dt-brand-pale)` | 안내 박스 배경 |
| `#C9DEFE` | `var(--dt-brand-mid)` | 안내 박스 보더 / divider |
| `#002966` | `var(--dt-brand-deep)` | 진한 파랑 텍스트 |
| `#003E9C` | `var(--dt-brand-deep)` | 진한 파랑 텍스트 |
| `#f0f9ff` | `var(--dt-brand-pale)` | hover 배경 |
| `#FEF4E6` | `var(--dt-warning-light)` | 우선심사 안내 배경 |
| `#fde68a` | `var(--dt-warning-light)` | 주황 보더(밝은) |
| `#663A00` | `var(--dt-warning)` 계열 | 진한 주황 텍스트 (가독 유지 위해 `--color-text` 대비 확인) |
| `#FEECEC` / `#fef2f2` | `var(--dt-danger-light)` | 에러/삭제 배경 |
| `#fecaca` / `#fee2e2` | `var(--dt-danger-light)` | 에러 보더 |
| `#B20C0C` | `var(--dt-danger)` | 에러 제목 텍스트 |

> `rgba(255,255,255,0.7)` 같은 알파 흰색·`rgba(0,0,0,...)` 그림자는 토큰 대응 없으면 **그대로 유지**(hex 아님).
> `linear-gradient(135deg, #FEF4E6 0%, #fde68a 100%)` 류는 양끝을 위 매핑 토큰으로 치환.

## 3. 검수 체크리스트 (PR 설명)

- [ ] `grep '#3b82f6\|#2563eb' trademark.js` → **0건** (시안 블루 완전 제거)
- [ ] `grep '#[0-9A-Fa-f]\{6\}' trademark.js` → 0건 (또는 남은 건 의도적 알파/그림자만 명시)
- [ ] `node --check trademark.js` 통과
- [ ] 상표 워크스페이스 6단계·우선심사·요약·에러 화면 **시각 동일**(색 약간 통일된 것 외 레이아웃 0 변화)
- [ ] 상태색 배지(목록)가 draft/searching/documenting/completed 4색으로 정상
- [ ] 사용 토큰 전부 design-tokens.css에 존재 (`--dt-grade-s`·`--dt-brand-deep`·`--dt-brand-mid`·`--dt-brand-pale` 등 STEP 1 포함)

## 4. 절대 금지

- 로직·함수·status enum 변경 (색 문자열만 교체)
- 신규 hex / `--tm-*` 부활 / Wanted 토큰
- 레이아웃·구조·여백 변경 (이번은 순수 색 치환)
- `#3b82f6` 잔존 (단 한 건도)
