/**
 * Zod schema for AI structured output (SOP / WI / OPL).
 */

import { z } from "zod";
import { TEMPLATE_IDS } from "./doc-model";

const fieldStatusSchema = z.enum([
  "extracted",
  "ai_suggested",
  "needs_review",
  "missing_source",
  "user_confirmed",
  "verified",
]);

const sourceRefSchema = z.object({
  type: z.enum(["excel", "word", "pdf", "image", "text", "user"]),
  fileName: z.string().optional(),
  sheet: z.string().optional(),
  cellRange: z.string().optional(),
  paragraphIndex: z.number().optional(),
  tableIndex: z.number().optional(),
  page: z.number().optional(),
  regionNote: z.string().optional(),
  excerpt: z.string().optional(),
  unspecified: z.boolean().optional(),
  note: z.string().optional(),
});

const trackedTextSchema = z.object({
  text: z.string(),
  status: fieldStatusSchema,
  sources: z.array(sourceRefSchema),
  aiSuggestion: z.string().optional(),
});

const trackedListSchema = z.object({
  items: z.array(z.string()),
  status: fieldStatusSchema,
  sources: z.array(sourceRefSchema),
  aiSuggestion: z.array(z.string()).optional(),
});

const stepSchema = z.object({
  order: z.number().int().positive(),
  title: trackedTextSchema,
  content: trackedTextSchema,
  warnings: z.array(trackedTextSchema).default([]),
  tools: trackedListSchema.optional(),
  imageIndexes: z.array(z.number().int().nonnegative()).default([]),
  status: fieldStatusSchema,
});

export const aiDocOutputSchema = z.object({
  title: z.string().min(1),
  docNo: z.string().optional(),
  revision: z.string().optional(),
  docType: z.enum(["SOP", "WI", "OPL"]),
  templateId: z.string().refine((id) => TEMPLATE_IDS.includes(id), {
    message: "templateId must be a known template",
  }),
  purpose: trackedTextSchema.optional(),
  scope: trackedTextSchema.optional(),
  equipment: trackedListSchema.optional(),
  ppe: trackedListSchema.optional(),
  steps: z.array(stepSchema).min(1).max(30),
  warnings: z
    .array(
      z.object({
        text: z.string(),
        level: z.enum(["info", "caution", "warning", "danger"]),
        status: fieldStatusSchema,
        sources: z.array(sourceRefSchema),
      }),
    )
    .default([]),
  keyPoints: z.array(trackedTextSchema).optional(),
  missingFromSource: z.array(z.string()).default([]),
  needsUserConfirmation: z.array(z.string()).default([]),
});

export type AiDocOutput = z.infer<typeof aiDocOutputSchema>;

export const AI_SYSTEM_PROMPT = `You are a document structuring assistant for SOP, WI, and OPL.

HARD RULES:
1. Do NOT invent numbers, technical values, machine settings, tool names, or safety requirements not in the source.
2. Do NOT invent process steps unsupported by the source.
3. If missing, use status "missing_source" or list in missingFromSource. Use "ไม่มีข้อมูลในเอกสารต้นฉบับ" when appropriate.
4. Every step should include sources[] when text came from input. If unknown, set unspecified: true.
5. status: extracted | ai_suggested | needs_review | missing_source
6. Prefer fewer accurate steps (3–15).
7. templateId MUST be one of the allowed ids provided in the user message.
8. Output ONLY valid JSON. No markdown fences.
9. Match source language (Thai if source is Thai).
10. Never claim engineering or safety approval.
`;
