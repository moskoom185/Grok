/**
 * Review AI-structured document before applying to editor.
 */

import type { AiDocOutput } from "@/lib/ai-schema";
import type { VerifyResult } from "@/lib/ai-verify";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

interface Props {
  output: AiDocOutput;
  verification: VerifyResult;
  meta?: { model: string; sourceLength: number };
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    extracted: "bg-green-100 text-green-800",
    verified: "bg-green-100 text-green-800",
    user_confirmed: "bg-green-100 text-green-800",
    ai_suggested: "bg-blue-100 text-blue-800",
    needs_review: "bg-amber-100 text-amber-900",
    missing_source: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

export function AiReviewPanel({
  output, verification, meta, busy, onConfirm, onCancel,
}: Props) {
  const hasBlocking =
    verification.counts.missingSource > 0 ||
    verification.issues.some((i) => i.severity === "error");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-card shadow-2xl">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">ตรวจทานผลจาก AI</h2>
          <p className="text-sm text-muted-foreground">
            ยังไม่ใช่การรับรองทางวิศวกรรม — ตรวจกับต้นฉบับก่อนยืนยัน
          </p>
          {meta && (
            <p className="mt-1 text-xs text-muted-foreground">
              โมเดล: {meta.model} · ต้นฉบับ {meta.sourceLength} ตัวอักษร
            </p>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-semibold">{verification.counts.verified}</p>
              <p className="text-xs text-muted-foreground">จากต้นฉบับ</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-semibold text-blue-700">{verification.counts.aiSuggested}</p>
              <p className="text-xs text-muted-foreground">AI จัดเรียง</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-semibold text-amber-700">{verification.counts.needsReview}</p>
              <p className="text-xs text-muted-foreground">ควรตรวจทาน</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-semibold text-red-700">{verification.counts.missingSource}</p>
              <p className="text-xs text-muted-foreground">ไม่มีในต้นฉบับ</p>
            </div>
          </div>

          {verification.issues.length > 0 && (
            <div className="space-y-1 rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">ผลการตรวจสอบอัตโนมัติ</p>
              {verification.issues.slice(0, 20).map((issue, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  {issue.severity === "error" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  ) : issue.severity === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  )}
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{output.docType} · {output.templateId}</p>
            <p className="text-lg font-medium">{output.title}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">ขั้นตอน ({output.steps.length})</p>
            {output.steps.map((step) => (
              <div key={step.order} className="rounded-lg border p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{step.order}. {step.title.text}</span>
                  <StatusBadge status={step.status} />
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{step.content.text}</p>
              </div>
            ))}
          </div>

          {output.missingFromSource.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <p className="font-medium">ข้อมูลที่ไม่มีในต้นฉบับ</p>
              <ul className="mt-1 list-inside list-disc">
                {output.missingFromSource.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {hasBlocking && (
            <p className="text-sm text-amber-800">
              มีรายการที่ขาดแหล่งหรือต้องตรวจทาน — ยืนยันได้แต่ควรแก้ใน editor ต่อ
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>ยกเลิก</Button>
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            ยืนยันและนำไปใช้กับเอกสาร
          </Button>
        </div>
      </div>
    </div>
  );
}
