# Claude Code 작업 지시서 — 토큰 통합 & 리디자인 준비

> 이 파일을 `patent-auto` 레포에서 Claude Code에 그대로 전달하면 순서대로 실행 가능.
> 동반 문서: `handoff/토큰_매핑_가이드.md` (매핑표·금지사항), `handoff/design-tokens.patch.css` (신규 토큰).

## 작업 순서 (필수 — 반드시 이 순서)

### STEP 1 — 신규 토큰 추가 (가장 먼저, 단독 PR)
**브랜치**: `feature/design-tokens-extend`
- `shared/design-tokens.css`의 닫는 `}` 직전에 `handoff/design-tokens.patch.css` 블록을 추가.
- **기존 `--dt-*` 값은 한 줄도 변경 금지.** 추가만.
- 검증: 빌드 후 기존 화면 시각 변화 0 (추가만 했으므로 회귀 없음).

### STEP 2 — 토큰 드리프트 통합 (모듈별 단독 PR)
**핵심 문제**: `patent.css`·`trademark.css`가 `--pt-*`·`--tm-*` 로컬 네임스페이스에 제3의 블루 `#3182f6`를 정의해 공식 `--dt-brand(#1B64DA)`와 불일치.

각 모듈을 개별 PR로 (한 번에 X — trademark는 424건이라 단독):

| 브랜치 | 대상 | 치환 규칙 |
|---|---|---|
| `fix/tokens-patent` | `patent/patent.css` | `--pt-primary*` → `--dt-brand*`, `--pt-gray-N` → `--dt-gN`, `--pt-success/warning/danger` → `--dt-*`, `--pt-radius*` → `--dt-r-*`, `--pt-shadow*` → `--dt-sh-*`. raw hex 70건 → 토큰 |
| `fix/tokens-trademark` | `trademark/trademark.css` | 위와 동일 (`--tm-*`). raw hex 424건 + `var(--x,#fallback)`의 fallback hex 제거 |
| `fix/tokens-opinion` | `opinion/opinion.css` | raw hex 41건 → `--dt-*`/`--color-*` |
| `fix/tokens-division` | `division/division.css` | raw hex 93건 → `--dt-*` (badge 색 `#dbeafe`·`#1e40af` 등) |
| `fix/tokens-components` | `shared/components.css` | `#C62828` → `--dt-danger` 계열 |

**치환 시 색 대응** (라이트 그레이는 Toss 램프로):
```
#3182f6 → var(--dt-brand)        #1a6dd8 → var(--dt-brand-hover)
#e8f3ff → var(--dt-brand-light)  #10b981 → var(--dt-success)
#f59e0b → var(--dt-warning)      #ef4444 → var(--dt-danger)
#f9fafb → var(--dt-g50)          #f3f4f6 → var(--dt-g100)
#e5e7eb → var(--dt-g150)         #d1d5db → var(--dt-g200)
#9ca3af → var(--dt-g400)         #6b7280 → var(--dt-g500)
#6b7684 → var(--dt-g500)         #4e5968 → var(--dt-g600)
#333d4b → var(--dt-g700)         #191f28 → var(--dt-g900)
```
> ⚠ `#3182f6 → #1B64DA` 치환은 **의도된 브랜드 통일**. 미세하게 색이 바뀌므로 PR 설명에 "브랜드 블루를 공식 --dt-brand로 통일" 명시. 시각 회귀 리뷰 필수.

**검증**: 각 PR 후 해당 모듈 화면 스크린샷 비교 — 블루가 약간 진해지는(=#1B64DA) 것 외 레이아웃 변화 없어야 함.

### STEP 3 — 시안 → 토큰 재색칠 후 화면 단위 이식 (파일럿 1개부터)
- STEP 1·2 머지 완료 후 시작.
- 시안 React 마크업을 가져올 때 `handoff/토큰_매핑_가이드.md` §1·§2 매핑표대로 시안 토큰명을 `--dt-*`로 치환.
- **파일럿 1화면** (예: 대시보드 카드 1종)으로 검증 후 확대.
- 히어로 타이포는 28px(`--dt-f-3xl`) 상한, 최대폭 1120(`--dt-max-w`). (가이드 §2.1)

## 절대 금지 (가이드 §5)
- `--dt-brand` 값을 `#3B82F6`(시안색)로 덮어쓰기
- 시안 slate 회색을 `--dt-g*`에 덮어쓰기
- 새 hex 하드코딩 / 새 로컬 토큰 네임스페이스 생성
- Wanted DS(`--color-blue-*`)를 메인 앱 화면에 사용
