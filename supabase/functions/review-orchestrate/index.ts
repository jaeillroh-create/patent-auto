// supabase/functions/review-orchestrate/index.ts
// ─────────────────────────────────────────────
// Supabase Edge Function: 통합 리뷰 엔진 오케스트레이션(opinion/patent/division 공용).
//
// ★ 이 파일은 "배포 래퍼"다. 실제 오케스트레이션 로직은 review-engine/edge/review-orchestrate.ts
//   의 default handler 가 전부 담는다(로직 불변). 여기서는 Deno serve() + CORS 만 입힌다.
// ★ 세 모듈 공용: handler 가 요청 body 의 module 파라미터로 PROFILES[module] 를 선택한다(G9, I-6).
//   module 미지정 시 opinion 기본(후방호환).
//
// 배포:
//   supabase functions deploy review-orchestrate
//   (함수 폴더 밖 ../../../review-engine/* 를 import 한다 — 최신 Supabase CLI 가 import 그래프를
//    따라 번들한다. 자세한 절차·시크릿·프롬프트 호스팅은 docs/review-engine/DEPLOY-review-orchestrate.md)
//
// 환경변수(시크릿) — supabase secrets set 으로 등록(저장소에 커밋 금지):
//   ANTHROPIC_API_KEY   (Claude — attorney_author 등)
//   OPENAI_API_KEY      (GPT — examiner_A/C, attorney_reviewer)
//   GEMINI_API_KEY      (Gemini — examiner_B, domain_expert)
//   PROMPT_BASE_URL     (에이전트 .md 프롬프트 호스팅 베이스 — Supabase Storage 공개 버킷 권장)
// ─────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// 기존 핸들러(로직 불변) — 함수 폴더 밖 review-engine/edge 를 상대경로로 import(최신 CLI 번들).
import handler from "../../../review-engine/edge/review-orchestrate.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 기존 핸들러 호출(로직 불변) → 응답에 CORS 헤더만 덧입힌다.
  const res = await handler(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
});
