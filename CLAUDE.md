# CLAUDE.md — patent-auto 프로젝트 컨텍스트

## 1. 프로젝트 개요

- **서비스명**: patent-auto (특허그룹 디딤 IP 업무 자동화 플랫폼, "DIDIM IP Center")
- **배포**: GitHub Pages (`main` 브랜치 → 자동 배포)
- **백엔드**: Supabase (인증, DB, Storage) + Edge Functions (`kipris-proxy`)
- **LLM**: Claude / GPT / Gemini 멀티 프로바이더 지원
- **언어**: 한국어 UI, 한글 주석

## 2. 아키텍처

### 구조
- **단일 페이지 앱**: `index.html` 하나에서 탭/스크린 전환으로 모든 모듈 구동
- **바닐라 JS**: 프레임워크 없음, ES6+ 문법
- **전역 네임스페이스**: `window.App` (공통), `window.Opinion`, `window.Division`, `TM` (상표, IIFE 내부)
- **Supabase SDK**: `window.sb` — 인증, DB CRUD, Storage, Edge Functions

### 폴더 구조
```
patent-auto/
├── index.html          # SPA 메인 (6개 스크린, 7개 모달, 5개 에디터 탭)
├── logo.png            # 서비스 로고
├── shared/
│   ├── common.css      # 전역 스타일, CSS 변수
│   └── common.js       # 인증, LLM API 추상화, Supabase 초기화, 유틸
├── patent/
│   ├── patent.css      # 특허 명세서 에디터 스타일
│   └── patent.js       # 특허 명세서 자동 생성 (20-Step 파이프라인)
├── trademark/
│   ├── trademark.css   # 상표 출원 스타일
│   └── trademark.js    # 상표 출원 우선심사 자동화 (7-Step 워크플로우)
├── opinion/
│   ├── opinion.css     # 의견서 대응 스타일
│   └── opinion.js      # 의견서 자동 대응 (11-Step 파이프라인)
└── division/
    ├── division.css    # 분할출원 스타일
    └── division.js     # 분할출원 청구항 자동 작성 (6-Step 파이프라인)
```

### 스크린/탭 구조
```
screenAuth (로그인/회원가입)
screenTos (이용약관 동의)
screenPending (관리자 승인 대기)
screenDashboard (메인 대시보드)
  ├── 특허 명세서 탭
  │   ├── patent-sub-spec     (명세서 작성 — 프로젝트 목록)
  │   ├── patent-sub-opinion  (의견서 대응)
  │   └── patent-sub-division (분할출원)
  └── 상표 출원 탭
      └── trademark-dashboard-panel
screenMain (특허 명세서 에디터 — 5개 탭)
  ├── page0: 기본 (발명 정보 입력)
  ├── page1: 청구항 (장치/방법 청구항 설정)
  ├── page2: 도면 (장치/방법 도면 생성)
  ├── page3: 검증 (AI 검토, 특허성 검토)
  └── page4: 산출물 (미리보기, 다운로드)
adminPanel (관리자 패널)
```

## 3. 각 모듈 상세 역할

### shared/common.js — 공통 기반
| 카테고리 | 주요 함수 | 설명 |
|---------|----------|------|
| **LLM API** | `callClaude(prompt, maxTokens)` | 선택된 프로바이더로 API 호출 (180초 타임아웃, 자동 재시도) |
| | `callClaudeSonnet(prompt, maxTokens)` | 경량 모델 호출 |
| | `callClaudeWithContinuation(prompt, pid)` | max_tokens 도달 시 최대 6회 이어쓰기 |
| | `buildAPIRequest(prov, modelKey, sys, user, maxTok)` | 프로바이더별 요청 객체 구성 |
| | `parseAPIResponse(prov, d)` | 프로바이더별 응답 → `{text, stopReason, it, ot}` 통일 |
| **인증** | `handleLogin()` / `handleSignup()` | Supabase 이메일/비밀번호 인증 |
| | `onAuthSuccess(user)` | 프로필 로드, API 키 복원, 상태 라우팅 |
| | `handleLogout()` | 로그아웃 + 상태 초기화 |
| **UI** | `showToast(msg, type)` | 토스트 알림 (success/error/info) |
| | `showProgress(id, label, cur, tot)` | 프로그레스 바 표시 |
| | `showScreen(name)` | 스크린 전환 |
| | `setButtonLoading(btnId, on)` | 버튼 로딩 상태 토글 |
| **설정** | `saveProfileSettings()` | 프로바이더/모델/API키/KIPRIS키 저장 |
| | `ensureApiKey()` | API 키 검증 (메모리→프로필→localStorage) |
| **파일** | `extractTextFromFile(file)` | PDF/DOCX/XLSX 텍스트 추출 |
| **관리** | `loadAdminUsers()` / `adminApprove()` / `adminSuspend()` | 사용자 승인/정지 관리 |

### patent/patent.js — 특허 명세서 자동 생성 (v5.5)
**20-Step 파이프라인:**

| 단계 | 스텝 ID | 내용 |
|------|---------|------|
| A1 | `step_01` | 발명의 명칭 (한/영) |
| A2 | `step_06` | 장치 청구항 (독립항 + 종속항) |
| A3 | `step_10` | 방법 청구항 |
| A4 | `step_20` | 기록매체/프로그램 청구항 |
| B1 | `step_07` | 장치 도면 (Mermaid 다이어그램) |
| B2 | `step_11` | 방법 도면 (플로우차트) |
| C1 | `step_08` | 장치 상세설명 (정형문 + 본문) |
| C2 | `step_09` | 수학식 |
| C3 | `step_12` | 방법 상세설명 |
| D1 | `step_17` | 과제의 해결 수단 |
| D2 | `step_05` | 해결하고자 하는 과제 |
| D3 | `step_16` | 발명의 효과 |
| D4 | `step_03` | 배경기술 |
| D5 | `step_02` | 기술분야 |
| E1 | `step_13` | AI 검토 (등록가능성 강화) |
| E2 | `step_04` | 선행기술 검색 (KIPRIS) |
| E3 | `step_15` | 특허성 검토 |
| E4 | `step_14` | 대안 청구항 |
| F1 | `step_18` | 부호의 설명 |
| F2 | `step_19` | 요약서 |

**주요 기능:**
- `runStep(sid)` — 개별 스텝 실행 (LLM 호출)
- `runCascadeRegeneration(sourceStep)` — 변경 시 하위 스텝 자동 재생성
- `invalidateDownstream(changedStep)` — 의존 스텝 무효화
- `saveProject()` / `openProject()` — Supabase에 프로젝트 CRUD
- `renderPreview()` — 최종 명세서 미리보기 (Word 다운로드)
- 앵커 테마 시스템 (신뢰도 가중치, 교차검증, 프라이버시 감사 등 11종)
- 장치 카테고리: server, system, apparatus, electronic_device, method, recording_medium, computer_program

### trademark/trademark.js — 상표 출원 우선심사 (v2.1)
**7-Step 워크플로우:**

| 단계 | 내용 |
|------|------|
| 1 | 상표 정보 (상표명, 유형, 견본 이미지) |
| 2 | 지정상품 (니스 분류, 고시명칭 검색, AI 추천) |
| 3 | 선행상표 검색 (KIPRIS 텍스트/도형 검색) |
| 4 | 유사도 평가 (외관/호칭/관념 AI 비교) |
| 5 | 리스크 평가 (등록 가능성 종합 분석) |
| 6 | 수수료 계산 + 우선심사 서류 생성 |
| 7 | 종합 요약 + DOCX 다운로드 |

**주요 기능:**
- `TM.searchPriorMarks()` — KIPRIS API로 선행상표 검색
- `TM.evaluateSimilarity(targetId)` — LLM 기반 유사도 평가
- `TM.assessRisk()` — 종합 리스크 평가
- `TM.analyzeBusiness()` — 사업 분석 → 지정상품 AI 추천
- `TM.generatePriorityDoc()` — 우선심사 신청서 생성
- `TM.downloadDocx()` — Word 문서 다운로드
- `TM.callKiprisAPI(type, params)` — KIPRIS Edge Function 호출
- `TM.processCustomTerm()` — 비고시명칭 리스크 분석
- 자동저장 (30초 간격 debounce)

### opinion/opinion.js — 의견서 자동 대응 (v2.0)
**11-Step 파이프라인:**

| 단계 | 내용 |
|------|------|
| upload | 파일 업로드 (통지서, 명세서, 인용문헌) |
| parse | 텍스트 추출 + 구조화 파싱 |
| type | 거절 유형 판단 (진보성/기재불비/일부거절) |
| analyze | 쟁점 분석 |
| gate1 | 사용자 승인/수정 |
| draft | 보정안 작성 |
| validate | 4점 검증 (용어존재/문맥일치/결합체크/인용발명 유래) |
| gate2 | 사용자 승인/수정 |
| opinion | 의견서 본문 생성 |
| gate3 | 최종 승인 |
| output | 완성 + Word 다운로드 |

**거절 유형별 처리:**
- **A. 진보성 (§29①②)**: 구성요소별 대비표 → 보정전략 → 보정청구항
- **B. 기재불비 (§42③④)**: 심사관 지적사항별 보정
- **C. 일부거절**: 등록가능 종속항 병합 전략

### division/division.js — 분할출원 청구항 (v1.0)
**6-Step 파이프라인:**

| 단계 | 내용 |
|------|------|
| upload | 원출원 명세서/OA 업로드 |
| parse | 청구항 파싱 + 역할 분류 |
| analyze | 미사용 구성요소 추출 + 분할 적합성 분석 |
| assemble | 분할 청구항 조립 (독립항 + 종속항) |
| verify | 명세서 뒷받침 검증 + 원출원 범위 확인 |
| confirm | 최종 확인 + 텍스트 복사 |

**분할 유형:**
- `component` — 구성요소 기반 분할
- `method` — 방법 발명 분할
- `use` — 용도 발명 분할

## 4. 외부 의존성

### Supabase
- **URL**: `https://uvrzwhfjtzqujawmscca.supabase.co`
- **인증**: 이메일/비밀번호 (Supabase Auth)
- **SDK**: `@supabase/supabase-js@2` (CDN)

### Supabase Edge Function
| 함수명 | 용도 | 호출 모듈 |
|--------|------|----------|
| `kipris-proxy` | KIPRIS API 프록시 (상표/특허 검색) | patent.js, trademark.js |

### Supabase DB 테이블
| 테이블 | 용도 |
|--------|------|
| `profiles` | 사용자 프로필, API 키, 승인 상태 |
| `projects` | 특허 명세서 프로젝트 |
| `trademark_projects` | 상표 출원 프로젝트 |
| `gazetted_goods_cache` | 상표 고시명칭 캐시 |
| `opinion_projects` | 의견서 프로젝트 |
| `opinion_project_files` | 의견서 업로드 파일 |
| `opinion_user_settings` | 의견서 사용자 설정/템플릿 |
| `opinion_parsed_documents` | 의견서 파싱 결과 |
| `opinion_type_determinations` | 거절 유형 판정 |
| `opinion_issue_analyses` | 쟁점 분석 결과 |
| `opinion_draft_claims` | 보정 청구항 초안 |
| `opinion_validation_results` | 검증 결과 |
| `opinion_opinion_drafts` | 의견서 본문 초안 |
| `opinion_gate_decisions` | 게이트 승인/수정 기록 |
| `division_projects` | 분할출원 프로젝트 |
| `division_files` | 분할출원 업로드 파일 |
| `division_claims_parsed` | 파싱된 청구항 |
| `division_spec_paragraphs` | 명세서 문단 |
| `division_unused_components` | 미사용 구성요소 |
| `division_claims_output` | 분할 청구항 출력 |
| `division_validation_results` | 분할 검증 결과 |

### Supabase Storage
| 버킷 | 용도 |
|-------|------|
| `trademark-specimens` | 상표 견본 이미지 |
| `trademark-evidences` | 우선심사 증거 파일 |

### KIPRIS API
- **베이스 URL**: `https://plus.kipris.or.kr/kipo-api/kipi`
- **호출 방식**: Supabase Edge Function (`kipris-proxy`)을 통한 프록시 호출
- **용도**:
  - `patent_word` — 특허 키워드 검색 (patent.js)
  - 텍스트 검색 — 상표명 텍스트 유사 검색 (trademark.js)
  - 도형 검색 — 비엔나 코드 기반 도형 검색 (trademark.js)
  - `detail` — 상표 상세 정보 조회 (trademark.js)
- **API 키 관리**: 프로필 DB → localStorage 캐시 → 기본키 폴백

### LLM API 프로바이더
| 프로바이더 | 엔드포인트 | 모델 |
|-----------|-----------|------|
| Claude | `https://api.anthropic.com/v1/messages` | `claude-sonnet-4-5-20250929`, `claude-opus-4-6` |
| GPT | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini`, `gpt-4o` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models/` | `gemini-2.0-flash`, `gemini-2.5-pro-preview-06-05` |

### CDN 라이브러리
| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Pretendard | v1.3.9 | 프리텐다드 가변 폰트 |
| Tossface | latest | 토스 이모지 아이콘 |
| Mermaid | @10 | 다이어그램 렌더링 (특허 도면) |
| PptxGenJS | 3.12.0 | PPTX 생성 |
| JSZip | 3.10.1 | ZIP 압축 |
| UTIF | 3.1.0 | TIFF 이미지 처리 |
| PDF.js | 3.11.174 | PDF 텍스트 추출 |
| Mammoth | 1.6.0 | DOCX 텍스트 추출 |
| XLSX | 0.18.5 | 엑셀 파일 파싱 |

## 5. 코딩 컨벤션

### JavaScript
- **순수 바닐라 JS**, ES6+ (const/let, arrow functions, async/await, template literals)
- **모듈 패턴**: IIFE 또는 전역 객체 네임스페이스 (`window.App`, `window.Opinion`, `window.Division`)
- **함수명**: camelCase (`loadProjects`, `handleLogin`, `renderDashboard`)
- **상수**: UPPER_SNAKE_CASE (`SUPABASE_URL`, `API_PROVIDERS`, `STEP_NAMES`)
- **한글 주석**: 함수/섹션 설명은 한글
- **에러 처리**: try-catch + `showToast(msg, 'error')` 사용자 알림
- **DOM 접근**: `getElementById()`, `querySelectorAll()`, inline `onclick` 핸들러
- **이벤트**: 인라인 핸들러 (`onclick="functionName()"`) 주로 사용

### CSS
- 모듈별 파일 분리 (`shared/common.css`, `patent/patent.css` 등)
- CSS 변수 기반 테마: `--color-primary`, `--color-border`, `--color-text-primary` 등
- 클래스 네이밍: 하이픈 구분 (`modal-overlay`, `progress-bar-fill`, `admin-user-item`)
- 상태 클래스: `.active`, `.selected`, `.btn-loading`, `.dragover`

### 파일 입출력
- **입력**: PDF, DOCX, DOC, HWP, HWPX, TXT, XLSX, XLS, PPTX, CSV, MD, RTF, JSON
- **출력**: Word (.doc HTML blob), DOCX (JSZip), 클립보드 복사

## 6. 브랜치 전략

- **`main`**: 프로덕션 (GitHub Pages 자동 배포)
- **작업 브랜치**: `feature/모듈명-작업내용` 또는 `fix/모듈명-버그내용`
- **PR 머지**: 작업 브랜치 → `main` PR로 머지

## 7. 자주 하는 작업 패턴

### LLM API 호출 패턴
```javascript
// 기본 호출
const result = await App.callClaude(prompt, 8192);

// 긴 결과 (이어쓰기)
const result = await App.callClaudeWithContinuation(prompt, progressId);

// JSON 응답 파싱 (opinion.js 패턴)
const jsonResult = await Opinion.callForJSON(prompt, schemaHint);
```

### Supabase CRUD 패턴
```javascript
// 조회
const { data, error } = await sb.from('테이블').select('*')
  .eq('user_id', currentUser.id)
  .order('updated_at', { ascending: false });

// 삽입
const { data, error } = await sb.from('테이블').insert({ ... }).select().single();

// 수정
await sb.from('테이블').update({ ... }).eq('id', id);

// 삭제
await sb.from('테이블').delete().eq('id', id);

// Upsert
await sb.from('테이블').upsert({ ... }, { onConflict: 'key1,key2' });
```

### Edge Function 호출 패턴
```javascript
const { data, error } = await App.sb.functions.invoke('kipris-proxy', {
  body: { type: '검색유형', params: { ... }, apiKey: apiKey }
});
```

### DOM 조작 패턴
```javascript
// 스크린 전환
showScreen('dashboard');  // auth, tos, pending, dashboard, main, admin

// 토스트 알림
showToast('저장되었습니다', 'success');  // success, error, info

// 프로그레스 바
showProgress('containerId', '처리 중...', currentStep, totalSteps);
clearProgress('containerId');

// 버튼 로딩
setButtonLoading('btnId', true);   // 로딩 시작
setButtonLoading('btnId', false);  // 로딩 종료
```

### 파일 텍스트 추출 패턴
```javascript
const text = await App.extractTextFromFile(file);
// PDF → pdfjsLib, DOCX → mammoth, XLSX → XLSX.utils
```

### 인증 흐름
```
로그인 → onAuthSuccess → 프로필 로드 → ToS 확인 → 승인 확인 → 대시보드
                           ↓ 없으면           ↓ 미동의        ↓ 대기중
                        프로필 생성      screenTos      screenPending
```

### 프로젝트 상태 관리 패턴 (opinion.js 예시)
```javascript
// 상태 업데이트
await Opinion.setStatus(projectId, 'parsed');

// 파이프라인 단계: created → parsed → type_determined → analyzed →
// claims_drafted → validated → opinion_drafted → completed
```

## 8. 주의사항

- **상대경로 필수**: GitHub Pages 배포이므로 모든 리소스 참조는 상대경로 사용
- **trademark.js 조건부 로드**: `fetch()` HEAD 체크 후 동적 `<script>` 삽입
- **API 키 보안**: `api_key_encrypted` 필드에 JSON으로 저장 (claude/gpt/gemini/kipris)
- **캐시 버스팅**: `?v=` 쿼리 파라미터로 버전 관리
- **시스템 프롬프트**: 15년차 한국 특허 변리사 페르소나, 한국 특허법 기반
- **파일 크기**: patent.js (~550KB), trademark.js (~497KB) — 대용량 단일 파일
