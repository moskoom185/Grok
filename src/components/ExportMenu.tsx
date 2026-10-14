/**
 * Phase 6 export actions: PNG, PDF (print), JSON, ZIP
 */

import { useState } from "react";
import type { DocContent } from "@/lib/doc-model";
import {
  exportAsPdfPrint,
  exportElementAsPng,
  exportProjectJson,
  exportZip,
  safeName,
} from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Download, FileImage, FileJson, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  content: DocContent;
  title: string;
}

export function ExportMenu({ targetRef, content, title }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: string, fn: () => Promise<void> | void) => {
    const el = targetRef.current;
    if (!el && kind !== "json") {
      toast.error("ไม่พบพื้นที่เอกสารสำหรับส่งออก");
      return;
    }
    setBusy(kind);
    try {
      await fn();
      toast.success("ส่งออกสำเร็จ");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!!busy}
        onClick={() =>
          run("png", async () => {
            await exportElementAsPng(
              targetRef.current!,
              `${safeName(title)}.png`,
            );
          })
        }
      >
        {busy === "png" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileImage className="h-4 w-4" />
        )}
        PNG
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!!busy}
        onClick={() =>
          run("pdf", () => {
            exportAsPdfPrint(targetRef.current!, title);
          })
        }
      >
        {busy === "pdf" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        PDF
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!!busy}
        onClick={() =>
          run("json", () => {
            exportProjectJson(content, title);
          })
        }
      >
        {busy === "json" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileJson className="h-4 w-4" />
        )}
        JSON
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!!busy}
        onClick={() =>
          run("zip", async () => {
            await exportZip(targetRef.current!, content, title);
          })
        }
      >
        {busy === "zip" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        ZIP
      </Button>
    </div>
  );
}
