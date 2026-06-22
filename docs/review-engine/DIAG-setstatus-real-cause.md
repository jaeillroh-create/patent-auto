# DIAG — setStatus 실패의 진짜 원인 (status 컬럼 무죄)

> 브랜치: `review-engine/diag-setstatus-real-cause` · 코드 변경 0 (진단 문서만)
> 전제: 사용자 SQL 확인 — `opinion_projects.status = varchar(30)`, **CHECK 없음**(No rows returned).
> 결론 한 줄: **"멈춤 = setStatus('opinion_drafted')가 {ok:false}"는 맞다. 그러나 그 원인이 status 컬럼이라는 PR #186 ① 가설은 틀렸다. 진짜 원인은 라이브 DB의 UPDATE 에러이며 F12 한 줄로 확정된다.**

---

## 0. TL;DR

| 항목 | 판정 | 근거 |
|---|---|---|
| 증상 = setStatus('opinion_drafted') {ok:false} | ✅ **유지**(코드로 증명) | renderOpinion 분기 — 아래 §1 |
| 원인 = status 컬럼 폭/CHECK | ❌ **반증** | SQL: varchar(30)+CHECK없음, 'opinion_drafted'=15자 |
| 원인 = updated_at 컬럼 | ❌ **반증** | 목록 쿼리가 `order('updated_at')` 로 읽음(opinion.js:1353) → 존재 |
| 원인 = 일반 RLS 차단 | ❌ **반증** | 같은 행·같은 정책의 **이전 setStatus 들이 성공**(파이프라인이 claims_confirmed 까지 진행됨) |
| 진짜 원인 | ❓ **라이브 DB UPDATE 에러** — F12 `[Opinion.setStatus] DB 실패` 의 `error.code` 만이 확정 | §3·§4 |
| PR #186 ① | **폐기 권장** (text 확장 불필요 + 없던 CHECK 신설은 미래 status 차단 위험) | §5 |
| PR #186 ② | **유지** (표면화는 원인 불문 옳음 — 다음번 진짜 에러를 가시화) | §5 |

---

## 1. 증상 → "setStatus {ok:false}" 는 코드로 증명된다 (이 부분 가설은 옳았음)

`startOpinionDraft` 정상 경로(opinion.js):
```
3524  var insRes = await sb.from('opinion_opinion_drafts').insert(draftPayload).select();  // INSERT (다른 테이블)
3525  if (insRes.error) { ... throw de(kind:db); }      // 실패 시 throw → 에러카드
3531  Opinion.state.opinionDraft = od;                  // ← 본문을 메모리에 적재
3532  await Opinion.setStatus(p.id,'opinion_drafted');  // ← UPDATE opinion_projects
3533  showToast('의견서 초안 생성 완료...');
```
`setStatus`(4119):
```
4121  var res = await sb.from('opinion_projects').update({status:s, updated_at:now}).eq('id',id);
4122  if(res.error) throw res.error;
4123  p.status = s;            // ★ 성공일 때만 메모리 status 갱신
4125  return {ok:true};
4126  } catch(e){ console.error('[Opinion.setStatus] DB 실패 (status='+s+'):', e);  // ★ 진짜 에러가 여기 찍힘
4130    return {ok:false, ...}; }   // throw 안 함 — 조용히 삼킴
```
`renderOpinion`(3620):
```
3621  ready   = (status === 'opinion_drafted')
3624  loading = (status==='drafting_opinion'||'claims_confirmed') && state.drafting===true
3630  if (draftError && !ready) → 에러카드 후 return
3659  if (loading && !ready)   → 스피너 후 return
3663+ else                     → 본문(state.opinionDraft) 렌더
```

**증상 지문 정합:** 본문이 보이고(서두·보정내용) + 에러카드 없음 + '완료' 안 됨 ⟹
- INSERT 가 성공해야 3531(본문 적재)에 도달 → **INSERT 실패(에러카드 경로) 아님**.
- 그다음은 setStatus 뿐. setStatus 가 throw 하지 않으므로(항상 {ok}return) catch 진입 없음 → **draftError=null → 에러카드 없음**.
- finally 가 `drafting=false` → **loading=false → 스피너 없음**.
- 그런데 setStatus 가 {ok:false} 였다면 4123 미실행 → **p.status 는 'drafting_opinion' 에 잔류** → `ready=false` → else 본문만 렌더, gate3/완료 미표시.

→ **"본문 보임 + 에러카드 없음 + 작성중 잔류"는 setStatus('opinion_drafted')={ok:false} 일 때만 나오는 상태다.** (사용자가 본 "스피너 안 꺼짐"은 파이프라인 상태칩이 `drafting_opinion`=label '의견서 작성 중'에 고정된 것.)
역으로 setStatus 가 {ok:true} 였다면 p.status='opinion_drafted'→ready=true→완료 화면. 멈추지 않는다.
**∴ setStatus 는 {ok:false} 를 반환하고 있다. 그러면 4127 `console.error('[Opinion.setStatus] DB 실패 …')` 로그가 반드시 찍혀 있다.** ← 진짜 원인은 그 로그 안의 error 객체.

---

## 2. status 컬럼·updated_at·일반 RLS 는 모두 무죄 (왜 PR #186 ① 가설이 틀렸나)

1. **status 컬럼(직접 원인 아님)** — SQL 확정: `varchar(30)`, CHECK 없음.
   코드가 setStatus 로 쓰는 status 28종 중 최장은 `correction_validated`/`allowable_identified`/`drafting_corrections` = **20자** ≤ 30. 'opinion_drafted'=**15자**. → 폭 초과 불가, CHECK 위반 불가(애초에 CHECK 없음).
2. **updated_at(무죄)** — 목록 쿼리 `…select('*').order('updated_at',…)`(opinion.js:1353) 와 카드 렌더 `p.updated_at`(1369)이 정상 동작 → 컬럼 존재. 없으면 목록 자체가 42703 으로 깨졌을 것.
3. **일반 RLS 차단(무죄)** — 같은 `opinion_projects` 행에 대한 **이전 setStatus 들(analyzing, validating, claims_confirmed …)이 성공**했기에 파이프라인이 의견서 단계까지 왔다. RLS 정책은 **status 값에 무관**하므로, 같은 행·같은 정책에서 'opinion_drafted'만 RLS 로 막힐 이유가 없다.
   - 게다가 RLS `USING` 으로 막히면 PostgREST 는 **0행 UPDATE = 성공(error:null)** 을 돌려준다 → setStatus 는 {ok:true} → 메모리 status 갱신 → **세션 내 멈춤이 아님**. 따라서 "세션 내 멈춤(=‹ok:false›)"은 RLS-USING 침묵 차단으로 설명되지 않는다. (RLS 가 원인이려면 **WITH CHECK 위반**처럼 *에러를 일으키는* 형태여야 한다.)

> ★ 핵심 모순: status·updated_at·일반 RLS 가 다 무죄인데 같은 UPDATE 가 'opinion_drafted'에서만 {ok:false}? → **"컬럼 정적 결함"이 아니라 "그 호출 시점/맥락의 에러"**(트리거·세션·타임아웃 등)라는 뜻. 정적 코드로는 더 못 좁힌다 — **실제 error.code 가 있어야 한다.**

---

## 3. 진짜 원인 후보 — error.code 로 식별 (추정 아님, 코드별 확정표)

`opinion_projects` 는 **이 저장소 마이그레이션에 정의가 없다**(주석 참조만; 표·RLS·트리거는 Supabase 대시보드에서 생성 = 저장소 밖). 따라서 아래는 라이브 DB 에서 error.code 로만 확정된다.

| error.code / message | 의미 | 왜 'opinion_drafted'에서(만) 터질 수 있나 | 확인 |
|---|---|---|---|
| **42501** `new row violates row-level security` / `permission denied` | RLS **UPDATE WITH CHECK** 위반 | WITH CHECK 가 특정 조건을 요구하는데 이 전이가 위반(드묾, 이전 전이는 통과했으니 의심도 낮음) | §4 RLS SQL |
| **PGRST301** / 401 / `JWT expired` | 세션 토큰 만료 | 의견서 LLM 호출이 가장 무거움(거대 토론 프롬프트) → 호출 중 access_token 만료 시 직후 DB 호출 401. ※단 INSERT(3524)는 성공했으므로 ms 차의 setStatus 만 만료될 가능성은 낮음 | F12 Network 401 |
| **트리거 에러**(42703/23502/P0001 등) | `opinion_projects` **BEFORE/AFTER UPDATE 트리거** 실패 | 트리거는 **UPDATE 에서만** 발화(다른 테이블 INSERT 와 비대칭) → INSERT 는 멀쩡, UPDATE 만 실패와 정합. 감사/updated_at 트리거 등 | §4 트리거 SQL |
| **57014** `canceling statement … statement timeout` | 그 UPDATE 가 타임아웃 | 단일행 UPDATE 라 드묾(잠금 경합 등) | F12 로그 |
| `TypeError: Failed to fetch` | 네트워크/CORS 단절 | LLM 직후 일시 단절 | F12 Network |

> 가장 설명력 높은 후보는 **트리거**(UPDATE 비대칭 + 같은 행의 이전 UPDATE 성공과 양립 어려우나 트리거 조건이 status 의존이면 가능)와 **세션 만료**다. 그러나 **단정하지 않는다 — §4 가 답을 준다.**

---

## 4. ★ F12 로 5분 안에 확정하는 법 (추정 종료)

### (A) 이미 찍혀 있는 로그를 펼쳐 읽기 — 코드 추가 불필요
멈춘 직후 콘솔에서:
```
[Opinion.setStatus] DB 실패 (status=opinion_drafted): ▶ {…}
```
이 `{…}` 를 펼쳐 **code / message / details / hint** 를 그대로 복사. (이게 §3 표의 어느 행인지 즉시 판정됨.)
※ 만약 이 로그가 **없고** 대신 `[Opinion.DB] INSERT error … code:` 가 있으면 → 범인은 setStatus 가 아니라 INSERT(=opinion_opinion_drafts) 다. (그땐 에러카드가 떴어야 하니 증상 재확인.)

### (B) 결정적 — 같은 UPDATE 를 콘솔에서 직접 실행
```js
// 멈춘 프로젝트가 열린 상태에서:
await sb.from('opinion_projects')
  .update({ status:'opinion_drafted', updated_at:new Date().toISOString() })
  .eq('id', Opinion.state.current.id)
  .select();          // ← .select() 로 영향 행을 돌려받아 RLS-침묵까지 구분
```
반환 해석:
- `{ error:{code,message,…}, data:null }` → **그 code 가 진짜 원인**(§3 표 대입). ← 가장 흔할 것.
- `{ error:null, data:[] }` (빈 배열) → **RLS-USING 침묵 차단(0행)**. 이 경우 앱 setStatus 는 {ok:true} 를 받으므로 "세션 내 멈춤"과 **모순** → 멈춤 원인이 setStatus 가 아님(다른 마커 확인).
- `{ error:null, data:[{…,status:'opinion_drafted'}] }` → **UPDATE 정상**. setStatus 무죄 → 멈춤은 다른 곳(콘솔의 throw/INSERT 마커 확인).

### (C) RLS / 트리거 / 컬럼 점검 SQL (대시보드 SQL Editor)
> ⚠️ 대시보드는 service_role 이라 RLS 를 **우회**한다 → RLS 여부는 (B) 클라이언트 호출이 더 결정적. 아래는 정책·트리거 "정의"를 보는 용도.
```sql
-- 1) RLS 활성 + 정책(특히 UPDATE 의 USING/WITH CHECK)
SELECT relrowsecurity, relforcerowsecurity
  FROM pg_class WHERE oid='public.opinion_projects'::regclass;

SELECT polname, polcmd,
       pg_get_expr(polqual,      polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
  FROM pg_policy
 WHERE polrelid='public.opinion_projects'::regclass;

-- 2) UPDATE 트리거(다른 테이블 INSERT 와 비대칭으로 setStatus 만 깨뜨릴 수 있음)
SELECT tgname, tgenabled, pg_get_triggerdef(oid)
  FROM pg_trigger
 WHERE tgrelid='public.opinion_projects'::regclass AND NOT tgisinternal;

-- 3) 전체 컬럼/NOT NULL(트리거가 건드리는 컬럼 확인)
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='opinion_projects'
 ORDER BY ordinal_position;
```

---

## 5. PR #186 처리 — ① 폐기, ② 유지

### ① 마이그레이션(`20260617_opinion_projects_status.sql`) → **폐기(되돌리기) 권장**
- **text 확장 불필요**: varchar(30)에 최장 20자 → 이미 충분. 확장해도 증상 안 고침(원인이 폭이 아님).
- **★ 없던 CHECK 신설은 오히려 위험**(사용자 #4 지적이 정확함): 현재 status CHECK 가 **없는** 테이블에 28값 CHECK 를 새로 거는 건 **새 제약 추가**다. 앞으로 코드에 status 가 추가되면(예: 신규 단계) 그 값이 CHECK 에 없어 **이번과 똑같은 '조용한 거부 → 멈춤'** 을 *우리 손으로* 만들게 된다. 드리프트 가드 테스트가 있어도 "마이그레이션을 또 적용"해야 하는 운영 부채.
- 결론: ① 은 **머지하지 말 것.** (이미 DB 에 적용했다면 `ALTER TABLE opinion_projects DROP CONSTRAINT opinion_projects_status_check;` 로 원복. status 는 CHECK 없는 varchar(30) 원상태가 가장 안전 — 코드가 28값을 통제.)

### ② setStatus 표면화(startOpinionDraft에서 {ok:false}→에러 승격) → **유지**
- 원인이 트리거든 세션이든, **{ok:false} 를 조용히 삼키지 않고 에러카드로 올리는 것은 항상 옳다.** 다음 발생 시 사용자가 §4(A)의 error.code 를 바로 보게 되어 **진짜 원인 수집 채널**이 된다.
- 단 **한계 명시**: ② 는 {ok:false}(에러 경로)만 잡는다. 만약 (B) 결과가 "error:null·data:[]"(RLS-USING 침묵)였다면 setStatus 는 {ok:true} 라 ② 가 안 잡는다 — 그러나 그 경우는 §2 로 "세션 내 멈춤"과 모순이라 사실상 배제. 즉 현재 증상에는 ② 가 유효.
- (선택) ② 를 더 강화하려면 setStatus 가 **영향 행 수 0**도 실패로 보게 `.select()` 후 `data.length===0` 체크 추가 가능 — 단 이는 별도 판단(이번 멈춤엔 불필요).

---

## 6. 다음 액션 (사용자 → 나)
1. §4(A) 콘솔의 `[Opinion.setStatus] DB 실패 (status=opinion_drafted):` **error 객체(code/message/details/hint) 복사** 또는 §4(B) 콘솔 UPDATE 반환값 캡처.
2. 그 code 하나로 §3 표에서 원인 확정 → 그때 **타깃 수정**(예: 트리거 수정 / 세션 갱신 / RLS WITH CHECK 완화)을 별도 PR.
3. PR #186 은 ① 제거(또는 전체 close 후 ②만 재발행) 여부 결정.

**요지: status 컬럼은 SQL 로 무죄 입증됨. 이제 추정 금지 — F12 error.code 한 줄이 범인을 지목한다.**
