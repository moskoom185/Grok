/**
 * Phase 5–8 Editor — edit, export, drag objects, real images
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDoc, saveDoc } from "@/lib/docs.functions";
import type {
  CanvasObject,
  DocContent,
  DocumentRow,
  FieldStatus,
  Step,
  TextObject,
} from "@/lib/doc-model";
import { createTrackedText, worstStatus } from "@/lib/doc-model";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ExportMenu";
import { CanvasObjectsLayer } from "@/components/CanvasObjectsLayer";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/editor/$id")({
  component: EditorPage,
});

const STATUS_LABEL: Record<FieldStatus, string> = {
  extracted: "จากต้นฉบับ",
  ai_suggested: "AI เสนอ",
  needs_review: "ควรตรวจ",
  missing_source: "ไม่มีแหล่ง",
  user_confirmed: "ผู้ใช้ยืนยัน",
  verified: "ตรวจแหล่งแล้ว",
};

function StatusBadge({ status }: { status: FieldStatus }) {
  const colors: Record<FieldStatus, string> = {
    extracted: "bg-green-100 text-green-800",
    verified: "bg-green-100 text-green-800",
    user_confirmed: "bg-emerald-100 text-emerald-800",
    ai_suggested: "bg-blue-100 text-blue-800",
    needs_review: "bg-amber-100 text-amber-900",
    missing_source: "bg-red-100 text-red-800",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function EditorPage() {
  const { id } = Route.useParams();
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [content, setContent] = useState<DocContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const row = await getDoc({ data: { id } });
        setDoc(row);
        if (row) {
          const c = row.content as DocContent;
          setContent(c);
          setActivePageId(c.pages[0]?.id ?? null);
        }
      } catch (e) {
        toast.error("โหลดเอกสารไม่สำเร็จ");
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const updateContent = useCallback((updater: (c: DocContent) => DocContent) => {
    setContent((prev) => {
      if (!prev) return prev;
      setDirty(true);
      return updater(prev);
    });
  }, []);

  const handleSave = async () => {
    if (!doc || !content) return;
    setSaving(true);
    try {
      const updated = await saveDoc({
        data: {
          id: doc.id,
          content: {
            ...content,
            meta: { ...content.meta, updatedAt: new Date().toISOString() },
          },
          title: content.meta.title,
        },
      });
      setDoc(updated);
      setContent(updated.content as DocContent);
      setDirty(false);
      toast.success("บันทึกแล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const sortedSteps = useMemo(() => {
    if (!content) return [];
    return [...content.steps].sort((a, b) => a.order - b.order);
  }, [content]);

  const pageObjects = useMemo(() => {
    if (!content || !activePageId) return [];
    return content.objects
      .filter((o) => o.pageId === activePageId)
      .sort((a, b) => a.zIndex - b.zIndex);
  }, [content, activePageId]);

  const addStep = () => {
    updateContent((c) => {
      const order = c.steps.length + 1;
      const step: Step = {
        id: crypto.randomUUID(),
        order,
        title: createTrackedText(`ขั้นตอนที่ ${order}`, "user_confirmed", [
          { type: "user", note: "เพิ่มใน editor" },
        ]),
        content: createTrackedText("", "missing_source"),
        imageIds: [],
        warnings: [],
        status: "missing_source",
      };
      return { ...c, steps: [...c.steps, step] };
    });
  };

  const updateStep = (stepId: string, patch: Partial<Step>) => {
    updateContent((c) => ({
      ...c,
      steps: c.steps.map((s) => {
        if (s.id !== stepId) return s;
        const next = { ...s, ...patch };
        next.status = worstStatus([
          next.title.status,
          next.content.status,
          ...(next.warnings?.map((w) => w.status) ?? []),
        ]);
        return next;
      }),
    }));
  };

  const deleteStep = (stepId: string) => {
    updateContent((c) => {
      const filtered = c.steps.filter((s) => s.id !== stepId);
      return { ...c, steps: filtered.map((s, i) => ({ ...s, order: i + 1 })) };
    });
    if (selectedStepId === stepId) setSelectedStepId(null);
  };

  const moveStep = (stepId: string, dir: -1 | 1) => {
    updateContent((c) => {
      const steps = [...c.steps].sort((a, b) => a.order - b.order);
      const idx = steps.findIndex((s) => s.id === stepId);
      if (idx < 0) return c;
      const j = idx + dir;
      if (j < 0 || j >= steps.length) return c;
      [steps[idx], steps[j]] = [steps[j], steps[idx]];
      return { ...c, steps: steps.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  };

  const addTextObject = () => {
    if (!activePageId) return;
    updateContent((c) => {
      const maxZ = c.objects.reduce((m, o) => Math.max(m, o.zIndex), 0);
      const obj: TextObject = {
        id: crypto.randomUUID(),
        type: "text",
        pageId: activePageId,
        x: 80,
        y: 120 + c.objects.filter((o) => o.pageId === activePageId).length * 40,
        width: 400,
        height: 40,
        rotation: 0,
        opacity: 1,
        zIndex: maxZ + 1,
        locked: false,
        style: {},
        content: "ข้อความใหม่",
        fontSize: 16,
        color: "#111827",
      };
      return { ...c, objects: [...c.objects, obj] };
    });
  };

  const updateObject = (objId: string, patch: Partial<CanvasObject>) => {
    updateContent((c) => ({
      ...c,
      objects: c.objects.map((o) =>
        o.id === objId ? ({ ...o, ...patch } as CanvasObject) : o,
      ),
    }));
  };

  const deleteObject = (objId: string) => {
    updateContent((c) => ({
      ...c,
      objects: c.objects.filter((o) => o.id !== objId),
    }));
  };

  const addPage = () => {
    updateContent((c) => {
      const pageId = crypto.randomUUID();
      return {
        ...c,
        pages: [...c.pages, { id: pageId, index: c.pages.length }],
      };
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        กำลังโหลดเอกสาร...
      </div>
    );
  }

  if (!doc || !content) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">ไม่พบเอกสาร หรือไม่มีสิทธิ์</p>
        <Button asChild variant="outline">
          <Link to="/">กลับหน้ารายการ</Link>
        </Button>
      </div>
    );
  }

  const paperW =
    content.meta.orientation === "landscape"
      ? content.meta.paper === "A3"
        ? 1587
        : 1123
      : content.meta.paper === "A3"
        ? 1123
        : 794;
  const paperH =
    content.meta.orientation === "landscape"
      ? content.meta.paper === "A3"
        ? 1123
        : 794
      : content.meta.paper === "A3"
        ? 1587
        : 1123;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <input
              className="bg-transparent text-base font-medium outline-none focus:underline"
              value={content.meta.title}
              onChange={(e) =>
                updateContent((c) => ({
                  ...c,
                  meta: { ...c.meta, title: e.target.value },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              {doc.doc_type} · {doc.template}
              {dirty ? " · ยังไม่บันทึก" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu targetRef={paperRef} content={content} title={content.meta.title} />
          <Button variant="outline" size="sm" onClick={addTextObject}>
            <Type className="h-4 w-4" />
            ข้อความ
          </Button>
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4" />
            ขั้นตอน
          </Button>
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึก
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
          <div className="space-y-2 border-b p-3">
            <label className="text-xs font-medium text-muted-foreground">เลขที่</label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              value={content.meta.docNo ?? ""}
              placeholder="SOP-001"
              onChange={(e) =>
                updateContent((c) => ({
                  ...c,
                  meta: { ...c.meta, docNo: e.target.value || undefined },
                }))
              }
            />
            <label className="text-xs font-medium text-muted-foreground">Revision</label>
            <input
              className="w-full rounded border px-2 py-1 text-sm"
              value={content.meta.revision ?? ""}
              placeholder="00"
              onChange={(e) =>
                updateContent((c) => ({
                  ...c,
                  meta: { ...c.meta, revision: e.target.value || undefined },
                }))
              }
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
              ขั้นตอน ({sortedSteps.length})
            </p>
            {sortedSteps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setSelectedStepId(step.id)}
                className={`mb-1 w-full rounded-md border px-2 py-2 text-left text-sm hover:bg-muted/50 ${
                  selectedStepId === step.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium">
                    {step.order}. {step.title.text || "(ไม่มีชื่อ)"}
                  </span>
                  <StatusBadge status={step.status} />
                </div>
              </button>
            ))}
          </div>

          <div className="border-t p-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">หน้า</p>
            <div className="flex flex-wrap gap-1">
              {content.pages.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={activePageId === p.id ? "default" : "outline"}
                  onClick={() => setActivePageId(p.id)}
                >
                  {p.index + 1}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={addPage}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 justify-center overflow-auto bg-muted/40 p-6">
          <div
            ref={paperRef}
            className="relative bg-white shadow-lg"
            style={{ width: paperW, minHeight: paperH, padding: 48 }}
          >
            <div className="mb-6 border-b pb-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {content.meta.docType}
              </p>
              <h2 className="text-2xl font-semibold">{content.meta.title}</h2>
            </div>

            <CanvasObjectsLayer
              objects={pageObjects}
              images={content.images}
              paperRef={paperRef}
              dragId={dragId}
              onDragId={setDragId}
              onUpdate={(id, patch) => updateObject(id, patch)}
            />

            <ol className="relative z-10 space-y-4">
              {sortedSteps.map((step) => (
                <li
                  key={step.id}
                  className={`rounded border p-4 ${
                    selectedStepId === step.id ? "border-primary ring-1 ring-primary/30" : ""
                  }`}
                  onClick={() => setSelectedStepId(step.id)}
                >
                  <p className="font-medium">
                    {step.order}. {step.title.text}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {step.content.text || "(ยังไม่มีเนื้อหา)"}
                  </p>
                  {step.imageIds?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {step.imageIds.map((iid) => {
                        const im = content.images.find((x) => x.id === iid);
                        if (!im) return null;
                        return (
                          <img
                            key={iid}
                            src={im.src}
                            alt={im.originalName || "step"}
                            className="h-24 max-w-[160px] rounded border object-contain"
                          />
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l bg-card p-4">
          {selectedStepId ? (
            (() => {
              const step = content.steps.find((s) => s.id === selectedStepId);
              if (!step) return null;
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">แก้ไขขั้นตอน</h3>
                    <StatusBadge status={step.status} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">หัวข้อ</label>
                    <input
                      className="w-full rounded border px-2 py-1.5 text-sm"
                      value={step.title.text}
                      onChange={(e) =>
                        updateStep(step.id, {
                          title: {
                            ...step.title,
                            text: e.target.value,
                            status: "user_confirmed",
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">เนื้อหา</label>
                    <textarea
                      className="min-h-[120px] w-full rounded border px-2 py-1.5 text-sm"
                      value={step.content.text}
                      onChange={(e) =>
                        updateStep(step.id, {
                          content: {
                            ...step.content,
                            text: e.target.value,
                            status:
                              step.content.status === "missing_source" ||
                              step.content.status === "extracted"
                                ? "user_confirmed"
                                : step.content.status,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => moveStep(step.id, -1)}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => moveStep(step.id, 1)}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteStep(step.id)}>
                      <Trash2 className="h-4 w-4" />
                      ลบ
                    </Button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium">วัตถุบนหน้า</h3>
              {pageObjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีวัตถุ</p>
              ) : (
                pageObjects.map((obj) => (
                  <div key={obj.id} className="rounded border p-2 text-sm">
                    <div className="flex justify-between">
                      <span>{obj.type}</span>
                      <button type="button" className="text-red-600" onClick={() => deleteObject(obj.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
