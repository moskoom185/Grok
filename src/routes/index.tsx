import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listDocs, createDoc } from "@/lib/docs.functions";
import { TEMPLATES, type DocType } from "@/lib/doc-model";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Loader2 } from "lucide-react";
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
  const [creating, setCreating] = useState(false);

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
  }, []);

  async function handleCreate(docType: DocType = "SOP") {
    setCreating(true);
    try {
      const template = TEMPLATES.find((t) => t.docTypes.includes(docType)) ?? TEMPLATES[0];
      const row = await createDoc({
        data: {
          title: `${docType} ใหม่`,
          docType,
          templateId: template.id,
        },
      });
      toast.success("สร้างเอกสารแล้ว");
      window.location.href = `/editor/${row.id}`;
    } catch (e) {
      toast.error("สร้างเอกสารไม่สำเร็จ");
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

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
          <div className="flex gap-2">
            <Button
              onClick={() => handleCreate("SOP")}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              สร้าง SOP
            </Button>
            <Button variant="outline" onClick={() => handleCreate("WI")} disabled={creating}>
              สร้าง WI
            </Button>
            <Button variant="outline" onClick={() => handleCreate("OPL")} disabled={creating}>
              สร้าง OPL
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
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
              เริ่มต้นด้วยการสร้างเอกสารใหม่ หรืออัปโหลดไฟล์ต้นฉบับในขั้นถัดไป
            </p>
            <Button className="mt-6" onClick={() => handleCreate("SOP")}>
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
                <h3 className="font-medium group-hover:text-primary">
                  {doc.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  เทมเพลต: {doc.template}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
