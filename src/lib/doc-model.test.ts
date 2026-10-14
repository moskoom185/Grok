import { describe, it, expect } from "vitest";
import {
  createEmptyDocContent,
  createTrackedText,
  worstStatus,
  TEMPLATES,
  TEMPLATE_IDS,
} from "./doc-model";

describe("doc-model", () => {
  it("creates empty document with one page", () => {
    const doc = createEmptyDocContent("SOP", "industrial-standard", "ทดสอบ");
    expect(doc.meta.docType).toBe("SOP");
    expect(doc.meta.templateId).toBe("industrial-standard");
    expect(doc.meta.title).toBe("ทดสอบ");
    expect(doc.pages).toHaveLength(1);
    expect(doc.steps).toHaveLength(0);
    expect(doc.images).toHaveLength(0);
    expect(doc.objects).toHaveLength(0);
  });

  it("has 12 templates", () => {
    expect(TEMPLATES.length).toBe(12);
    expect(TEMPLATE_IDS.length).toBe(12);
  });

  it("createTrackedText defaults to missing_source", () => {
    const t = createTrackedText("hello");
    expect(t.text).toBe("hello");
    expect(t.status).toBe("missing_source");
    expect(t.sources).toEqual([]);
  });

  it("worstStatus prioritizes missing_source", () => {
    expect(
      worstStatus(["verified", "missing_source", "user_confirmed"]),
    ).toBe("missing_source");
    expect(worstStatus(["verified", "user_confirmed"])).toBe("user_confirmed");
  });
});
