/**
 * Upload / paste + AI structure + review — Phase 3–4
 */

import { useCallback, useState } from "react";
import {
  ACCEPTED_EXTENSIONS,
  extractFromFile,
  extractFromPastedText,
  type ExtractResult,
} from "@/lib/extract";
import { TEMPLATES, type DocType } from "@/lib/doc-model";
import { createDoc, saveDoc } from "@/lib/docs.functions";
import { requestAiConvert } from "@/lib/ai-client";
import type { AiDocOutput } from "@/lib/ai-schema";
import type { VerifyResult } from "@/lib/ai-verify";
import { applyAiOutputToDoc } from "@/lib/apply-ai-output";
import { Button } from "@/components/ui/button";
import { AiReviewPanel } from "@/components/AiReviewPanel";
import {
  FileText, Loader2, Upload, X, AlertTriangle, CheckCircle2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function NewDocDialog({ open, onClose, onCreated }: Props) {
  const [docType, setDocType] = useState<DocType>("SOP");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [extracting, setExtracting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>();
  const [aiOutput, setAiOutput] = useState<AiDocOutput | null>(null);
  const [verification, setVerification] = useState<VerifyResult | null>(null);
  const [aiMeta, setAiMeta] = useState<{ model: string; sourceLength: number } | null>(null);

  const templatesForType = TEMPLATES.filter((t) => t.docTypes.includes(docType));

  const reset = () => {
    setResult(null);
    setPasteText("");
    setSelectedSheet(undefined);
    setExtracting(false);
    setAiLoading(false);
    setCreating(false);
    setAiOutput(null);
    setVerification(null);
    setAiMeta(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const runExtract = useCallback(async (file: File, sheetName?: string) => {
    setExtracting(true);
    setResult(null);
    setAiOutput(null);
    try {
      const res = await extractFromFile(file, { sheetName });
      setResult(res);
      if (res.sheetNames?.length) setSelectedSheet(sheetName ?? res.sheetNames[0]);
      toast.success(res.warnings.length ? "อ่านไฟล์เสร็จ (มีข้อจำกัด)" : "อ่านไฟล์สำเร็จ");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setExtracting(false);
    }
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await runExtract(file);
  };

  const onPasteExtract = () => {
    if (!pasteText.trim()) { toast.error("ยังไม่มีข้อความ"); return; }
    setResult(extractFromPastedText(pasteText));
    setAiOutput(null);
    toast.success("แปลงข้อความแล้ว");
  };

  const sourceText = (): string => {
    if (result?.plainText?.trim()) return result.plainText;
    if (pasteText.trim()) return pasteText;
    return "";
  };

  const handleRunAi = async () => {
    const text = sourceText();
    if (text.length < 10) {
      toast.error("ต้องมีข้อความต้นฉบับก่อน");
      return;
    }
    setAiLoading(true);
    setAiOutput(null);
    try {
      const res = await requestAiConvert({ text, docType, templateId });
      setAiOutput(res.output);
      setVerification(res.verification);
      setAiMeta({ model: res.meta.model, sourceLength: res.meta.sourceLength });
      toast.success("AI จัดโครงสร้างเสร็จ — กรุณาตรวจทาน");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "NO_API_KEY") {
        toast.error("ยังไม่ตั้งค่า API Key ฝั่งเซิร์ฟเวอร์", {
          description: "LOVABLE_API_KEY หรือ OPENAI_API_KEY",
        });
      } else {
        toast.error(err.message || "เรียก AI ไม่สำเร็จ");
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmAi = async () => {
    if (!aiOutput) return;
    setCreating(true);
    try {
      const content = applyAiOutputToDoc(aiOutput, result);
      const row = await createDoc({
        data: { title: content.meta.title, docType: aiOutput.docType, templateId: aiOutput.templateId },
      });
      await saveDoc({ data: { id: row.id, content, title: content.meta.title } });
      toast.success("สร้างเอกสารจาก AI แล้ว");
      handleClose();
      onCreated?.(row.id);
      window.location.href = `/editor/${row.id}`;
    } catch (e) {
      toast.error("บันทึกเอกสารไม่สำเร็จ");
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePlain = async () => {
    setCreating(true);
    try {
      const title =
        result?.blocks.find((b) => b.kind === "heading")?.text.slice(0, 80) ?? `${docType} ใหม่`;
      const row = await createDoc({ data: { title, docType, templateId } });
      toast.success("สร้างเอกสารแล้ว");
      handleClose();
      onCreated?.(row.id);
      window.location.href = `/editor/${row.id}`;
    } catch (e) {
      toast.error("สร้างเอกสารไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-lg font-semibold">สร้างเอกสารใหม่</h2>
            <button type="button" onClick={handleClose} className="rounded-md p-1 hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">ประเภทเอกสาร</label>
              <div className="flex gap-2">
                {(["SOP", "WI", "OPL"] as DocType[]).map((t) => (
                  <Button key={t} type="button" size="sm"
                    variant={docType === t ? "default" : "outline"}
                    onClick={() => {
                      setDocType(t);
                      const first = TEMPLATES.find((x) => x.docTypes.includes(t));
                      if (first) setTemplateId(first.id);
                    }}
                  >{t}</Button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">เทมเพลต</label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templatesForType.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">อัปโหลดไฟล์ต้นฉบับ</label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 hover:bg-muted/50">
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Excel, Word, PDF, รูป หรือ .txt</span>
                <input type="file" accept={ACCEPTED_EXTENSIONS} className="hidden"
                  onChange={onFileChange} disabled={extracting} />
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">หรือวางข้อความ</label>
              <textarea className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="วางข้อความ..." value={pasteText}
                onChange={(e) => setPasteText(e.target.value)} />
              <Button type="button" size="sm" variant="outline" className="mt-2"
                onClick={onPasteExtract} disabled={!pasteText.trim()}>แปลงข้อความ</Button>
            </div>

            {extracting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังอ่านไฟล์...
              </div>
            )}

            {result && (
              <div className="space-y-2 rounded-lg border p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{result.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.fileType} · {result.blocks.length} บล็อก · {result.images.length} รูป
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex gap-2 text-sm text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {w}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
            <Button type="button" variant="outline" onClick={handleClose}>ยกเลิก</Button>
            <Button type="button" variant="secondary" onClick={handleCreatePlain}
              disabled={creating || extracting || aiLoading}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              สร้างเปล่า / ไม่ใช้ AI
            </Button>
            <Button type="button" onClick={handleRunAi}
              disabled={creating || extracting || aiLoading || sourceText().length < 10}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              ให้ AI จัดโครงสร้าง
            </Button>
          </div>
        </div>
      </div>

      {aiOutput && verification && (
        <AiReviewPanel
          output={aiOutput}
          verification={verification}
          meta={aiMeta ?? undefined}
          busy={creating}
          onConfirm={handleConfirmAi}
          onCancel={() => { setAiOutput(null); setVerification(null); }}
        />
      )}
    </>
  );
}
