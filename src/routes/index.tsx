import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listDocs } from "@/lib/docs.functions";
import { getStorageStatus } from "@/lib/system.functions";
import { Button } from "@/components/ui/button";
import { NewDocDialog } from "@/components/NewDocDialog";
import { FileText, Plus, Loader2, AlertTriangle, Database, Sparkles } from "lucide-react";
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
  const [dialogOpen, setDialogOpen] = useState(false);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              SOP / WI / OPL Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              สร้างเอกสารมาตรฐานจากไฟล์ต้นฉบับ
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            สร้างเอกสาร
          </Button>
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
                  ? "AI พร้อมใช้งาน (มี API Key ฝั่งเซิร์ฟเวอร์)"
                  : "ยังไม่มี AI API Key — สร้างเอกสารเปล่า/แก้ไขเองได้"}
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
              อัปโหลด Excel, Word, PDF หรือวางข้อความ แล้วระบบจะอ่านข้อมูลพร้อมแหล่งที่มา
            </p>
            <Button className="mt-6" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              สร้างเอกสารแรก
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                to="/editor/$id"
                params={{ id: doc.id }}
                className="group rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
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
