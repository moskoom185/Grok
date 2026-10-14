import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getDoc, saveDoc } from "@/lib/docs.functions";
import type { DocContent, DocumentRow } from "@/lib/doc-model";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/editor/$id")({
  component: EditorPage,
});

function EditorPage() {
  const { id } = Route.useParams();
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const row = await getDoc({ data: { id } });
        setDoc(row);
      } catch (e) {
        toast.error("โหลดเอกสารไม่สำเร็จ");
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    try {
      const updated = await saveDoc({
        data: {
          id: doc.id,
          content: doc.content,
          title: doc.title,
        },
      });
      setDoc(updated);
      toast.success("บันทึกแล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        กำลังโหลดเอกสาร...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">ไม่พบเอกสาร หรือไม่มีสิทธิ์เข้าถึง</p>
        <Button asChild variant="outline">
          <Link to="/">กลับหน้ารายการ</Link>
        </Button>
      </div>
    );
  }

  const content = doc.content as DocContent;

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
            <h1 className="font-medium">{doc.title}</h1>
            <p className="text-xs text-muted-foreground">
              {doc.doc_type} · {doc.template}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          บันทึก
        </Button>
      </header>

      <main className="flex flex-1 items-start justify-center bg-muted/40 p-8">
        <div
          className="bg-white shadow-lg"
          style={{
            width: content.meta.paper === "A3" ? 1123 : 794,
            minHeight: content.meta.paper === "A3" ? 1587 : 1123,
            padding: 48,
          }}
        >
          <div className="mb-6 border-b pb-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {doc.doc_type}
            </p>
            <h2 className="text-2xl font-semibold">{content.meta.title}</h2>
            {content.meta.docNo && (
              <p className="mt-1 text-sm text-muted-foreground">
                เลขที่: {content.meta.docNo} · Rev {content.meta.revision ?? "-"}
              </p>
            )}
          </div>

          {content.steps.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีขั้นตอน
              <br />
              <span className="text-xs">
                (ระบบนำเข้าไฟล์และ AI จะมาใน Phase 3–4 · Editor เต็มรูปแบบใน Phase 5)
              </span>
            </div>
          ) : (
            <ol className="space-y-4">
              {content.steps.map((step) => (
                <li key={step.id} className="rounded border p-4">
                  <p className="font-medium">
                    {step.order}. {step.title.text}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.content.text}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </div>
  );
}
