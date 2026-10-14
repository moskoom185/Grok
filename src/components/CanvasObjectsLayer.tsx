/**
 * Phase 8 — render & drag canvas objects (text + real images only).
 */

import type { CanvasObject, DocImage, ImageObject, TextObject } from "@/lib/doc-model";

interface Props {
  objects: CanvasObject[];
  images: DocImage[];
  paperRef: React.RefObject<HTMLElement | null>;
  dragId: string | null;
  onDragId: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<CanvasObject>) => void;
}

export function CanvasObjectsLayer({
  objects,
  images,
  paperRef,
  dragId,
  onDragId,
  onUpdate,
}: Props) {
  const offset = { current: { x: 0, y: 0 } } as React.MutableRefObject<{
    x: number;
    y: number;
  }>;

  const onDown = (e: React.PointerEvent, obj: CanvasObject) => {
    if (obj.locked) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = paperRef.current?.getBoundingClientRect();
    if (!rect) return;
    offset.current = {
      x: e.clientX - rect.left - obj.x,
      y: e.clientY - rect.top - obj.y,
    };
    onDragId(obj.id);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragId || !paperRef.current) return;
    const rect = paperRef.current.getBoundingClientRect();
    onUpdate(dragId, {
      x: Math.max(0, e.clientX - rect.left - offset.current.x),
      y: Math.max(0, e.clientY - rect.top - offset.current.y),
    });
  };

  const onUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onDragId(null);
  };

  return (
    <>
      {objects.map((obj) => {
        if (obj.type === "image") {
          const imgObj = obj as ImageObject;
          const img = images.find((i) => i.id === imgObj.imageId);
          if (!img) return null;
          return (
            <div
              key={obj.id}
              className={`absolute overflow-hidden rounded border bg-muted/20 ${
                dragId === obj.id
                  ? "border-primary"
                  : "border-transparent hover:border-primary/40"
              }`}
              style={{
                left: obj.x,
                top: obj.y,
                width: obj.width,
                height: obj.height,
                opacity: obj.opacity,
                transform: `rotate(${obj.rotation}deg)`,
                zIndex: obj.zIndex,
                cursor: obj.locked ? "default" : "move",
              }}
              onPointerDown={(e) => onDown(e, obj)}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              <img
                src={img.src}
                alt={img.caption?.text || img.originalName || "photo"}
                className="pointer-events-none h-full w-full select-none object-contain"
                draggable={false}
              />
            </div>
          );
        }
        if (obj.type !== "text") return null;
        const to = obj as TextObject;
        return (
          <div
            key={obj.id}
            className={`absolute rounded border ${
              dragId === obj.id
                ? "border-primary"
                : "border-transparent hover:border-primary/40"
            }`}
            style={{
              left: obj.x,
              top: obj.y,
              width: obj.width,
              minHeight: obj.height,
              opacity: obj.opacity,
              transform: `rotate(${obj.rotation}deg)`,
              zIndex: obj.zIndex,
              fontSize: to.fontSize ?? 16,
              color: to.color ?? "#111",
              cursor: obj.locked ? "default" : "move",
            }}
            onPointerDown={(e) => onDown(e, obj)}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <textarea
              className="h-full w-full resize-none bg-transparent outline-none"
              value={to.content}
              disabled={obj.locked}
              onChange={(e) =>
                onUpdate(obj.id, { content: e.target.value } as Partial<TextObject>)
              }
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        );
      })}
    </>
  );
}
