# review-orchestrate 배포 절차 (통합 리뷰 엔진 엣지)

> 대상: `supabase/functions/review-orchestrate` — opinion/patent/division **세 모듈 공용** 엣지 함수
> 전제: P-T2까지 SPA↔엣지 코드 경로는 완성. 이 함수가 **미배포**라 토글을 켜도 무동작이었다(P-T3 점검).
> 이 문서대로 배포하면 세 모듈 모두 라이브 검증이 가능해진다.
> ⚠️ 아래 단계는 **사용자(인프라 권한 보유자)** 가 수행한다. 시크릿은 저장소에 커밋하지 않는다.

---

## 0. 구조 (코드는 준비 완료)

- `supabase/functions/review-orchestrate/index.ts` — **배포 래퍼**. Deno `serve()` + CORS 만 입히고,
  실제 로직은 `review-engine/edge/review-orchestrate.ts` 의 `default handler` 가 담는다(로직 불변).
- 세 모듈 공용: 클라가 보내는 `body.module`('opinion'|'patent'|'division')로
  `review-engine/profiles/registry.js` 의 `PROFILES[module]` 을 데이터 조회해 프로필을 선택한다(분기 아님, I-6).
  - patent 클라: `patent.js` 의 `_defaultReviewRunner` 가 `module:'patent'` 전송.
  - opinion 클라: `module` 미전송 → 핸들러가 `'opinion'` 기본 적용(후방호환).

---

## 1. 사전 준비

- **Supabase CLI 최신화** (중요): 래퍼가 함수 폴더 밖 `../../../review-engine/*` 를 import 한다.
  최신 CLI 는 import 그래프를 따라 전부 번들한다. 구버전이면 번들 누락이 날 수 있으니 최신으로 갱신.
  ```bash
  supabase --version          # 확인
  # 필요시 업데이트 (설치 방식에 따라): brew upgrade supabase / npm i -g supabase 등
  ```
- 프로젝트 링크:
  ```bash
  supabase link --project-ref <project-ref>
  ```

---

## 2. 프롬프트 호스팅 — Supabase Storage 공개 버킷 (BREAK 2 해소)

엔진은 런타임에 `${PROMPT_BASE_URL}/.claude/rules/agents/<module>/<agent>.md` 를 `fetch` 한다.
현재 프롬프트: **opinion 6개 + patent 6개 = 12개** (division 은 .md 미작성 → division 토글은 추후).

1. **공개 버킷 생성** (대시보드 Storage → New bucket → `review-prompts`, **Public** 체크)
   또는 CLI/SQL 로 생성.
2. **프롬프트 업로드** (객체 키를 저장소 경로 그대로 보존):
   ```bash
   export SUPABASE_URL="https://<project-ref>.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # 저장소에 두지 말 것
   bash scripts/upload-review-prompts.sh
   ```
   스크립트가 `.claude/rules/agents/**/*.md` 를 `review-prompts` 버킷에 업로드하고,
   마지막에 사용할 `PROMPT_BASE_URL` 을 출력한다.
3. 출력된 값을 기록:
   ```
   PROMPT_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/review-prompts
   ```

> 프롬프트를 수정하면 이 스크립트를 재실행한다(upsert 라 안전). 즉 프롬프트의 단일 진실원천은
> 저장소의 `.claude/rules/agents/**`, 배포본은 Storage 미러다.

---

## 3. 시크릿 등록 (provider 키 + 프롬프트 베이스)

```bash
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."      # Claude (attorney_author 등)
supabase secrets set OPENAI_API_KEY="sk-..."             # GPT (examiner_A/C, attorney_reviewer)
supabase secrets set GEMINI_API_KEY="..."                # Gemini (examiner_B, domain_expert)
supabase secrets set PROMPT_BASE_URL="https://<project-ref>.supabase.co/storage/v1/object/public/review-prompts"
```
- 세 provider 키 모두 권장(편향상쇄 + E-05 폴백). 일부만 있으면 해당 모델 호출이 폴백/실패할 수 있다.
- 시크릿은 **절대 저장소에 커밋하지 않는다.**

---

## 4. 함수 배포

```bash
supabase functions deploy review-orchestrate
```
- 배포 시 `review-engine/{kernel,profiles,adapters,contracts}` 의 ESM 그래프가 함께 번들된다.
- (참고) 코어 모듈은 Deno 호환이다. Node 전용 API(`node:` import)는 `review-engine/adapters/__demo__/`
  에만 있고 핸들러가 참조하지 않는다.

---

## 5. 검증 (토글 ON 전 스모크)

1. **함수 헬스**: 인증 헤더 없이 호출 → 401(핸들러가 Bearer 요구). 즉 함수가 살아있음 확인.
   ```bash
   curl -i -X POST https://<project-ref>.supabase.co/functions/v1/review-orchestrate \
     -H "Content-Type: application/json" -d '{}'
   # 기대: 401 unauthorized (함수 정상 기동)
   ```
2. **토글 ON** (코드, 별도 작업 P-T4): `review-engine/index.js` 의
   `FEATURE_FLAGS.modules.patent = true` (+ 필요시 opinion). ⚠️ 이 문서 범위 아님.
3. SPA page4 "출원 전 검증" → 비용확인 → 실제 토론 수행 → 결과 패널 확인.

---

## 6. 주의 (배포 후 라이브 시)

- **patent 진보성 반쪽(G7)**: `citedPrior` 가 번호만(summary='')이라 examiner_A 가 인용발명 내용을
  보지 못해 진보성이 medium 이하로 강등된다. 실측에서 부실하면 `sr.patent` persist 로 보강 결정.
- **discover = examiner 3인**: 라이브 LLM 은 discover 에서 examiner_A/B/C, recheck 에서 일부.
  `attorney_author`(.md)는 현재 엔진 미발화(보정 플랜은 `compiler.compile` 결정적 생성). 설계상 그러함.
- **비용**: patent 기준 `terminationPolicy.capUsd=$15/건` 상한, 최대 12라운드. 실 키로 과금된다.
- **division**: 프롬프트 .md 미작성 → division 토글 켜면 `loadPrompt` 404(E-04). 작성 후 별도.

---

## 7. 롤백

- 함수만 내리려면: `supabase functions delete review-orchestrate` (또는 토글 OFF 로 무동작화).
- 토글(`FEATURE_FLAGS`)이 마스터 스위치다 — 코드 한 줄로 전체를 끌 수 있다(E-21).
