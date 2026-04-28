// supabase/functions/send-docket-email/index.ts
// ─────────────────────────────────────────────
// Supabase Edge Function: 견적서 엑셀 첨부 이메일 발송
// Resend API 사용 (https://resend.com)
//
// 배포:
//   supabase functions deploy send-docket-email
//
// 환경변수 설정:
//   supabase secrets set RESEND_API_KEY=re_xxxxx
//   supabase secrets set SENDER_EMAIL=noreply@didimip.com
//     (Resend에서 도메인 인증 필요, 또는 onboarding@resend.dev 사용)
//
// 테스트:
//   curl -X POST https://<project>.supabase.co/functions/v1/send-docket-email \
//     -H "Authorization: Bearer <anon_key>" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"test@test.com","subject":"테스트","html":"<p>Hello</p>","attachments":[{"filename":"test.xlsx","content":"base64..."}]}'
// ─────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "onboarding@resend.dev";
const SENDER_NAME = Deno.env.get("SENDER_NAME") || "특허그룹 디딤";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY가 설정되지 않았습니다. supabase secrets set RESEND_API_KEY=re_xxxxx");
    }

    const { to, subject, html, attachments } = await req.json();

    if (!to || !subject) {
      throw new Error("to, subject 필드는 필수입니다.");
    }

    // Resend API 요청 구성
    const emailPayload: Record<string, unknown> = {
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || "",
    };

    // 첨부파일 처리
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      emailPayload.attachments = attachments.map(
        (att: { filename: string; content: string }) => ({
          filename: att.filename,
          content: att.content, // base64 string
        })
      );
    }

    // Resend API 호출
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", result);
      throw new Error(result.message || `Resend API error: ${res.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-docket-email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
