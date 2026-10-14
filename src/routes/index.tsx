import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  listDocs,
  deleteDoc,
  duplicateDoc,
  importDoc,
} from "@/lib/docs.functions";
import { getStorageStatus } from "@/lib/system.functions";
import type { DocContent } from "@/lib/doc-model";
import { Button } from "@/components/ui/button";
import { NewDocDialog } from "@/components/NewDocDialog";
import {
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  Database,
  Sparkles,
  Trash2,
  Copy,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: DocumentListPage,
});

type DocSummary = {
  id: string;
  title: string;
  doc_type: string;
  template: string;
  created_at: string;
  updated_at: string;
};

function DocumentListPage() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{
    storage: "supabase" | "memory";
    aiConfigured: boolean;
    note: string;
  } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listDocs();
      setDocs(data as DocSummary[]);
    } catch (e) {
      toast.error("โหลดรายการเอกสารไม่สำเร็จ");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    getStorageStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`ลบเอกสาร "${title}" ?`)) return;
    setBusyId(id);
    try {
      await deleteDoc({ data: { id } });
      toast.success("ลบแล้ว");
      await refresh();
    } catch (e) {
      toast.error("ลบไม่สำเร็จ");
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      await duplicateDoc({ data: { id } });
      toast.success("สำเนาแล้ว");
      await refresh();
    } catch (e) {
      toast.error("สำเนาไม่สำเร็จ");
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as {
        version?: number;
        content?: DocContent;
      } & DocContent;
      const content = (json.content ?? json) as DocContent;
      if (!content.meta || !Array.isArray(content.steps)) {
        throw new Error("ไม่ใช่รูป .project.json ที่ส่งออกจากระบบ");
      }
      const row = await importDoc({
        data: { content, title: content.meta.title },
      });
      toast.success("นำเข้าโปรเจกต์สำเร็จ");
      await refresh();
      window.location.href = `/editor/${row.id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "นำเข้าไม่สำเร็จ");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              SOP / WI / OPL Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              สร้างเอกสารมาตรฐานจากไฟล์ต้นฉบับ
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => importRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              นำเข้า JSON
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              สร้างเอกสาร
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {status && (
          <div className="mb-6 flex flex-wrap gap-3 text-sm">
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                status.storage === "memory"
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-green-200 bg-green-50 text-green-900"
              }`}
            >
              {status.storage === "memory" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              <span>{status.note}</span>
            </div>
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                status.aiConfigured
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {status.aiConfigured
                  ? "AI พร้อมใช้งาน"
                  : "ยังไม่มี AI API Key"}
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            กำลังโหลด...
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-lg font-medium">ยังไม่มีเอกสาร</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              สร้างใหม่ หรือนำเข้าไฟล์ .project.json ที่ส่งออกก่อนหน้า
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => importRef.current?.click()}>
                <Upload className="h-4 w-4" />
                นำเข้า JSON
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                สร้างเอกสารแรก
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="group relative rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <Link
                  to="/editor/$id"
                  params={{ id: doc.id }}
                  className="block"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {doc.doc_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.updated_at).toLocaleDateString("th-TH")}
                    </span>
                  </div>
                  <h3 className="font-medium group-hover:text-primary">{doc.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    เทมเพลต: {doc.template}
                  </p>
                </Link>
                <div className="mt-3 flex gap-1 border-t pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === doc.id}
                    onClick={() => handleDuplicate(doc.id)}
                  >
                    {busyId === doc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    สำเนา
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busyId === doc.id}
                    onClick={() => handleDelete(doc.id, doc.title)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    ลบ
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <NewDocDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => refresh()}
      />
    </div>
  );
}
