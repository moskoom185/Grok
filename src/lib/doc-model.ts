/**
 * Document Model for SOP / WI / OPL Studio
 *
 * Design principles (Phase 2):
 * - Clear separation between:
 *   1. Extracted data from source documents
 *   2. AI suggestions
 *   3. Verification status
 *   4. User-confirmed data
 * - Every important field carries SourceRef[] and FieldStatus
 * - CanvasObject is extensible for future object types
 * - Supports multi-page from the start
 */

// ---------------------------------------------------------------------------
// Core enums & primitives
// ---------------------------------------------------------------------------

export type DocType = "SOP" | "WI" | "OPL";

/**
 * Status of a data field.
 * - extracted      : taken directly from source, not yet reviewed
 * - ai_suggested   : proposed by AI (may or may not have source)
 * - needs_review   : system or AI flagged as uncertain
 * - missing_source : required data with no source found
 * - user_confirmed : user explicitly accepted
 * - verified       : passed automated checks against source (NOT engineering sign-off)
 */
export type FieldStatus =
  | "extracted"
  | "ai_suggested"
  | "needs_review"
  | "missing_source"
  | "user_confirmed"
  | "verified";

export type PaperSize = "A4" | "A3";
export type Orientation = "portrait" | "landscape";
export type WarningLevel = "info" | "caution" | "warning" | "danger";

// ---------------------------------------------------------------------------
// Source Tracking
// ---------------------------------------------------------------------------

export type SourceType = "excel" | "word" | "pdf" | "image" | "text" | "user";

/**
 * Precise reference back to the original material.
 * When a location cannot be determined, set `unspecified: true`
 * and provide whatever context is available.
 */
export interface SourceRef {
  type: SourceType;
  /** Original file name if known */
  fileName?: string;
  /** Excel */
  sheet?: string;
  /** Excel cell or range, e.g. "B12" or "A1:D20" */
  cellRange?: string;
  /** Word: approximate paragraph index or table id */
  paragraphIndex?: number;
  tableIndex?: number;
  /** PDF page number (1-based) */
  page?: number;
  /** Image: region description or OCR snippet if available */
  regionNote?: string;
  /** Short excerpt from the source for human verification */
  excerpt?: string;
  /** True when the system could not locate a precise position */
  unspecified?: boolean;
  /** Human-readable note explaining why location is missing */
  note?: string;
}

// ---------------------------------------------------------------------------
// Field wrappers – force explicit status + sources
// ---------------------------------------------------------------------------

export interface TrackedText {
  text: string;
  status: FieldStatus;
  sources: SourceRef[];
  /** Optional AI suggestion that differs from extracted text */
  aiSuggestion?: string;
}

export interface TrackedList {
  items: string[];
  status: FieldStatus;
  sources: SourceRef[];
  aiSuggestion?: string[];
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export interface Step {
  id: string;
  order: number;
  title: TrackedText;
  content: TrackedText;
  /** References to images[] by id */
  imageIds: string[];
  warnings: TrackedText[];
  tools?: TrackedList;
  /** Overall status of this step (worst of its children) */
  status: FieldStatus;
}

// ---------------------------------------------------------------------------
// Images (real photos only – never AI-generated process photos)
// ---------------------------------------------------------------------------

export interface DocImage {
  id: string;
  /** data URL or storage URL */
  src: string;
  originalName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  source: SourceRef;
  /** Caption may be AI-suggested or user-edited */
  caption?: TrackedText;
}

// ---------------------------------------------------------------------------
// Canvas objects (Canva-like)
// ---------------------------------------------------------------------------

export type CanvasObjectType =
  | "text"
  | "image"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "warning-sign"
  | "sticker"
  | "step-number"
  | "divider";

export interface BaseCanvasObject {
  id: string;
  type: CanvasObjectType;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0–1
  zIndex: number;
  locked: boolean;
  /** Extensible style bag */
  style: Record<string, string | number | boolean>;
}

export interface TextObject extends BaseCanvasObject {
  type: "text";
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
}

export interface ImageObject extends BaseCanvasObject {
  type: "image";
  imageId: string; // ref to DocImage
  objectFit?: "contain" | "cover" | "fill";
  crop?: { x: number; y: number; width: number; height: number };
}

export interface ShapeObject extends BaseCanvasObject {
  type: "rect" | "ellipse" | "line" | "arrow" | "divider";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface WarningSignObject extends BaseCanvasObject {
  type: "warning-sign";
  level: WarningLevel;
  label?: string;
}

export interface StickerObject extends BaseCanvasObject {
  type: "sticker";
  stickerId: string;
}

export interface StepNumberObject extends BaseCanvasObject {
  type: "step-number";
  number: number;
}

export type CanvasObject =
  | TextObject
  | ImageObject
  | ShapeObject
  | WarningSignObject
  | StickerObject
  | StepNumberObject;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export interface DocPage {
  id: string;
  index: number; // 0-based
  name?: string;
}

// ---------------------------------------------------------------------------
// Full document content
// ---------------------------------------------------------------------------

export interface DocMeta {
  title: string;
  docNo?: string;
  revision?: string;
  docType: DocType;
  templateId: string;
  paper: PaperSize;
  orientation: Orientation;
  colorTheme: string;
  font: string;
  logoImageId?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface DocContent {
  meta: DocMeta;

  purpose?: TrackedText;
  scope?: TrackedText;
  equipment?: TrackedList;
  ppe?: TrackedList;

  steps: Step[];

  warnings: Array<{
    text: string;
    level: WarningLevel;
    status: FieldStatus;
    sources: SourceRef[];
  }>;

  keyPoints?: TrackedText[];

  images: DocImage[];
  objects: CanvasObject[];
  pages: DocPage[];

  /**
   * Overall document-level verification summary.
   * Never claim engineering sign-off.
   */
  verificationSummary?: {
    totalFields: number;
    verified: number;
    needsReview: number;
    missingSource: number;
    userConfirmed: number;
    lastCheckedAt?: string;
  };
}

// ---------------------------------------------------------------------------
// Database row shape (Supabase)
// ---------------------------------------------------------------------------

export interface DocumentRow {
  id: string;
  owner_session_id: string; // server-generated, stored in HttpOnly cookie
  title: string;
  doc_type: DocType;
  template: string;
  content: DocContent;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Templates registry
// ---------------------------------------------------------------------------

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  docTypes: DocType[];
  paper: PaperSize;
  orientation: Orientation;
  previewColor: string;
  /** Future: layout tokens instead of hard-coded branches */
  layoutHints?: Record<string, unknown>;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "industrial-standard",
    name: "Industrial Standard",
    description: "รูปแบบมาตรฐานโรงงาน หัวกระดาษชัดเจน ตารางขั้นตอน",
    docTypes: ["SOP", "WI"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#1e40af",
  },
  {
    id: "modern-clean",
    name: "Modern Clean",
    description: "เรียบง่าย เน้นพื้นที่ว่าง อ่านง่าย",
    docTypes: ["SOP", "WI", "OPL"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#0f766e",
  },
  {
    id: "safety-first",
    name: "Safety First",
    description: "เน้นป้ายเตือน PPE และข้อควรระวัง",
    docTypes: ["SOP", "WI"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#b91c1c",
  },
  {
    id: "step-by-step-wi",
    name: "Step-by-Step WI",
    description: "เหมาะกับ Work Instruction ทีละขั้นตอนพร้อมรูป",
    docTypes: ["WI"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#7c3aed",
  },
  {
    id: "one-point-lesson",
    name: "One Point Lesson",
    description: "OPL หน้าเดียว เน้นจุดเดียว",
    docTypes: ["OPL"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#c2410c",
  },
  {
    id: "photo-instruction",
    name: "Photo Instruction",
    description: "เน้นภาพถ่ายขั้นตอนเป็นหลัก",
    docTypes: ["WI", "OPL"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#0369a1",
  },
  {
    id: "maintenance-procedure",
    name: "Maintenance Procedure",
    description: "เหมาะกับงานบำรุงรักษา เครื่องมือ และจุดตรวจ",
    docTypes: ["SOP", "WI"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#4338ca",
  },
  {
    id: "quality-control",
    name: "Quality Control",
    description: "เน้นจุดตรวจสอบคุณภาพและเกณฑ์ผ่าน",
    docTypes: ["SOP", "WI"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#15803d",
  },
  {
    id: "minimal-technical",
    name: "Minimal Technical",
    description: "มินิมอล เน้นข้อความทางเทคนิค",
    docTypes: ["SOP", "WI", "OPL"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#374151",
  },
  {
    id: "a3-wide",
    name: "A3 Wide Process",
    description: "กระดาษ A3 แนวนอน สำหรับแผนภาพกระบวนการ",
    docTypes: ["SOP", "WI"],
    paper: "A3",
    orientation: "landscape",
    previewColor: "#0e7490",
  },
  {
    id: "safety-opl",
    name: "Safety OPL",
    description: "OPL ด้านความปลอดภัย",
    docTypes: ["OPL"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#dc2626",
  },
  {
    id: "custom-layout",
    name: "Custom Layout",
    description: "เริ่มจากหน้าว่าง จัดเองได้เต็มที่",
    docTypes: ["SOP", "WI", "OPL"],
    paper: "A4",
    orientation: "portrait",
    previewColor: "#6b7280",
  },
];

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createEmptyDocContent(
  docType: DocType,
  templateId: string,
  title = "เอกสารใหม่",
): DocContent {
  const now = new Date().toISOString();
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];
  const pageId = crypto.randomUUID();

  return {
    meta: {
      title,
      docType,
      templateId: template.id,
      paper: template.paper,
      orientation: template.orientation,
      colorTheme: template.previewColor,
      font: "Sarabun",
      createdAt: now,
      updatedAt: now,
    },
    steps: [],
    warnings: [],
    images: [],
    objects: [],
    pages: [{ id: pageId, index: 0 }],
  };
}

export function createTrackedText(
  text: string,
  status: FieldStatus = "missing_source",
  sources: SourceRef[] = [],
): TrackedText {
  return { text, status, sources };
}

export function worstStatus(statuses: FieldStatus[]): FieldStatus {
  const order: FieldStatus[] = [
    "missing_source",
    "needs_review",
    "ai_suggested",
    "extracted",
    "user_confirmed",
    "verified",
  ];
  for (const s of order) {
    if (statuses.includes(s)) return s;
  }
  return "verified";
}
