/**
 * Phase 6 — client-side export helpers.
 * PNG via html-to-image; project JSON; ZIP (png+json); PDF via print window.
 */

import { toPng } from "html-to-image";
import JSZip from "jszip";
import type { DocContent } from "./doc-model";

function safeName(title: string): string {
  return (
    title
      .replace(/[^\w\u0E00-\u0E7F\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80) || "document"
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportElementAsPng(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  downloadBlob(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
}

export function exportProjectJson(content: DocContent, title: string): void {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    content,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${safeName(title)}.project.json`);
}

export async function exportZip(
  element: HTMLElement,
  content: DocContent,
  title: string,
): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  const pngBase64 = dataUrl.split(",")[1] ?? "";
  const zip = new JSZip();
  const base = safeName(title);
  zip.file(`${base}.png`, pngBase64, { base64: true });
  zip.file(
    `${base}.project.json`,
    JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), content },
      null,
      2,
    ),
  );
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${base}.zip`);
}

/** Opens print window for Save as PDF. */
export function exportAsPdfPrint(element: HTMLElement, title: string): void {
  const w = window.open("", "_blank");
  if (!w) {
    throw new Error("เบราว์เซอร์บล็อกป๊อปอัป — อนุญาตแล้วลองใหม่");
  }
  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((n) => n.outerHTML)
    .join("\n");
  w.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<title>${title.replace(/</g, "")}</title>
${styles}
<style>
  @page { size: auto; margin: 12mm; }
  body { margin: 0; background: white; }
  .print-root { margin: 0 auto; }
</style>
</head>
<body>
<div class="print-root">${element.outerHTML}</div>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 300);
  };
</script>
</body>
</html>`);
  w.document.close();
}

export { safeName };
