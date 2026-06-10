# STEP 3 이식 지시서 — 특허 명세서 에디터 (Phase A: 공용 크롬·카드·스텝)

> **목표**: `#screenMain`(특허 명세서 에디터, 5탭)의 **공용 컴포넌트**를 대시보드와 동일한 디자인 언어로 다듬는다. 공통 요소만 손대도 5탭 룩앤필이 한꺼번에 올라간다.
> **시각 레퍼런스**: `patent_dashboard_redesign.html` (헤더·탭·카드·버튼 패턴).
> **전제**: STEP 1·2·3 머지 완료. 색은 `--dt-*`/`--color-*` 토큰만. **현재 main 기준**으로 작업(import 사본 아님).
> **브랜치**: `feature/redesign-editor-chrome`

---

## 0. ⚠️ 최우선 안전 원칙 (에디터는 JS와 촘촘히 엮임)

**아래는 절대 변경 금지 — 하나라도 바뀌면 20-Step 파이프라인이 깨진다:**
- 모든 `onclick="..."` / `oninput="..."` 핸들러 (예: `runStep('step_01')`, `switchTab(0)`, `selectTitleType(...)`)
- 모든 `id` (예: `projectInput`, `cardStep01`, `btnStep01`, `page0`~`page4`, `fileUpload`, `headerProjectName`, `modelToggleContainer` …)
- `class`의 **기능성 클래스** (`.page`, `.page.active`, `.tab-item`, `.tab-item.active`, `.card`, `.selection-card`, `.selection-card.selected` 등 — JS가 토글하는 것)
- `role`/`aria-*` 속성, `data-icon`/`data-size`
- 탭 개수·순서·`page0~4` 구조

→ **이 PR은 "스타일(CSS)와 시각적 구조"만 개선.** DOM 노드 추가/삭제·핸들러·id 변경 금지. 클래스는 **추가**는 OK, 기존 기능 클래스 **제거/이름변경 금지.**

## 1. 작업 대상 (공용 컴포넌트 5종)

`patent/patent.css`(또는 해당 에디터 CSS)에서 아래 컴포넌트 스타일만 정제. 색은 토큰, 간격은 `--dt-sp-*`, 라운드 `--dt-r-*`.

### 1-1. 헤더 (.app-header — screenMain)
- 대시보드 헤더와 동일 높이·정렬·토큰. 좌(뒤로·로고·사건명) / 우(저장·모델토글·계정·로그아웃).
- `border-bottom: 1px solid var(--color-border)`, 배경 `--dt-white`, sticky.
- 인라인 스타일(`style="max-width:200px;..."` 등)은 유지하되 색 hex 있으면 토큰화.

### 1-2. 탭 바 (.tab-container / .tab-item)
- underline 스타일로 통일 (대시보드 service-tab과 같은 언어): 비활성 `--color-text-secondary`, 활성 `--color-primary` + 하단 2px 보더.
- `.tab-icon`·`.tab-label` 간격·크기 정돈. 활성 토글은 **기존 `.active` 클래스 그대로 사용**(JS가 토글).

### 1-3. 카드 (.card / .card-header / .card-title)
- `background: var(--dt-white)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`.
- `.card-header` 패딩·구분선, `.card-title` 폰트(`--dt-f-lg`/700) + 아이콘 정렬 통일.
- 카드 간 간격 `--dt-sp-4~5`.

### 1-4. 선택 카드 (.selection-cards / .selection-card)
- 그리드 간격·셀 패딩·라운드 토큰화. 기본 보더 `--color-border`, hover `--dt-g300`, **선택됨(.selected)** = `--color-primary` 보더 + `--color-primary-light` 배경.
- `.selection-card-title` 폰트 통일.

### 1-5. Step 카드 + 실행 버튼 (#cardStepNN / .btn-primary)
- step 카드 헤더에 단계 번호 시각 강화(작은 원형 인덱스, 선택). **`runStep` 버튼 id·onclick 유지.**
- 진행 표시(`#progressBatch` 등) 영역 색 토큰화.
- 버튼은 운영 `.btn .btn-primary .btn-full` 재사용 — 높이·폰트만 토큰 정렬.

## 2. 색/하드코딩 정리 (현재 main 기준)

- 에디터 영역(`#screenMain`)에 남은 인라인 `#hex` / `var(--pt-*)` 잔재가 있으면 토큰으로 치환:
  - `var(--pt-gray-N)` → `var(--dt-gN)` 또는 `--color-text-*`
  - 시안색 `#3b82f6`/`rgba(59,130,246,*)` 잔존 시 → `--dt-brand` 계열
- `grep`으로 `#screenMain` 관련 잔재 확인 후 PR 설명에 수치 기재.

## 3. 검수 체크리스트 (PR 설명)

- [ ] `onclick`/`oninput`/`runStep`/`switchTab`/id **변경 0건** (diff에서 핸들러·id 라인 없음)
- [ ] 5탭 전환 정상 (switchTab 0~4), 각 page0~4 표시 정상
- [ ] step 실행 버튼(runStep) 정상 동작 (id·onclick 보존)
- [ ] 선택 카드 `.selected` 토글 정상
- [ ] 신규 하드코딩 hex 0 / `--pt-*` 잔재 0
- [ ] 모델 토글·저장·계정 등 헤더 기능 정상
- [ ] 다른 화면(대시보드·상표) 회귀 없음
- [ ] 시각: 5탭 룩앤필이 대시보드와 일관되게 상승 (레이아웃 깨짐 0)

## 4. 절대 금지

- JS 핸들러·id·기능 클래스·탭 구조 변경
- DOM 노드 추가/삭제로 인한 배선 변화 (순수 스타일·클래스 추가만)
- 신규 hex / `--pt-*`·`--tm-*` 부활 / Wanted 토큰
- step 파이프라인 로직(patent.js) 변경 — **이번 PR은 patent.js 거의 안 건드림**(불가피한 색 문자열만)

## 5. Phase B 예고 (이번 PR 아님)

공용 크롬이 올라간 뒤, 탭별 콘텐츠(page0~4) 세부 레이아웃·여백은 후속 `feature/redesign-editor-tabN` PR로 순차 진행. 이번 PR은 **공용 요소까지만.**
