# DIAG — "본문 보이고 멈춤"은 setStatus DB 실패가 아니다 (수동 UPDATE 성공 반영)

> 브랜치: `review-engine/diag-stuck-not-setstatus` · 코드 변경 0 (진단 문서만)
> 새 사실: **콘솔 수동 UPDATE 성공**(`error:null, data:[1행], 200`) → `opinion_projects.status='opinion_drafted'` 쓰기 정상.
> 결론 한 줄: **이 멈춤은 setStatus DB 실패가 아니다. status 가 안 올라간 이유는 "그 생성 run 이 setStatus 에 도달하지 못함"(중단 조기 return 또는 setStatus 이전 throw)이고, 화면 본문은 `state.opinionDraft`(DB 로드/이전 run)에서 온 stale 본문이다. 진단의 빈틈은 "본문 보임 ⟹ 이번 run 이 3531 도달"이라는 그릇된 함의였다.**

---

## 0. 수동 UPDATE 성공이 의미하는 것

- `opinion_projects.status='opinion_drafted'` UPDATE 가 **에러 0, 1행 갱신, 200** → **RLS·트리거·CHECK·컬럼폭 전부 무죄**(수동이 통과). setStatus 의 *DB 쓰기 자체는 정상*.
- 그러면 직전 진단의 핵심 추론 **"본문 보임 + 작성중 ⟹ setStatus {ok:false}"** 가 깨진다. setStatus 가 호출돼 DB 에 닿았다면 성공했을 것이고, 성공했다면 status='opinion_drafted'→완료 화면이라 안 멈춘다.
- ∴ **status 가 'drafting_opinion'에 머문 진짜 이유는 "setStatus 가 실패"가 아니라 "setStatus('opinion_drafted')가 그 run 에서 실행 완료되지 못함"**(아예 호출 안 됨 = 조기 return, 또는 직전에서 throw).

---

## 1. ★ 진단의 빈틈 — "본문 보임 ⟹ 3531 도달"은 거짓

`renderOpinion` 의 본문은 `o = Opinion.state.opinionDraft`(3626)에서 렌더된다. 직전 진단은 "본문이 보이니 이번 run 이 3531(`state.opinionDraft=od`)에 도달했고, 그러니 INSERT 성공·setStatus 호출됨"이라 했다. **그러나 `state.opinionDraft` 는 3531 말고도 5곳에서 채워진다:**

| 출처 | 위치 | 언제 |
|---|---|---|
| **loadData (DB 로드)** | 4008·4010·4012·4021 | **프로젝트 열 때마다** 저장된 opinion_opinion_drafts 본문을 메모리에 적재 |
| 프로젝트 로더 | 4166·4168·4170·4172 | 상세 진입 시 본문 복원 |
| contamination HIGH | 3501 | 오염 차단 경로(이후 throw → 에러카드) |
| 정상 | 3531 | INSERT 성공 직후 |

→ **이전에 한 번이라도 초안이 저장됐다면(opinion_opinion_drafts 행 존재), 프로젝트를 여는 순간 loadData 가 `state.opinionDraft` 를 채운다.** 그 뒤 새 생성 run 이 setStatus 전에 중단/return 해도 **stale 본문은 화면에 그대로 남는다.** 즉 **본문 가시성은 "이번 run 의 진행도"를 증명하지 못한다.** ← 이게 빈틈.

---

## 2. 이 증상을 내는 진짜 경로 (setStatus 아님) — 코드 트레이스

### ★ 주범 후보: 생성 run 중단(abort)으로 setStatus 이전 조기 return

`startOpinionDraft` 에는 취소 토큰 체크가 둘 있다(둘 다 **setStatus(3532) 이전**):
```
3305  if (run && run.signal.aborted) return;                 // getContext 후
3443  if (run && run.signal.aborted) { console.log('[Opinion.run] aborted at startOpinionDraft');
3445     showToast('이전 작업이 취소되었습니다','info'); return; }  // callClaude 후, 파싱 전
```
이 `run` 은 시작 시 캡처한 `Opinion._currentRun`(AbortController). **누가 abort 하나?**
```
159 Opinion.resetState = function(opts){ ...
165   if (Opinion._currentRun) { Opinion._currentRun.abort(); ... }   // ★ 진행 중 run 취소
177   Opinion.state.opinionDraft = null;                              // (직후 loadData 가 다시 채움)
1414 Opinion.open = async function(id){
1416   Opinion.resetState({keepProjectId:false});   // ★ 프로젝트 열면 resetState → 위 abort
1423   Opinion._currentRun = new AbortController();  // 새 토큰(옛 run 의 캡처본은 이미 aborted)
1428   await Opinion.loadData(id);                   // ★ stale 본문 재적재
```
**시나리오(무DB실패 멈춤):** 의견서 생성 중(callClaude 대기, 보통 가장 김) 사용자가 목록↔상세를 다시 열거나 다른 프로젝트를 열면 → `open`→`resetState`→**옛 run.abort()** → 생성 run 이 3305/3443 에서 **early return**(setStatus 미실행) → finally 가 `drafting=false` → status 는 'drafting_opinion' 잔류 → loadData 가 본문 재적재.
결과 렌더(renderDetail 1455·1456):
- `renderPipeline`: status='drafting_opinion' → '의견서 작성 중' 스텝 **펄스(=사용자가 본 "스피너")**.
- `renderOpinion`: `loading=(drafting_opinion)&&drafting===true` → drafting=false → **loading=false**; `ready=false`; `draftError=null` → **본문 렌더**.
→ **"본문 보임 + 작성중 펄스 + 에러카드 없음 + DB 무실패"** 정확 일치. console 에 빨간 에러 없음, 대신 `[Opinion.run] aborted...`(log) + '이전 작업이 취소되었습니다'(info 토스트).

### 그 외 경로 (배제/구분용)

| 경로 | status | 화면 | console | 본문? |
|---|---|---|---|---|
| **abort 조기 return**(주범) | `drafting_opinion` | 작성중 펄스 + 본문 | `[Opinion.run] aborted...`(log), 빨강 없음 | stale |
| callClaude/parse throw | `claims_confirmed`(rollback) | **에러카드** | `[Opinion] Opinion draft error:` (빨강) | 숨김 |
| INSERT(3524) 실패 | `claims_confirmed`(rollback) | **에러카드**(초안 저장 실패) | `[Opinion.DB] INSERT error … code:` | 숨김 |
| 아직 생성 중(느림) | `drafting_opinion` | **renderLoading 스피너**(본문 아님) | 없음 | — |
| 정상 완료 | `opinion_drafted` | 완료 + gate3 | 없음 | 신규 |

> 핵심: **본문이 보이고 에러카드가 없다면** 표의 throw/INSERT 경로(둘 다 에러카드)는 배제 → **abort 조기 return 이 유일 정합**(또는 status 가 이미 'opinion_drafted'인데 사용자가 gate3 대기를 "멈춤"으로 오인).

---

## 3. ★ state.current.status 값으로 원인 가르는 법 (결정적, 코드 0)

멈춘 순간 F12 콘솔에서 **`Opinion.state.current.status`** 와 **`Opinion.state.drafting`** 을 읽어라:

```js
Opinion.state.current.status   // 핵심 분기값
Opinion.state.drafting         // true=아직 생성 중(안 멈춤), false=run 종료/return
```

| `status` 값 | `drafting` | 해석 → 원인 | 다음 |
|---|---|---|---|
| **`drafting_opinion`** | **false** | **★ 주범**: run 이 setStatus 전에 종료. → abort 조기 return(콘솔 `[Opinion.run] aborted`) 또는 setStatus 미도달. **DB·setStatus 무죄**. | §2 abort 트리거 제거(생성 중 open/resetState 방지) |
| `drafting_opinion` | true | 안 멈춤 — callClaude 가 아직 응답 전(느린 LLM). | 대기/타임아웃·이탈 점검 |
| `claims_confirmed` | false | catch rollback 실행 = **throw 있었음**. 에러카드 + 콘솔 빨강 있을 것. | 콘솔 `[Opinion] Opinion draft error:`/`INSERT error` 읽기 |
| **`opinion_drafted`** | false | **setStatus 성공함**. "멈춤"은 사실상 gate3(최종 승인) 대기이거나 렌더 갱신 누락. setStatus/DB 완전 무죄. | renderDetail 재호출/ gate3 버튼 확인 |
| 기타 | — | 예외적 — 보고 요망 | — |

추가 확인:
```js
Opinion.state.draftError                 // null 이면 에러카드 경로 아님(=abort/정상). 객체면 throw 경로
Opinion.state.opinionDraft?.sections?.length   // 본문 출처(메모리). stale 여부는 아래로
// stale 판별: DB 의 최신 초안 시각과 비교
await sb.from('opinion_opinion_drafts').select('status,created_at').eq('project_id', Opinion.state.current.id).order('created_at',{ascending:false}).limit(3)
```

---

## 4. #186 ② 표면화 — main 적용 여부

- **main 에 ② 없음**(grep `"setStatus 결과 표면화"` = 0). 배포본(GitHub Pages=main)은 **옛 동작**(setStatus {ok:false} 조용히 삼킴). 그래서 "에러카드 자동 표출"은 애초에 배포돼 있지 않다.
- 게다가 **② 가 있어도 이 증상은 못 잡는다**: ② 는 `setStatus(...)` 의 반환 {ok:false} 만 검사한다. 그러나 본 멈춤은 **setStatus 가 아예 호출되지 않는**(abort 조기 return) 경로다 → ② 의 if 문에 도달조차 안 함. **∴ ② 는 이 버그와 무관**(설령 머지해도 안 고침).

---

## 5. ★ 사용자 확인 요청 (이걸로 §3 표가 확정됨)

1. **멈춘 순간 `Opinion.state.current.status`** = ? (`drafting_opinion` / `opinion_drafted` / `claims_confirmed` / 기타)
2. **`Opinion.state.drafting`** = ? (true/false)
3. **콘솔 빨간 에러** 유무 + 있으면 첫 줄(`[Opinion] Opinion draft error` / `[Opinion.DB] INSERT error` / `[Opinion.setStatus] DB 실패` / **없음**)
4. **`[Opinion.run] aborted at startOpinionDraft`** 로그(파랑/검정) 또는 **'이전 작업이 취소되었습니다'** 토스트를 본 적 있나?
5. 멈춤 직전 행동: 생성 중 **목록으로 갔다가 다시 열었거나/다른 프로젝트를 열었나?**(abort 트리거)
6. 화면에 **에러카드("초안 저장 실패"/"의견서 생성 실패")가 뜨나, 아니면 본문만 뜨나?**

> 예상: status=`drafting_opinion`, drafting=`false`, 빨간 에러 **없음**, '취소되었습니다' 토스트 유, 에러카드 **없음** → **abort 조기 return** 확정.
> 만약 status=`opinion_drafted` 면 → DB·setStatus·렌더 다 정상이고 "멈춤"은 gate3 대기 오인(완전 무죄).

---

## 6. PR #186 처리 갱신 + 다음 수정 방향(수정은 별도 PR)

- **① 마이그레이션**: 여전히 **불필요·위험**(status varchar(30)+CHECK없음 무죄, 수동 UPDATE 성공으로 재확인). **폐기/머지 금지.** 이미 적용했으면 `DROP CONSTRAINT opinion_projects_status_check`.
- **② 표면화**: 이 버그와 **무관**(§4). 방어 코드로서 가치는 있으나 **이 멈춤의 해결책으로 의존하지 말 것.**
- **진짜 수정 후보(§3 확정 후):**
  - status=`drafting_opinion`+abort 확정 시 → (a) 생성 중 `open`/`resetState` 가 같은 프로젝트면 abort 안 하도록(또는 진행 중 가드), (b) **abort 조기 return 시 status 를 'claims_confirmed' 로 롤백**(작성중에 잔류시키지 말 것)하여 재시도 가능 상태로 복귀, (c) 완료 못 한 run 이 'drafting_opinion'에 status 를 남기지 않도록 setStatus('drafting_opinion')를 finally/abort 에서 정리.
  - status=`opinion_drafted` 면 → 수정 불요(UX: gate3 안내 강화).
  - throw 경로면 → 그 에러(callClaude/INSERT) 별도 처리.

**요지: 수동 UPDATE 성공 = setStatus DB 무죄. 멈춤은 "setStatus 미도달(abort 조기 return) + stale 본문" 가설이 가장 정합. `Opinion.state.current.status`(+drafting) 한 줄이 §3 표에서 원인을 확정한다. 추정 종료는 그 값으로.**
