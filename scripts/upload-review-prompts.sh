#!/usr/bin/env bash
# scripts/upload-review-prompts.sh
# ─────────────────────────────────────────────
# 리뷰 엔진 에이전트 프롬프트(.md)를 Supabase Storage 공개 버킷에 업로드한다.
# loadPrompt(review-engine/edge/review-orchestrate.ts)가 런타임에
#   ${PROMPT_BASE_URL}/.claude/rules/agents/<module>/<agent>.md
# 를 fetch 하므로, 객체 키를 저장소 경로 그대로 보존해 업로드한다.
#
# 사용법(시크릿은 환경변수로만 — 저장소에 커밋 금지):
#   export SUPABASE_URL="https://<project-ref>.supabase.co"
#   export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # storage 쓰기 권한
#   export REVIEW_PROMPTS_BUCKET="review-prompts"           # (선택) 기본 review-prompts
#   bash scripts/upload-review-prompts.sh
#
# 사전: 대시보드 또는 CLI 로 공개(read) 버킷 review-prompts 생성.
#   그 후 PROMPT_BASE_URL 을 아래로 설정:
#   https://<project-ref>.supabase.co/storage/v1/object/public/review-prompts
# ─────────────────────────────────────────────
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL 필요}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY 필요}"
BUCKET="${REVIEW_PROMPTS_BUCKET:-review-prompts}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# 업로드 대상: 현재 프롬프트가 존재하는 모듈만(division 은 .md 미작성 — 건너뜀).
count=0
while IFS= read -r f; do
  key="$f"                                   # 예: .claude/rules/agents/patent/examiner_A.md
  url="${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}"
  echo "→ ${key}"
  # upsert(x-upsert:true)로 재실행 안전. text/markdown.
  http_code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$url" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: text/markdown" \
    -H "x-upsert: true" \
    --data-binary "@${f}")
  if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
    echo "  ✗ 업로드 실패(HTTP ${http_code}) — 버킷 존재/권한 확인" >&2
    exit 1
  fi
  count=$((count + 1))
done < <(find .claude/rules/agents -type f -name '*.md' | sort)

echo "완료: ${count}개 업로드 → 버킷 '${BUCKET}'"
echo "PROMPT_BASE_URL=${SUPABASE_URL}/storage/v1/object/public/${BUCKET}"
