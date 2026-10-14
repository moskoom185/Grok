/**
 * POST /api/ai-convert
 * Body: { text, docType, templateId? }
 * API keys stay on the server only.
 */

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { AI_SYSTEM_PROMPT, aiDocOutputSchema } from "@/lib/ai-schema";
import { verifyAiOutput } from "@/lib/ai-verify";
import { TEMPLATE_IDS } from "@/lib/doc-model";

export const APIRoute = createAPIFileRoute("/api/ai-convert")({
  POST: async ({ request }) => {
    try {
      const body = (await request.json()) as {
        text?: string;
        docType?: string;
        templateId?: string;
      };

      const text = (body.text ?? "").trim();
      const docType = body.docType ?? "SOP";
      const templateId =
        body.templateId && TEMPLATE_IDS.includes(body.templateId)
          ? body.templateId
          : "industrial-standard";

      if (!text || text.length < 10) {
        return Response.json(
          { error: "ข้อความต้นฉบับสั้นเกินไปหรือว่าง", code: "EMPTY_SOURCE" },
          { status: 400 },
        );
      }
      if (text.length > 100_000) {
        return Response.json(
          { error: "ข้อความยาวเกิน 100,000 ตัวอักษร", code: "SOURCE_TOO_LARGE" },
          { status: 400 },
        );
      }

      const apiKey =
        process.env.LOVABLE_API_KEY ??
        process.env.OPENAI_API_KEY ??
        process.env.AI_API_KEY;

      const baseUrl =
        process.env.AI_BASE_URL ??
        process.env.LOVABLE_AI_BASE_URL ??
        "https://ai.gateway.lovable.dev/v1";

      const model = process.env.AI_MODEL ?? "openai/gpt-4o-mini";

      if (!apiKey) {
        return Response.json(
          {
            error:
              "ยังไม่ได้ตั้งค่า API Key ฝั่งเซิร์ฟเวอร์ (LOVABLE_API_KEY หรือ OPENAI_API_KEY)",
            code: "NO_API_KEY",
            hint: "ตั้งค่าใน environment ของเซิร์ฟเวอร์เท่านั้น ห้ามใส่ใน frontend",
          },
          { status: 503 },
        );
      }

      const userPrompt = [
        `Document type: ${docType}`,
        `Preferred templateId: ${templateId}`,
        `Allowed templateIds: ${TEMPLATE_IDS.join(", ")}`,
        "",
        "SOURCE TEXT BEGIN",
        text.slice(0, 80_000),
        "SOURCE TEXT END",
        "",
        "Return JSON only.",
      ].join("\n");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      let upstream: Response;
      try {
        upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(process.env.LOVABLE_API_KEY
              ? {
                  "Lovable-API-Key": process.env.LOVABLE_API_KEY,
                  "X-Lovable-AIG-SDK": "fetch",
                }
              : {}),
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: AI_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        console.error("AI upstream error", upstream.status, errText.slice(0, 500));
        return Response.json(
          { error: `AI service error (${upstream.status})`, code: "UPSTREAM_ERROR" },
          { status: 502 },
        );
      }

      const data = (await upstream.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = data.choices?.[0]?.message?.content ?? "";
      if (!raw) {
        return Response.json(
          { error: "Empty AI response", code: "EMPTY_AI_RESPONSE" },
          { status: 502 },
        );
      }

      let parsed: unknown;
      try {
        const cleaned = raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        return Response.json(
          { error: "Invalid JSON from AI", code: "INVALID_JSON", preview: raw.slice(0, 300) },
          { status: 502 },
        );
      }

      const validated = aiDocOutputSchema.safeParse(parsed);
      if (!validated.success) {
        return Response.json(
          {
            error: "AI output schema mismatch",
            code: "SCHEMA_MISMATCH",
            details: validated.error.flatten(),
          },
          { status: 422 },
        );
      }

      const output = {
        ...validated.data,
        docType: docType as "SOP" | "WI" | "OPL",
      };

      const verification = verifyAiOutput(output, text);

      return Response.json({
        output,
        verification,
        meta: {
          model,
          sourceLength: text.length,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return Response.json(
          { error: "AI timeout", code: "TIMEOUT" },
          { status: 504 },
        );
      }
      console.error("ai-convert error", e);
      return Response.json(
        { error: "Internal error", code: "INTERNAL" },
        { status: 500 },
      );
    }
  },
});
