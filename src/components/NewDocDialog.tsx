/**
 * Upload / paste dialog — Phase 3
 * Shows extraction preview with source tracking before creating a document.
 */

import { useCallback, useState } from "react";
import {
  ACCEPTED_EXTENSIONS,
  extractFromFile,
  extractFromPastedText,
  type ExtractResult,
} from "@/lib/extract";
import { TEMPLATES, type DocType } from "@/lib/doc-model";
import { createDoc } from "@/lib/docs.functions";
import { Button } from "@/components/ui/button";
import {
  FileText, Loader2, Upload, X, AlertTriangle, CheckCircle2,
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
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>();

  const templatesForType = TEMPLATES.filter((t) => t.docTypes.includes(docType));

  const reset = () => {
    setResult(null);
    setPasteText("");
    setSelectedSheet(undefined);
    setExtracting(false);
    setCreating(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const runExtract = useCallback(async (file: File, sheetName?: string) => {
    setExtracting(true);
    setResult(null);
    try {
      const res = await extractFromFile(file, { sheetName });
      setResult(res);
      if (res.sheetNames?.length) setSelectedSheet(sheetName ?? res.sheetNames[0]);
      if (res.warnings.length) {
        toast.message("อ่านไฟล์เสร็จ — มีข้อจำกัดบางอย่าง", { description: res.warnings[0] });
      } else {
        toast.success("อ่านไฟล์สำเร็จ");
      }
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
    if (!pasteText.trim()) {
      toast.error("ยังไม่มีข้อความ");
      return;
    }
    setResult(extractFromPastedText(pasteText));
    toast.success("แปลงข้อความแล้ว");
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const title =
        result?.blocks.find((b) => b.kind === "heading")?.text.slice(0, 80) ??
        `${docType} ใหม่`;
      const row = await createDoc({
        data: { title, docType, templateId },
      });
      if (result) {
        try {
          sessionStorage.setItem(
            `extract:${row.id}`,
            JSON.stringify({
              ...result,
              images: result.images.map((img) => ({
                ...img,
                dataUrl: img.dataUrl.slice(0, 80) + "…",
              })),
              selectedSheet,
            }),
          );
        } catch { /* quota */ }
      }
      toast.success("สร้างเอกสารแล้ว");
      handleClose();
      onCreated?.(row.id);
      window.location.href = `/editor/${row.id}`;
    } catch (e) {
      toast.error("สร้างเอกสารไม่สำเร็จ");
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
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
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={docType === t ? "default" : "outline"}
                  onClick={() => {
                    setDocType(t);
                    const first = TEMPLATES.find((x) => x.docTypes.includes(t));
                    if (first) setTemplateId(first.id);
                  }}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">เทมเพลต</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {templatesForType.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              อัปโหลดไฟล์ต้นฉบับ (ไม่บังคับ)
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 hover:bg-muted/50">
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Excel, Word, PDF, รูปภาพ หรือ .txt
              </span>
              <input
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={onFileChange}
                disabled={extracting}
              />
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">หรือวางข้อความ</label>
            <textarea
              className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="วางข้อความจากเอกสารต้นฉบับ..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <Button
              type="button" size="sm" variant="outline" className="mt-2"
              onClick={onPasteExtract} disabled={!pasteText.trim()}
            >
              แปลงข้อความ
            </Button>
          </div>

          {extracting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังอ่านไฟล์...
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{result.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.fileType} · {(result.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                    {result.blocks.length} บล็อก · {result.images.length} รูป
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              </div>

              {result.warnings.length > 0 && (
                <div className="space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.sheetNames && result.sheetNames.length > 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium">เลือกชีต</label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                  >
                    {result.sheetNames.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="max-h-40 space-y-1 overflow-y-auto rounded border bg-muted/30 p-2 text-xs">
                {result.blocks.slice(0, 40).map((b) => (
                  <div key={b.id} className="flex gap-2">
                    <span className="shrink-0 rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                      {b.kind}
                    </span>
                    <span className="truncate">{b.text}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {b.source.sheet
                        ? `${b.source.sheet}${b.source.cellRange ? "!" + b.source.cellRange : ""}`
                        : b.source.paragraphIndex != null
                          ? `¶${b.source.paragraphIndex}`
                          : ""}
                    </span>
                  </div>
                ))}
                {result.blocks.length > 40 && (
                  <p className="text-muted-foreground">… และอีก {result.blocks.length - 40} บล็อก</p>
                )}
                {result.blocks.length === 0 && (
                  <p className="text-muted-foreground">ไม่มีข้อความที่ดึงได้ในขั้นนี้</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={handleClose}>ยกเลิก</Button>
          <Button type="button" onClick={handleCreate} disabled={creating || extracting}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            สร้างเอกสาร{result ? " จากข้อมูลที่อ่านได้" : " เปล่า"}
          </Button>
        </div>
      </div>
    </div>
  );
}
