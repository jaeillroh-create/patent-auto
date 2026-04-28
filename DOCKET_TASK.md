# 사건등록(Docket) 기능 추가 작업 지시서

## 개요
patent-auto 레포에 "사건등록 · 견적서 발송" 기능을 추가한다.
- 사건 유형 선택 → 수수료 자동 입력 → 견적서 엑셀 자동 생성 → docket@didimip.com 이메일 첨부 발송
- 할인 표기: "지정할인" → **"담당 변리사 우대"**로 변경

## 작업 순서

### 1. 파일 생성

아래 3개 파일을 레포 루트에 생성:
- `docket.js` — 사건등록 모듈 (사건유형 10종 템플릿, SheetJS 엑셀 생성, Resend 이메일 발송)
- `docket.css` — 사건등록 스타일
- `supabase/functions/send-docket-email/index.ts` — Supabase Edge Function (Resend API로 엑셀 첨부 이메일 발송)

### 2. index.html 수정 (5곳)

#### 2-1. `<head>` 안에 추가
```html
<link rel="stylesheet" href="docket.css" />
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

#### 2-2. `<nav class="service-tab-nav">` 안에 상표 탭 뒤에 추가
```html
<button class="service-tab" data-service="docket" onclick="App.switchService('docket')">
  <span class="tossface">📮</span> 사건등록
</button>
```

#### 2-3. trademark-dashboard-panel 닫는 `</div>` 뒤에 사건등록 패널 HTML 삽입
`docket-panel.html`의 `<div id="docket-dashboard-panel">` 블록과 `<div id="docketPreviewModal">` 블록 전체를 삽입한다.

#### 2-4. `</body>` 직전에 추가
```html
<script src="docket.js"></script>
```

### 3. common.js 수정 (2곳)

#### 3-1. `App.switchService` 함수 안에 추가 (trademark init 블록 뒤에)
```javascript
if (service === 'docket' && window.Docket && typeof Docket.init === 'function') {
  Docket.init();
}
```

#### 3-2. `App.initServiceTabs` 함수 안에 추가
```javascript
if (hash === 'docket') {
  App.switchService('docket');
}
```
기존 `if (hash === 'trademark')` 블록 앞에 `else if`로 연결하거나 별도 if문으로 추가.

### 4. Edge Function 배포 (수동)
```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set SENDER_EMAIL=noreply@didimip.com
supabase functions deploy send-docket-email
```

## 사건 유형 템플릿 (10종)

| 키 | 라벨 | 대리인수수료 항목 |
|---|---|---|
| patent-priority | 우선 특허출원 + 중간사건 | 출원착수금(180만), 우선심사(60만), 중간사건(40만) |
| patent-priority-guarantee | 우선 특허출원 등록보장 | 출원착수금(180만), 우선심사(60만), IP컨설팅(100만), 중간사건(40만), 면담(40만), 등록성사금(180만) |
| patent-division-priority | 분할출원 (우선) | 분할출원(80만), 분할등록(80만), 우선심사(60만) |
| patent-division-general | 분할출원 (일반) | 분할출원(80만), 분할등록(80만) |
| patent-pct | PCT 출원 | 가출원(30만), 본출원(600만), PCT(150만) |
| tm-general | 일반 상표출원 | 출원착수금(30만) |
| tm-priority | 우선 상표출원 + 중간 | 출원착수금(30만), 우선심사(30만), 중간사건(50만) |
| tm-priority-reg | 우선 상표 + 중간 + 등록 | 출원착수금(30만), 우선심사(30만), 중간사건(50만), 등록성사금(30만) |
| tm-oa | 상표 중간사건 | 의견서 작성 및 제출(60만) |
| tm-cancel-trial | 취소심판 | 심판착수금(100만) |

## 핵심 기술 스택
- **SheetJS (xlsx.full.min.js)**: 브라우저에서 견적서 엑셀 파일 생성 (CDN)
- **Resend API**: 이메일 첨부 발송 (Supabase Edge Function 경유)
- **할인 표기**: `{변리사명} 변리사 담당 우대` (견적서 비고란 + 이메일 본문)

## 주의사항
- docket.js의 `Docket.config.emailFunctionUrl`은 Supabase URL 기반으로 자동 설정됨 (`App.supabaseUrl + '/functions/v1/send-docket-email'`)
- 자동 발송 실패 시 Gmail 작성창 fallback + 엑셀 자동 다운로드 처리 내장
- 견적서 엑셀 셀 레이아웃은 기존 11종 견적서와 동일 구조 (I2: 견적서 타이틀, 대리인수수료→할인→부가세→소계→관납료→총계)
- 숫자→한글 변환 함수 내장 (예: 5857600 → "오백팔십오만칠천육백")
