# 사건등록(Docket) v2 업데이트 작업 지시서

## 개요
기존 사건등록 기능에 다음을 반영한다:
1. 마스터 엑셀 템플릿 2개 (노재일/이용환) 추가
2. 상세 조항 표준 텍스트 (특허/상표 구분) — 웹에서 편집 가능
3. "지정할인" → "담당 변리사 우대"로 표기 통일 (이미 반영됨)
4. 할인은 패턴B(합산 1줄) 적용

---

## 1. 파일 추가

### templates/ 폴더 생성 후 템플릿 배치
```
templates/
├── quote-template-노재일.xlsx
└── quote-template-이용환.xlsx
```
- 두 파일 모두 로고/푸터 이미지, 테두리, 셀 서식 보존됨
- 가변 영역은 `{{마커}}`로 표시됨
- 결제계좌/예금주/할인 변리사명은 **고정값**으로 입력 완료

### 마커 목록
| 마커 | 위치 | 설명 |
|---|---|---|
| `{{CASE_NUMBER}}` | J7 | 당소번호 |
| `{{DATE}}` | J8 | 날짜 |
| `{{CLIENT_NAME}}` | C11 | 수신(고객사명) |
| `{{SUBJECT}}` | C12 | 제목 |
| `{{CASE_TITLE}}` | C13 | 명칭 |
| `{{TOTAL_KOREAN}}` | C20 | 견적금액 한글 |
| `{{TOTAL_AMOUNT}}` | G20 | 견적금액 숫자 |
| `{{FEE_START}}`~`{{FEE_END}}` | A25~A26 | 수수료 가변 영역 (샘플1행 + 할인행) |
| `{{FEE_SUBTOTAL}}` | G소계행 | 대리인수수료 소계 |
| `{{VAT}}` | G부가세행 | 부가가치세 |
| `{{FEE_WITH_VAT}}` | G소계행 | 수수료+VAT 소계 |
| `{{GOV_START}}`~`{{GOV_END}}` | 관납료 영역 | 관납료 가변 영역 |
| `{{GOV_SUBTOTAL}}` | G소계행 | 관납료 소계 |
| `{{GRAND_TOTAL}}` | 2곳 | 총계 + 견적금액 |
| `{{NOTE_TEXT}}` | 상세 영역 | 상세 조항 (코드에서 동적 교체) |

### 고정값 (마커 아님)
| | 노재일 | 이용환 |
|---|---|---|
| 할인 비고 | 노재일 변리사 담당 우대 | 이용환 변리사 담당 우대 |
| 계좌 | 기업은행 257-155360-01-013 | 농협은행 302-2089-3014-01 |
| 예금주 | 노재일(특허그룹디딤) | 이용환(특허그룹디딤) |

---

## 2. docket.js 수정사항

### 2-1. 상세 조항 표준 텍스트 추가

`Docket.defaultNotes` 객체를 추가한다. 사건유형 선택 시 textarea에 자동 입력되고, 사용자가 수정 가능.

```javascript
Docket.defaultNotes = {
  patent: [
    '1) 대리인 수수료는 변리사 수임료이며, 특허청 관납료는 대리인 수수료와 무관한 특허청에 납부하는 금액입니다.',
    '2) 특허청 출원관납료에 포함된 심사청구료 및 가산료는 청구항의 수에 따라 청구됩니다. 본 견적에는 3개항으로 견적하였으며, 실제 청구항수에 따라 가감될 수 있습니다.',
    '3) 중소기업기본법 제2조에 따라 중소기업·벤처기업에 해당할 경우, 출원료·심사청구료·최초 3년분 등록료의 70% 감면 혜택이 적용됩니다. (증빙서류 제출 필수)',
    '4) 본 특허의 등록 시에는 출원착수금의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도) 의견제출통지서 1회 대응 비용이 포함되어 있으며, 2회 이상 및 거절결정 대응 비용은 미포함입니다.',
    '5) 부가세 포함 대리인수수료에 대하여는 세금계산서(또는 현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다.',
    '6) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '7) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
  trademark: [
    '1) 대리인 수수료는 상표출원에 대한 금액이며, 특허청 관납료는 대리인 수수료와 별개의 특허청 납부 금액입니다.',
    '2) 본 상표의 등록 시에는 대리인수수료의 100%가 성공보수금으로 청구됩니다. (부가세·특허청 등록관납료 별도)',
    '3) 부가세 포함 대리인수수료에 대하여는 세금계산서(현금영수증 택1)를 발급드리며, 특허청관납료는 서류제출 후 발생되는 납부확인증으로 입금증빙 처리됩니다. 입금 시 사업자등록증 사본을 회신 부탁드립니다.',
    '4) 지정상품 추가 시 상품류별 관납료가 추가될 수 있습니다.',
    '5) 본 견적의 유효기간은 발행일로부터 30일입니다.',
    '6) 상기 금액은 견적 내용이며, 문의사항이 있으시면 연락 주시기 바랍니다.',
  ],
};
```

### 2-2. caseTemplates의 notes를 카테고리 참조로 변경

각 템플릿의 notes 필드를 카테고리 키로 변경:
- `patent-*` 계열 → `notesCategory: 'patent'`
- `tm-*` 계열 → `notesCategory: 'trademark'`

### 2-3. 사건유형 변경 시 notes textarea 자동 입력

```javascript
Docket.renderFeeTable = function() {
  // ... 기존 코드 ...
  
  // 상세 조항 자동 입력
  var category = tmpl.notesCategory || 'patent';
  var notesArea = document.getElementById('dkt-notes');
  if (notesArea && !notesArea.dataset.userEdited) {
    notesArea.value = Docket.defaultNotes[category].join('\n');
  }
};
```

### 2-4. DB 선택 필드 추가

DB 선택(노재일/이용환)에 따라:
- 사용할 템플릿 파일 결정 (`quote-template-노재일.xlsx` / `quote-template-이용환.xlsx`)
- 할인 비고란 자동 설정

---

## 3. HTML 수정 (docket 패널에 추가)

### DB 선택 드롭다운 (dkt-meta-grid 안에)
```html
<div>
  <label>DB (담당 변리사)</label>
  <select id="dkt-db" class="input-field" onchange="Docket.onDBChange()">
    <option value="노재일">노재일</option>
    <option value="이용환">이용환</option>
  </select>
</div>
```

### 상세 조항 편집 영역 (관납료 테이블과 합계 사이에)
```html
<div class="dkt-section-title">
  <span>📝 상세 조항</span>
  <button class="btn btn-outline btn-sm" onclick="Docket.resetNotes()">기본값 복원</button>
</div>
<textarea class="textarea-field" id="dkt-notes" rows="8" 
  oninput="this.dataset.userEdited='true'"
  style="font-size:12px;line-height:1.6"></textarea>
```

---

## 4. Edge Function 업데이트 (send-docket-email)

서버 사이드에서 엑셀 템플릿을 처리하려면 Edge Function에 openpyxl을 쓸 수 없음 (Deno 환경).
따라서 **브라우저에서 ExcelJS로 템플릿 처리** 방식을 사용:

### index.html에 ExcelJS CDN 추가
```html
<script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>
```

### docket.js에서 처리 흐름
1. `fetch('templates/quote-template-{DB}.xlsx')` → ArrayBuffer
2. ExcelJS로 workbook 로드 (서식/이미지 보존)
3. 마커 셀 찾아서 값 교체
4. FEE_START~FEE_END 사이에 수수료 행 삽입 (샘플행 서식 복사)
5. GOV_START~GOV_END 사이에 관납료 행 삽입
6. NOTES 영역에 상세 조항 삽입
7. base64로 변환 → Edge Function으로 이메일 발송

---

## 요약

| 작업 | 파일 |
|---|---|
| 템플릿 2개 추가 | `templates/quote-template-노재일.xlsx`, `templates/quote-template-이용환.xlsx` |
| docket.js 업데이트 | 상세조항 기본텍스트, DB선택, ExcelJS 템플릿 처리, notes textarea |
| index.html 업데이트 | ExcelJS CDN, DB선택 드롭다운, notes textarea 추가 |
| SheetJS → ExcelJS 교체 | CDN URL 변경 |
