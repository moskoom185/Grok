/**
 * Post-AI verification against source plain text.
 * Does NOT claim engineering correctness.
 */

import type { AiDocOutput } from "./ai-schema";
import type { FieldStatus } from "./doc-model";

export interface VerifyIssue {
  path: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface VerifyResult {
  ok: boolean;
  issues: VerifyIssue[];
  counts: {
    totalFields: number;
    verified: number;
    needsReview: number;
    missingSource: number;
    aiSuggested: number;
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function appearsInSource(needle: string, haystack: string): boolean {
  const n = normalize(needle);
  if (n.length < 4) return true;
  const h = normalize(haystack);
  if (h.includes(n)) return true;
  const tokens = n.split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return true;
  const hits = tokens.filter((t) => h.includes(t)).length;
  return hits / tokens.length >= 0.5;
}

function countStatus(status: FieldStatus, counts: VerifyResult["counts"]) {
  counts.totalFields += 1;
  switch (status) {
    case "verified":
    case "extracted":
    case "user_confirmed":
      counts.verified += 1;
      break;
    case "needs_review":
      counts.needsReview += 1;
      break;
    case "missing_source":
      counts.missingSource += 1;
      break;
    case "ai_suggested":
      counts.aiSuggested += 1;
      break;
  }
}

export function verifyAiOutput(
  output: AiDocOutput,
  sourcePlainText: string,
): VerifyResult {
  const issues: VerifyIssue[] = [];
  const counts: VerifyResult["counts"] = {
    totalFields: 0,
    verified: 0,
    needsReview: 0,
    missingSource: 0,
    aiSuggested: 0,
  };

  if (!output.steps.length) {
    issues.push({ path: "steps", severity: "error", message: "ไม่มีขั้นตอนในผลลัพธ์" });
  }

  for (const step of output.steps) {
    countStatus(step.status, counts);
    countStatus(step.title.status, counts);
    countStatus(step.content.status, counts);

    if (
      step.title.status !== "missing_source" &&
      step.title.sources.length === 0 &&
      !appearsInSource(step.title.text, sourcePlainText)
    ) {
      issues.push({
        path: `steps[${step.order}].title`,
        severity: "warning",
        message: `หัวข้อขั้นตอน "${step.title.text.slice(0, 40)}" ไม่พบแหล่งที่มาชัดเจนในต้นฉบับ`,
      });
    }

    if (
      step.content.status !== "missing_source" &&
      step.content.text.length > 20 &&
      !appearsInSource(step.content.text, sourcePlainText) &&
      step.content.sources.length === 0
    ) {
      issues.push({
        path: `steps[${step.order}].content`,
        severity: "warning",
        message: `เนื้อหาขั้นตอนที่ ${step.order} อาจถูกแต่งขึ้นหรือไม่ตรงต้นฉบับ — ควรตรวจทาน`,
      });
    }

    const nums = step.content.text.match(/\d+(?:[.,]\d+)?/g) ?? [];
    if (
      nums.length > 0 &&
      step.content.sources.length === 0 &&
      step.content.status === "ai_suggested"
    ) {
      issues.push({
        path: `steps[${step.order}].content`,
        severity: "warning",
        message: `มีตัวเลขในขั้นตอนที่ ${step.order} แต่ไม่มีแหล่งอ้างอิง`,
      });
    }
  }

  for (const w of output.warnings) {
    countStatus(w.status, counts);
    if (w.status !== "missing_source" && w.sources.length === 0) {
      if (!appearsInSource(w.text, sourcePlainText)) {
        issues.push({
          path: "warnings",
          severity: "warning",
          message: `คำเตือน "${w.text.slice(0, 40)}" ไม่พบในต้นฉบับชัดเจน`,
        });
      }
    }
  }

  if (output.ppe) countStatus(output.ppe.status, counts);
  if (output.equipment) countStatus(output.equipment.status, counts);
  if (output.purpose) countStatus(output.purpose.status, counts);

  for (const m of output.missingFromSource) {
    issues.push({ path: "missingFromSource", severity: "info", message: `ข้อมูลที่ขาดจากต้นฉบับ: ${m}` });
  }
  for (const n of output.needsUserConfirmation) {
    issues.push({ path: "needsUserConfirmation", severity: "warning", message: `ต้องให้ผู้ใช้ยืนยัน: ${n}` });
  }

  return { ok: !issues.some((i) => i.severity === "error"), issues, counts };
}
