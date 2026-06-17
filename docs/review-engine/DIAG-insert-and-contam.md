# 진단 — 의견서 생성 ① varchar(20) INSERT 실패 + ② 템플릿 오염 4건

> 작성: 2026-06-16 · 브랜치 `review-engine/diag-insert-and-contam` · **READ-ONLY, 코드 수정 0**
> 콘솔 확정: ① `[Opinion.DB] block-insert error: value too long for varchar(20), code 22001` · ② `Template contamination: 4 items, severity high`("소셜미디어 콘텐츠"·"건강 컨셉 식자재" 등)

---

## 0. 결론 (두 줄)

① **opinion_opinion_drafts 의 `status`(또는 `opinion_type`) 컬럼이 배포본에서 `varchar(20)`** 인데, `status='contamination_blocked'`(21자)·`opinion_type='description_deficiency'`(22자)가 20자를 초과한다. 의도 스키마는 `text`(migration 20260428)인데 그 마이그레이션이 **CHECK만 고치고 컬럼 폭은 안 늘림**. → INSERT 22001.
② **#184 마스킹(접미사 기반)이 도메인 명사("소셜미디어 콘텐츠" 등)를 못 가려** 마스킹 전문에 남았고 → LLM이 의견서로 베낌 → 오염검사(작동)가 4건 high로 잡아 차단. 방어는 정상, **마스킹 보강 필요**.

---

## ① varchar(20) INSERT 실패 (file:line)

### 페이로드
- 정상 초안: `draftPayload = {project_id, opinion_type: t, content: od, status:'draft'}` (opinion.js:3505) → INSERT(3507).
- 오염 차단본: `blockPayload = {project_id, opinion_type: t, content: od, status:'contamination_blocked'}` (3475) → INSERT(3477, **best-effort** try/catch 3474-3483).
- `t = p.rejection_type`. 길이: **`description_deficiency`=22자**, `inventive_step`=14, `partial_rejection`=17. status: `draft`=5, **`contamination_blocked`=21자**.

### 어느 컬럼·값이 초과?
- block payload(3475)는 **opinion_type='description_deficiency'(22)** + **status='contamination_blocked'(21)** — **둘 다 20 초과**. 콘솔의 "block-insert error varchar(20)"는 둘 중 varchar(20)인 컬럼에서 발생(Postgres 메시지는 컬럼명 미표기 → 둘 다 후보).
- **의도 스키마(migration `20260428_opinion_drafts_status_fix.sql` line 9-10·74-76): `opinion_type text`, `status text`.** 그 마이그레이션은 **status CHECK 제약만**('contamination_blocked' 허용, line 41) 고쳤고 **컬럼 타입(varchar→text)은 안 건드림**(line 12 "실제 스키마 미열람"). → 배포 테이블이 옛 `varchar(20)`로 남아 값은 CHECK 통과하나 **타입 폭 초과(22001)**.
- **★ 결정 SQL**(migration line 79-82): `SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='opinion_opinion_drafts';` → `status`/`opinion_type` 가 `character varying(20)` 인지 확인.

### 단계 버튼이 사라지는 사슬
1. (이번 케이스=기재불비+오염) 오염 검출(3458) → block-insert(3477) varchar(20) 실패(①, **best-effort라 throw 안 함**, 로그만) → **throw ce(②, contamination)** (3489).
2. catch(3517): `kind` 판정(3520-3525) → `state.draftError = {kind:'contamination', message}` (3526) → **`setStatus('claims_confirmed')` 롤백**(3527) → 토스트.
3. `renderOpinion`(3613): `draftError && !ready` → **에러 카드 표시**(3614~) → 정상 "다음 단계" 버튼 대신 에러 카드 + 재시도 버튼. (status 가 `opinion_drafted`(3515)에 도달 못 해 다음 단계 비활성.)

→ **이번(오염) 케이스의 직접 버튼-차단은 ②(contamination throw)**, ①(block-insert varchar)은 그 옆에서 난 best-effort 실패(차단본 저장 실패)다.
→ **단, `opinion_type`가 varchar(20)이면 ①은 독립 차단원**: 오염 없는 기재불비도 정상 INSERT(3507)에서 22자 초과로 실패 → `de(kind:'db')` throw(3512) → 에러 카드. (이 경우 콘솔은 "INSERT error"(3509), block 아님.) `status`만 varchar(20)이면 정상 초안(status='draft')은 저장되고 오염 차단본만 실패.

### ① 해결
- **DB 마이그레이션(권장)**: `ALTER TABLE public.opinion_opinion_drafts ALTER COLUMN status TYPE text; ALTER COLUMN opinion_type TYPE text;` — 의도 스키마와 일치, 두 값 모두 수용. (idempotent: 이미 text면 무해.) 값 단축(description_deficiency→축약)은 코드 전반의 enum이라 **부적절** → 컬럼 확장이 정답.
- 부수(선택): block-insert(3477)는 이미 best-effort라 무해하지만, 차단본 status는 컬럼 확장 후 정상 저장됨.

---

## ② 템플릿 오염 4건 (마스킹 갭)

### 검출기 (정상 작동)
- `validateNoTemplateContamination`(opinion.js:1262): `_templateForbiddenSpans`(sanitizeTemplate가 추출한 **마커 포함 사건특유 span**)의 20-50자 chunk가 생성 의견서에 있으면 경고. HIGH_RE(제N항/인용N/【】/출원번호) 포함 span → **high**(1284,1292), 비-보일러플레이트 → medium.
- 4건 high = 양식의 마커 포함 span(예 "[제N항] … 소셜미디어 콘텐츠 추천 …")의 도메인 어구가 의견서에 그대로 등장 → 차단(3489). **방어는 정상.**

### ★ 왜 마스킹이 못 가렸나 (#184 갭)
- #184 `_maskCaseSpecific`(opinion.js ~1207): 식별자 + 수치·단위 + 영문약어 + **접미사 기반 기술명사**(부/모듈/유닛/회로/센서…) + 낫표.
- "**소셜미디어 콘텐츠**", "**건강 컨셉 식자재**", "**컨셉**" 등은 **발명 도메인 주제어**로, 위 접미사 어느 것에도 안 걸린다(콘텐츠·식자재·미디어·컨셉은 기술 접미사 아님). → 마스킹 전문에 **그대로 남아** 프롬프트→의견서로 누출.
- 즉 #184 PR이 경고한 "띄어쓴/접미사 외 명사구는 못 가림"의 실제 발현. 접미사 화이트리스트로는 임의 도메인 명사를 못 잡는다.

### ★ 마스킹 강화법 (정확·보수적)
- **(권장) forbiddenSpans/마커-문장 자체를 마스킹 전문에서 제거**: sanitizeTemplate은 이미 `forbiddenSpans`(마커 포함 사건특유 span)를 추출한다. **그 span(또는 HIGH_RE 마커를 포함한 문장 전체)을 maskedFull 에서 [사건특유 문장 생략]으로 치환**하면, 도메인 어구가 프롬프트에 애초에 안 들어간다. 마커-문장은 사건특유(소셜미디어 콘텐츠가 거기 있음)이고, 문체는 마커 없는 일반 문장에 있으므로 문체 손실 최소.
- (보강) 도메인 명사 접미사 확장(콘텐츠·미디어·플랫폼·서비스·식자재·솔루션 등) + 한글 외래어. 단 whack-a-mole — forbiddenSpans-문장 제거가 더 근본.
- 어느 쪽이든 **변리사 실물 재확인 필요**(완전 검증 불가).

---

## ★ ①②를 한 PR? 분리?

**분리 권장 (다른 레이어·다른 배포·다른 검증):**
| | 대상 | 종류 | 배포 |
|---|---|---|---|
| **①** | opinion_opinion_drafts 컬럼 varchar(20)→text | **DB 마이그레이션**(앱 코드 0) | 대시보드 SQL / db push |
| **②** | sanitizeTemplate 마스킹 강화(forbiddenSpans-문장 제거) | **client opinion.js** | GitHub Pages(?v=) |

- ①이 **저장/버튼 차단의 인프라 문제**(특히 opinion_type varchar(20)면 모든 기재불비 차단) → **먼저·독립 처리**. ②는 client 마스킹 품질 → 별도.
- 한 PR로 묶으면 DB 마이그레이션과 client 변경이 섞여 리뷰·롤백이 엉킨다.

---

## ★ 핵심 질문 답

- **① 어느 컬럼·값 초과**: block payload의 `opinion_type='description_deficiency'(22)`·`status='contamination_blocked'(21)` 중 배포본에서 `varchar(20)`인 컬럼(결정 SQL로 확인; 의도는 둘 다 text). 해결=컬럼 text 확장.
- **① 단계버튼 사슬**: INSERT/contamination throw → `draftError` → `setStatus('claims_confirmed')` 롤백(3527) → renderOpinion 에러 카드(3613)로 다음 단계 버튼 대체. (이번 케이스 직접원인은 ② contamination throw; ①은 best-effort 실패 + opinion_type varchar면 독립 차단.)
- **② 4건이 왜 마스킹 안 됨**: 접미사 기반 마스킹(#184)이 도메인 주제어(소셜미디어/콘텐츠/식자재/컨셉)를 못 잡음 → 마스킹 전문에 잔존 → 누출. 해결=forbiddenSpans/마커-문장을 마스킹 전문에서 제거.
