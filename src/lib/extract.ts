/**
 * Client-side extraction of text/tables/images from uploaded files.
 * Phase 3 — no AI, only deterministic parsing + source tracking.
 */

import * as XLSX from "xlsx";
import mammoth from "mammoth";
import type { SourceRef, SourceType } from "./doc-model";

export type ExtractedBlockKind =
  | "heading"
  | "paragraph"
  | "table"
  | "list_item"
  | "image_ref"
  | "sheet_summary"
  | "raw";

export interface ExtractedBlock {
  id: string;
  kind: ExtractedBlockKind;
  text: string;
  table?: { headers: string[]; rows: string[][] };
  source: SourceRef;
}

export interface ExtractedImage {
  id: string;
  dataUrl: string;
  originalName: string;
  mimeType: string;
  width?: number;
  height?: number;
  source: SourceRef;
}

export interface ExtractResult {
  fileName: string;
  fileType: SourceType;
  mimeType: string;
  sizeBytes: number;
  warnings: string[];
  blocks: ExtractedBlock[];
  images: ExtractedImage[];
  sheetNames?: string[];
  plainText: string;
}

export interface ExtractOptions {
  sheetName?: string;
  maxRows?: number;
}

function uid(): string {
  return crypto.randomUUID();
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function detectType(file: File): SourceType | "unsupported" {
  const ext = extOf(file.name);
  const mime = file.type;
  if (
    ext === "xlsx" || ext === "xls" || ext === "csv" ||
    mime.includes("spreadsheet") || mime === "text/csv"
  ) return "excel";
  if (ext === "docx" || mime.includes("wordprocessingml")) return "word";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (
    ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ||
    mime.startsWith("image/")
  ) return "image";
  if (ext === "txt" || mime.startsWith("text/")) return "text";
  return "unsupported";
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extractExcel(
  buffer: ArrayBuffer,
  fileName: string,
  options: ExtractOptions = {},
): Omit<ExtractResult, "mimeType" | "sizeBytes"> {
  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    return {
      fileName, fileType: "excel", warnings: ["ไฟล์ Excel ไม่มีชีต"],
      blocks: [], images: [], sheetNames: [], plainText: "",
    };
  }
  warnings.push(
    "ไม่สามารถดึงภาพฝังใน Excel ได้ครบด้วยไลบรารีปัจจุบัน — กรุณาอัปโหลดรูปแยกถ้าจำเป็น",
  );
  const targetSheet =
    options.sheetName && sheetNames.includes(options.sheetName)
      ? options.sheetName
      : sheetNames[0];
  const maxRows = options.maxRows ?? 500;
  const blocks: ExtractedBlock[] = [];
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const ref = sheet["!ref"];
    blocks.push({
      id: uid(),
      kind: "sheet_summary",
      text: `ชีต: ${name}${ref ? ` (${ref})` : ""}`,
      source: { type: "excel", fileName, sheet: name, cellRange: ref },
    });
  }
  const sheet = workbook.Sheets[targetSheet];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1, defval: "", raw: false,
  });
  const limited = rows.slice(0, maxRows);
  if (rows.length > maxRows) {
    warnings.push(`ชีต "${targetSheet}" มี ${rows.length} แถว — อ่านเพียง ${maxRows} แถวแรก`);
  }
  if (limited.length > 0) {
    const headers = (limited[0] as unknown[]).map((c) => String(c ?? ""));
    const body = limited.slice(1).map((r) =>
      (r as unknown[]).map((c) => String(c ?? "")),
    );
    const lastCol = headers.length > 0 ? XLSX.utils.encode_col(headers.length - 1) : "A";
    const cellRange = `A1:${lastCol}${limited.length}`;
    blocks.push({
      id: uid(),
      kind: "table",
      text: `ตารางจากชีต ${targetSheet}`,
      table: { headers, rows: body },
      source: { type: "excel", fileName, sheet: targetSheet, cellRange },
    });
    for (let r = 0; r < limited.length; r++) {
      const row = limited[r] as unknown[];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] ?? "").trim();
        if (!val) continue;
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        blocks.push({
          id: uid(),
          kind: r === 0 ? "heading" : "paragraph",
          text: val,
          source: {
            type: "excel", fileName, sheet: targetSheet,
            cellRange: cellAddr, excerpt: val.slice(0, 200),
          },
        });
      }
    }
  }
  const plainText = blocks
    .filter((b) => b.kind !== "sheet_summary")
    .map((b) => b.text)
    .join("\n");
  return { fileName, fileType: "excel", warnings, blocks, images: [], sheetNames, plainText };
}

async function extractWord(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<Omit<ExtractResult, "mimeType" | "sizeBytes">> {
  const warnings: string[] = [];
  const blocks: ExtractedBlock[] = [];
  const images: ExtractedImage[] = [];
  const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
  if (textResult.messages?.length) {
    for (const m of textResult.messages) {
      if (m.type === "warning") warnings.push(m.message);
    }
  }
  const paragraphs = textResult.value.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  paragraphs.forEach((text, index) => {
    blocks.push({
      id: uid(),
      kind: index === 0 ? "heading" : "paragraph",
      text,
      source: { type: "word", fileName, paragraphIndex: index, excerpt: text.slice(0, 200) },
    });
  });
  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const imgRegex = /<img[^>]+src="(data:image\/[^"]+)"[^>]*>/gi;
    let match: RegExpExecArray | null;
    let imgIndex = 0;
    while ((match = imgRegex.exec(htmlResult.value)) !== null) {
      const dataUrl = match[1];
      const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z+]+);/);
      images.push({
        id: uid(),
        dataUrl,
        originalName: `${fileName}-image-${imgIndex + 1}`,
        mimeType: mimeMatch?.[1] ?? "image/png",
        source: { type: "word", fileName, note: `ภาพที่ ${imgIndex + 1} จากเอกสาร Word` },
      });
      imgIndex++;
    }
  } catch {
    warnings.push("ไม่สามารถดึงภาพจาก Word ได้ทั้งหมด");
  }
  if (images.length === 0) {
    warnings.push("ไม่พบภาพในไฟล์ Word หรือไลบรารีไม่รองรับ — อัปโหลดรูปแยกได้");
  }
  return { fileName, fileType: "word", warnings, blocks, images, plainText: paragraphs.join("\n") };
}

async function extractText(file: File): Promise<Omit<ExtractResult, "mimeType" | "sizeBytes">> {
  const text = await file.text();
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: ExtractedBlock[] = lines.map((line, index) => ({
    id: uid(),
    kind: index === 0 ? "heading" : "paragraph",
    text: line,
    source: { type: "text", fileName: file.name, excerpt: line.slice(0, 200) },
  }));
  return { fileName: file.name, fileType: "text", warnings: [], blocks, images: [], plainText: text };
}

async function extractImage(file: File): Promise<Omit<ExtractResult, "mimeType" | "sizeBytes">> {
  const dataUrl = await fileToDataUrl(file);
  return {
    fileName: file.name,
    fileType: "image",
    warnings: ["ไฟล์รูปภาพถูกเก็บไว้แล้ว — OCR จะทำในขั้นตอน AI"],
    blocks: [],
    images: [{
      id: uid(), dataUrl, originalName: file.name,
      mimeType: file.type || "image/png",
      source: { type: "image", fileName: file.name, note: "รอ OCR / AI อ่านข้อความในภาพ" },
    }],
    plainText: "",
  };
}

async function extractPdf(file: File): Promise<Omit<ExtractResult, "mimeType" | "sizeBytes">> {
  return {
    fileName: file.name,
    fileType: "pdf",
    warnings: [
      "PDF ยังไม่อ่านข้อความในเบราว์เซอร์โดยตรงใน Phase นี้",
      "Phase 4 จะส่ง PDF ไปยังโมเดล multimodal",
    ],
    blocks: [], images: [], plainText: "",
  };
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function extractFromFile(
  file: File,
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ไฟล์ใหญเกิน 20 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  const fileType = detectType(file);
  if (fileType === "unsupported") {
    throw new Error(`ไม่รองรับไฟล์นี้: ${file.name} (${file.type || "unknown"})`);
  }
  let partial: Omit<ExtractResult, "mimeType" | "sizeBytes">;
  switch (fileType) {
    case "excel":
      partial = extractExcel(await file.arrayBuffer(), file.name, options);
      break;
    case "word":
      partial = await extractWord(await file.arrayBuffer(), file.name);
      break;
    case "text":
      partial = await extractText(file);
      break;
    case "image":
      partial = await extractImage(file);
      break;
    case "pdf":
      partial = await extractPdf(file);
      break;
    default:
      throw new Error("ชนิดไฟล์ไม่รองรับ");
  }
  return { ...partial, mimeType: file.type || "application/octet-stream", sizeBytes: file.size };
}

export function extractFromPastedText(text: string): ExtractResult {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: ExtractedBlock[] = lines.map((line, index) => ({
    id: uid(),
    kind: index === 0 ? "heading" : "paragraph",
    text: line,
    source: { type: "text", fileName: "(ข้อความที่วาง)", excerpt: line.slice(0, 200) },
  }));
  return {
    fileName: "(ข้อความที่วาง)",
    fileType: "text",
    mimeType: "text/plain",
    sizeBytes: new Blob([text]).size,
    warnings: [],
    blocks,
    images: [],
    plainText: text,
  };
}

export const ACCEPTED_EXTENSIONS =
  ".xlsx,.xls,.csv,.docx,.pdf,.png,.jpg,.jpeg,.webp,.txt";

export const ACCEPTED_MIME = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
].join(",");
