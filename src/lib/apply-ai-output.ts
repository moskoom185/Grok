/**
 * Map AI output + extract images into DocContent for saving.
 * Phase 8: also place image canvas objects for linked step photos.
 */

import type { AiDocOutput } from "./ai-schema";
import type {
  CanvasObject,
  DocContent,
  DocImage,
  ImageObject,
  Step,
  TrackedText,
} from "./doc-model";
import { createEmptyDocContent } from "./doc-model";
import type { ExtractResult } from "./extract";

function mapTracked(t: {
  text: string;
  status: TrackedText["status"];
  sources: TrackedText["sources"];
  aiSuggestion?: string;
}): TrackedText {
  return {
    text: t.text,
    status: t.status,
    sources: t.sources,
    aiSuggestion: t.aiSuggestion,
  };
}

export function applyAiOutputToDoc(
  ai: AiDocOutput,
  extract?: ExtractResult | null,
): DocContent {
  const base = createEmptyDocContent(ai.docType, ai.templateId, ai.title);
  const pageId = base.pages[0]?.id ?? crypto.randomUUID();

  const images: DocImage[] = (extract?.images ?? []).map((img) => ({
    id: img.id,
    src: img.dataUrl,
    originalName: img.originalName,
    mimeType: img.mimeType,
    width: img.width,
    height: img.height,
    source: img.source,
  }));

  const steps: Step[] = ai.steps.map((s) => {
    const imageIds: string[] = [];
    for (const idx of s.imageIndexes ?? []) {
      if (images[idx]) imageIds.push(images[idx].id);
    }
    return {
      id: crypto.randomUUID(),
      order: s.order,
      title: mapTracked(s.title),
      content: mapTracked(s.content),
      imageIds,
      warnings: (s.warnings ?? []).map(mapTracked),
      tools: s.tools
        ? {
            items: s.tools.items,
            status: s.tools.status,
            sources: s.tools.sources,
            aiSuggestion: s.tools.aiSuggestion,
          }
        : undefined,
      status: s.status,
    };
  });

  // Place real extract images as canvas objects (never AI-generated photos)
  const objects: CanvasObject[] = [];
  let z = 1;
  let y = 720;
  for (const img of images.slice(0, 6)) {
    const obj: ImageObject = {
      id: crypto.randomUUID(),
      type: "image",
      pageId,
      x: 48,
      y,
      width: 280,
      height: 180,
      rotation: 0,
      opacity: 1,
      zIndex: z++,
      locked: false,
      style: {},
      imageId: img.id,
      objectFit: "contain",
    };
    objects.push(obj);
    y += 200;
  }

  return {
    ...base,
    meta: {
      ...base.meta,
      title: ai.title,
      docNo: ai.docNo,
      revision: ai.revision,
      docType: ai.docType,
      templateId: ai.templateId,
      updatedAt: new Date().toISOString(),
    },
    purpose: ai.purpose ? mapTracked(ai.purpose) : undefined,
    scope: ai.scope ? mapTracked(ai.scope) : undefined,
    equipment: ai.equipment
      ? {
          items: ai.equipment.items,
          status: ai.equipment.status,
          sources: ai.equipment.sources,
        }
      : undefined,
    ppe: ai.ppe
      ? {
          items: ai.ppe.items,
          status: ai.ppe.status,
          sources: ai.ppe.sources,
        }
      : undefined,
    steps,
    warnings: ai.warnings.map((w) => ({
      text: w.text,
      level: w.level,
      status: w.status,
      sources: w.sources,
    })),
    keyPoints: ai.keyPoints?.map(mapTracked),
    images,
    objects,
    pages: [{ id: pageId, index: 0 }],
  };
}
